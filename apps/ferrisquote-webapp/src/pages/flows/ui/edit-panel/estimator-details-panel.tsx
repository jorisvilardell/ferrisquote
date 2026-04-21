import { useEffect, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import type { Schemas } from "@/api/api.client"
import {
  useAddInput,
  useAddOutput,
  useRemoveInput,
  useRemoveOutput,
  useUpdateEstimator,
  useUpdateInput,
  useUpdateOutput,
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
import { InputCard } from "./input-card"
import { OutputCard } from "./output-card"

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
  otherEstimators: Array<{ id: string; name: string; outputs: string[] }>
  estimatorsIndex: EstimatorIndex
  onClose: () => void
}) {
  const [editingName, setEditingName] = useState(false)

  const drafts = useEstimatorDraftStore()

  useEffect(() => {
    drafts.setActive(estimator.id)
    return () => {
      if (useEstimatorDraftStore.getState().estimatorId === estimator.id) {
        drafts.clear()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimator.id])

  useEffect(() => {
    setEditingName(false)
  }, [estimator.id, estimator.name, estimator.description])

  const updateEstimator = useUpdateEstimator(flowId, estimator.id)
  const addInput = useAddInput(flowId, estimator.id)
  const updateInput = useUpdateInput(flowId, estimator.id)
  const removeInput = useRemoveInput(flowId, estimator.id)
  const addOutput = useAddOutput(flowId, estimator.id)
  const updateOutput = useUpdateOutput(flowId, estimator.id)
  const removeOutput = useRemoveOutput(flowId, estimator.id)

  const nameDisplay =
    drafts.nameDraft != null ? drafts.nameDraft : estimator.name.replace(/_/g, " ")
  const descDisplay = drafts.descDraft != null ? drafts.descDraft : estimator.description

  const effectiveInputs: Schemas.InputResponse[] = [
    ...estimator.inputs
      .filter((v) => !drafts.pendingInputDeletes.has(v.id))
      .map((v) => {
        const patch = drafts.inputEdits[v.id]
        return patch ? { ...v, ...patch } : v
      }),
    ...drafts.pendingInputAdds,
  ]

  const effectiveOutputs: Schemas.OutputResponse[] = [
    ...estimator.outputs
      .filter((v) => !drafts.pendingOutputDeletes.has(v.id))
      .map((v) => {
        const patch = drafts.outputEdits[v.id]
        return patch ? { ...v, ...patch } : v
      }),
    ...drafts.pendingOutputAdds,
  ]

  const normalizedName = nameDisplay.trim().replace(/\s+/g, "_")
  const nameValid = /^[A-Za-z0-9_]+$/.test(normalizedName)
  const duplicateName = otherEstimators.some((e) => e.name === normalizedName)

  const nameDirty = drafts.nameDraft != null && normalizedName !== estimator.name
  const descDirty = drafts.descDraft != null && drafts.descDraft !== estimator.description
  const inputEditsDirty = Object.keys(drafts.inputEdits).length > 0
  const inputAddsDirty = drafts.pendingInputAdds.length > 0
  const inputDelsDirty = drafts.pendingInputDeletes.size > 0
  const outputEditsDirty = Object.keys(drafts.outputEdits).length > 0
  const outputAddsDirty = drafts.pendingOutputAdds.length > 0
  const outputDelsDirty = drafts.pendingOutputDeletes.size > 0
  const isDirty =
    nameDirty ||
    descDirty ||
    inputEditsDirty ||
    inputAddsDirty ||
    inputDelsDirty ||
    outputEditsDirty ||
    outputAddsDirty ||
    outputDelsDirty

  const canSave =
    isDirty && nameValid && !duplicateName && normalizedName.length > 0

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

    // Inputs
    for (const v of drafts.pendingInputAdds) {
      addInput.mutate(
        {
          path: { estimator_id: estimator.id },
          body: {
            key: v.key,
            description: v.description || null,
            parameter_type: v.parameter_type,
          },
        },
        { onError: (err) => toast.error(`Add input failed: ${err.message}`) },
      )
    }
    for (const [inputId, patch] of Object.entries(drafts.inputEdits)) {
      const body: Schemas.UpdateInputRequest = {
        key: patch.key,
        description: patch.description ?? null,
        parameter_type: patch.parameter_type ?? null,
      }
      updateInput.mutate(
        { path: { estimator_id: estimator.id, input_id: inputId }, body },
        { onError: (err) => toast.error(`Input update failed: ${err.message}`) },
      )
    }
    for (const inputId of drafts.pendingInputDeletes) {
      removeInput.mutate(
        { path: { estimator_id: estimator.id, input_id: inputId } },
        { onError: (err) => toast.error(`Delete input failed: ${err.message}`) },
      )
    }

    // Outputs
    for (const v of drafts.pendingOutputAdds) {
      addOutput.mutate(
        {
          path: { estimator_id: estimator.id },
          body: {
            key: v.key,
            expression: v.expression || "0",
            description: v.description || null,
          },
        },
        { onError: (err) => toast.error(`Add output failed: ${err.message}`) },
      )
    }
    for (const [outputId, patch] of Object.entries(drafts.outputEdits)) {
      const body: Schemas.UpdateOutputRequest = {
        key: patch.key,
        expression: patch.expression,
        description: patch.description ?? null,
      }
      updateOutput.mutate(
        { path: { estimator_id: estimator.id, output_id: outputId }, body },
        { onError: (err) => toast.error(`Output update failed: ${err.message}`) },
      )
    }
    for (const outputId of drafts.pendingOutputDeletes) {
      removeOutput.mutate(
        { path: { estimator_id: estimator.id, output_id: outputId } },
        { onError: (err) => toast.error(`Delete output failed: ${err.message}`) },
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

  // ─── Input draft staging ──────────────────────────────────────────────────
  function handleInputPatch(inputId: string, patch: Partial<Schemas.InputResponse>) {
    if (inputId.startsWith(TEMP_PREFIX)) {
      const cur = drafts.pendingInputAdds.find((v) => v.id === inputId)
      if (!cur) return
      drafts.removePendingInput(inputId)
      drafts.addPendingInput({ ...cur, ...patch })
      return
    }
    const server = estimator.inputs.find((v) => v.id === inputId)
    if (!server) return
    const merged = { ...(drafts.inputEdits[inputId] ?? {}), ...patch }
    const allSame =
      (merged.key === undefined || merged.key === server.key) &&
      (merged.description === undefined || merged.description === server.description) &&
      (merged.parameter_type === undefined ||
        JSON.stringify(merged.parameter_type) === JSON.stringify(server.parameter_type))
    if (allSame) {
      drafts.dropInputEdit(inputId)
      return
    }
    drafts.patchInput(inputId, patch)
  }

  function handleAddInput() {
    const tempId = `${TEMP_PREFIX}${crypto.randomUUID()}`
    const n = drafts.pendingInputAdds.length + 1
    drafts.addPendingInput({
      id: tempId,
      key: `input_${n}`,
      description: "",
      parameter_type: { kind: "number" },
    })
  }

  function handleDeleteInput(inputId: string) {
    if (inputId.startsWith(TEMP_PREFIX)) {
      drafts.removePendingInput(inputId)
      return
    }
    drafts.markInputDelete(inputId)
  }

  // ─── Output draft staging ─────────────────────────────────────────────────
  function handleOutputPatch(outputId: string, patch: Partial<Schemas.OutputResponse>) {
    if (outputId.startsWith(TEMP_PREFIX)) {
      const cur = drafts.pendingOutputAdds.find((v) => v.id === outputId)
      if (!cur) return
      drafts.removePendingOutput(outputId)
      drafts.addPendingOutput({ ...cur, ...patch })
      return
    }
    const server = estimator.outputs.find((v) => v.id === outputId)
    if (!server) return
    const merged = { ...(drafts.outputEdits[outputId] ?? {}), ...patch }
    const allSame =
      (merged.key === undefined || merged.key === server.key) &&
      (merged.expression === undefined || merged.expression === server.expression) &&
      (merged.description === undefined || merged.description === server.description)
    if (allSame) {
      drafts.dropOutputEdit(outputId)
      return
    }
    drafts.patchOutput(outputId, patch)
  }

  function handleAddOutput() {
    const tempId = `${TEMP_PREFIX}${crypto.randomUUID()}`
    const n = drafts.pendingOutputAdds.length + 1
    drafts.addPendingOutput({
      id: tempId,
      key: `output_${n}`,
      expression: "0",
      description: "",
    })
  }

  function handleDeleteOutput(outputId: string) {
    if (outputId.startsWith(TEMP_PREFIX)) {
      drafts.removePendingOutput(outputId)
      return
    }
    drafts.markOutputDelete(outputId)
  }

  const ownInputKeys = effectiveInputs.map((i) => i.key)
  const ownOutputKeys = effectiveOutputs.map((o) => o.key)

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

        {/* ─── Inputs ─── */}
        <div className="flex items-center justify-between mt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inputs
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Parameters required to run this estimator. Types: number, boolean, product.
        </p>

        {effectiveInputs.map((i) => (
          <InputCard
            key={i.id}
            input={i}
            onUpdate={handleInputPatch}
            onDelete={handleDeleteInput}
          />
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={handleAddInput}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add input
        </Button>

        {/* ─── Outputs ─── */}
        <div className="flex items-center justify-between mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Outputs
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Variables produced by the calculation. Reference inputs with <code className="font-mono bg-muted px-1 rounded">@input_key</code>.
        </p>

        {effectiveOutputs.map((o) => (
          <OutputCard
            key={o.id}
            output={o}
            ownEstimatorName={estimator.name}
            ownInputKeys={ownInputKeys}
            ownOutputKeys={ownOutputKeys.filter((k) => k !== o.key)}
            availableFieldKeys={availableFieldKeys}
            otherEstimators={otherEstimators}
            estimatorsIndex={estimatorsIndex}
            onUpdate={handleOutputPatch}
            onDelete={handleDeleteOutput}
          />
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={handleAddOutput}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add output
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
