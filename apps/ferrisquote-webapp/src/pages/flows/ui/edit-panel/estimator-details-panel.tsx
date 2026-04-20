import { useEffect, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import type { Schemas } from "@/api/api.client"
import {
  useAddVariable,
  useRemoveVariable,
  useUpdateEstimator,
  useUpdateVariable,
} from "@/api/estimators.api"
import { type EstimatorIndex } from "@/pages/flows/lib/expression-refs"
import {
  TEMP_PREFIX,
  useEstimatorDraftStore,
} from "@/pages/flows/feature/estimator-draft-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VariableCard } from "./variable-card"

const ROSE = "hsl(330, 80%, 60%)"

export function EstimatorDetailsPanel({
  estimator,
  flowId,
  availableFieldKeys,
  otherEstimators,
  estimatorsIndex,
  onClose,
}: {
  estimator: Schemas.EstimatorResponse
  flowId: string
  availableFieldKeys: string[]
  otherEstimators: Array<{ id: string; name: string; variables: string[] }>
  estimatorsIndex: EstimatorIndex
  onClose: () => void
}) {
  const [editingName, setEditingName] = useState(false)

  // Zustand draft store — shared with the canvas so the graph reflects
  // uncommitted edits live. Reset whenever the estimator identity changes.
  const drafts = useEstimatorDraftStore()

  useEffect(() => {
    drafts.setActive(estimator.id)
    // Cleanup when unmounting / switching estimator
    return () => {
      if (useEstimatorDraftStore.getState().estimatorId === estimator.id) {
        drafts.clear()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimator.id])

  // Also resync when server values change under our feet (e.g. save just
  // landed and cache refreshed) — only if no user edits are pending.
  useEffect(() => {
    setEditingName(false)
  }, [estimator.id, estimator.name, estimator.description])

  const updateEstimator = useUpdateEstimator(flowId, estimator.id)
  const addVariable = useAddVariable(flowId, estimator.id)
  const updateVariable = useUpdateVariable(flowId, estimator.id)
  const removeVariable = useRemoveVariable(flowId, estimator.id)

  // Display values: use draft when present, fall back to server
  const nameDisplay =
    drafts.nameDraft != null ? drafts.nameDraft : estimator.name.replace(/_/g, " ")
  const descDisplay = drafts.descDraft != null ? drafts.descDraft : estimator.description

  // Effective variables (server + pending adds, minus pending deletes, with edits overlaid)
  const effectiveVariables: Schemas.VariableResponse[] = [
    ...estimator.variables
      .filter((v) => !drafts.pendingDeletes.has(v.id))
      .map((v) => {
        const patch = drafts.variableEdits[v.id]
        return patch ? { ...v, ...patch } : v
      }),
    ...drafts.pendingAdds,
  ]

  // Validation
  const normalizedName = nameDisplay.trim().replace(/\s+/g, "_")
  const nameValid = /^[A-Za-z0-9_]+$/.test(normalizedName)
  const duplicateName = otherEstimators.some((e) => e.name === normalizedName)

  const nameDirty = drafts.nameDraft != null && normalizedName !== estimator.name
  const descDirty = drafts.descDraft != null && drafts.descDraft !== estimator.description
  const editsDirty = Object.keys(drafts.variableEdits).length > 0
  const addsDirty = drafts.pendingAdds.length > 0
  const deletesDirty = drafts.pendingDeletes.size > 0
  const isDirty = nameDirty || descDirty || editsDirty || addsDirty || deletesDirty

  const canSave =
    isDirty && nameValid && !duplicateName && normalizedName.length > 0

  // ─── Save / Cancel ────────────────────────────────────────────────────────
  function handleSave() {
    if (!canSave) return

    if (nameDirty || descDirty) {
      const body: Schemas.UpdateEstimatorRequest = {}
      if (nameDirty) body.name = normalizedName
      if (descDirty) body.description = drafts.descDraft ?? ""
      updateEstimator.mutate(
        { path: { estimator_id: estimator.id }, body },
        { onError: (err) => toast.error(`Update failed: ${err.message}`) },
      )
    }

    for (const v of drafts.pendingAdds) {
      addVariable.mutate(
        {
          path: { estimator_id: estimator.id },
          body: {
            name: v.name,
            expression: v.expression || "0",
            description: v.description || null,
          },
        },
        { onError: (err) => toast.error(`Add variable failed: ${err.message}`) },
      )
    }

    for (const [variableId, patch] of Object.entries(drafts.variableEdits)) {
      const body: Schemas.UpdateVariableRequest = {
        name: patch.name,
        expression: patch.expression,
        description: patch.description ?? null,
      }
      updateVariable.mutate(
        { path: { variable_id: variableId }, body },
        { onError: (err) => toast.error(`Variable update failed: ${err.message}`) },
      )
    }

    for (const variableId of drafts.pendingDeletes) {
      removeVariable.mutate(
        { path: { variable_id: variableId } },
        { onError: (err) => toast.error(`Delete variable failed: ${err.message}`) },
      )
    }

    drafts.clear()
    drafts.setActive(estimator.id)
  }

  function handleCancel() {
    drafts.clear()
    drafts.setActive(estimator.id)
    setEditingName(false)
  }

  // ─── Variable mutations (staged in store, not fired) ──────────────────────
  function handleVariablePatch(variableId: string, patch: Partial<Schemas.VariableResponse>) {
    if (variableId.startsWith(TEMP_PREFIX)) {
      // Update the pending addition in place
      const cur = drafts.pendingAdds.find((v) => v.id === variableId)
      if (!cur) return
      drafts.removePending(variableId)
      drafts.addPending({ ...cur, ...patch })
      return
    }
    // Stage an edit; collapse to no-op if it matches server
    const server = estimator.variables.find((v) => v.id === variableId)
    if (!server) return
    const merged = { ...(drafts.variableEdits[variableId] ?? {}), ...patch }
    const allSame =
      (merged.name === undefined || merged.name === server.name) &&
      (merged.expression === undefined || merged.expression === server.expression) &&
      (merged.description === undefined || merged.description === server.description)
    if (allSame) {
      drafts.dropVariableEdit(variableId)
      return
    }
    drafts.patchVariable(variableId, patch)
  }

  function handleAddVariable() {
    const tempId = `${TEMP_PREFIX}${crypto.randomUUID()}`
    const n = drafts.pendingAdds.length + 1
    drafts.addPending({
      id: tempId,
      name: `new_var_${n}`,
      expression: "0",
      description: "",
    })
  }

  function handleDeleteVariable(variableId: string) {
    if (variableId.startsWith(TEMP_PREFIX)) {
      drafts.removePending(variableId)
      return
    }
    drafts.markDelete(variableId)
  }

  const ownEstimatorVariableNames = effectiveVariables.map((v) => v.name)

  return (
    <>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b shrink-0">
        {editingName ? (
          <Input
            autoFocus
            className="flex-1 !text-base font-semibold h-7 rounded-sm border border-border/60 bg-transparent px-2 py-0 shadow-none focus-visible:border-border focus-visible:ring-0"
            style={{ color: ROSE }}
            value={nameDisplay}
            onChange={(e) => {
              const allowed = e.target.value.replace(/[^A-Za-z0-9_ ]/g, "")
              drafts.setName(allowed)
            }}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditingName(false)
            }}
          />
        ) : (
          <button
            className="flex-1 text-left text-base font-semibold truncate hover:opacity-80 transition-opacity cursor-text"
            style={{ color: ROSE }}
            onClick={() => setEditingName(true)}
          >
            {nameDisplay || estimator.name.replace(/_/g, " ")}
          </button>
        )}
        {!editingName && (
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 px-5 py-4 flex-1 overflow-y-auto pb-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estimator-desc" className="text-xs font-medium">
            Description
          </Label>
          <Textarea
            id="estimator-desc"
            rows={2}
            placeholder="Optional — describe this estimator"
            value={descDisplay}
            onChange={(e) => drafts.setDesc(e.target.value)}
          />
        </div>

        {isDirty && !nameValid && normalizedName.length > 0 && (
          <p className="text-xs text-destructive">
            Name can only contain letters, digits, spaces and underscores.
          </p>
        )}
        {isDirty && duplicateName && (
          <p className="text-xs text-destructive">
            An estimator named "{normalizedName.replace(/_/g, " ")}" already exists.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Variables are evaluated in dependency order. Reference fields with <code className="font-mono bg-muted px-1 rounded">@field_key</code>.
        </p>

        {effectiveVariables.map((v) => (
          <VariableCard
            key={v.id}
            variable={v}
            ownEstimatorName={estimator.name}
            ownEstimatorVariables={ownEstimatorVariableNames.filter((n) => n !== v.name)}
            availableFieldKeys={availableFieldKeys}
            otherEstimators={otherEstimators}
            estimatorsIndex={estimatorsIndex}
            onUpdate={handleVariablePatch}
            onDelete={handleDeleteVariable}
          />
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={handleAddVariable}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add variable
        </Button>
      </div>

      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button
          variant="outline"
          className="flex-1"
          disabled={!isDirty || updateEstimator.isPending}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!canSave || updateEstimator.isPending}
          onClick={handleSave}
        >
          {updateEstimator.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : null}
          Save
        </Button>
      </div>
    </>
  )
}
