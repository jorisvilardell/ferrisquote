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
  // Display form uses spaces in place of underscores; commit replaces them back.
  const [name, setName] = useState(estimator.name.replace(/_/g, " "))
  const [description, setDescription] = useState(estimator.description)

  useEffect(() => {
    setName(estimator.name.replace(/_/g, " "))
    setEditingName(false)
  }, [estimator.id, estimator.name])

  useEffect(() => {
    setDescription(estimator.description)
  }, [estimator.id, estimator.description])

  const updateEstimator = useUpdateEstimator(flowId, estimator.id)
  const addVariable = useAddVariable(flowId, estimator.id)
  const updateVariable = useUpdateVariable(flowId, estimator.id)
  const removeVariable = useRemoveVariable(flowId, estimator.id)

  const commitDescription = () => {
    if (description === estimator.description) return
    updateEstimator.mutate(
      { path: { estimator_id: estimator.id }, body: { description } },
      { onError: (err) => toast.error(`Update failed: ${err.message}`) },
    )
  }

  const commitName = (next: string) => {
    const trimmed = next.trim().replace(/\s+/g, "_")
    if (!trimmed) return
    if (trimmed === estimator.name) return
    if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
      toast.error("Estimator name can only contain letters, digits, spaces and underscores")
      setName(estimator.name.replace(/_/g, " "))
      return
    }
    // Prevent duplicate names: would break cross-ref name→id lookup
    if (otherEstimators.some((e) => e.name === trimmed)) {
      toast.error(`An estimator named "${trimmed.replace(/_/g, " ")}" already exists`)
      setName(estimator.name.replace(/_/g, " "))
      return
    }
    updateEstimator.mutate(
      { path: { estimator_id: estimator.id }, body: { name: trimmed } },
      { onError: (err) => toast.error(`Rename failed: ${err.message}`) },
    )
  }

  const handleAddVariable = () => {
    addVariable.mutate(
      {
        path: { estimator_id: estimator.id },
        body: { name: "new_var", expression: "0", description: null },
      },
      { onError: (err) => toast.error(`Add variable failed: ${err.message}`) },
    )
  }

  const handleUpdateVariable = (variableId: string, patch: Partial<Schemas.VariableResponse>) => {
    const body: Schemas.UpdateVariableRequest = {
      name: patch.name,
      expression: patch.expression,
      description: patch.description ?? null,
    }
    updateVariable.mutate(
      { path: { variable_id: variableId }, body },
      { onError: (err) => toast.error(`Update failed: ${err.message}`) },
    )
  }

  const handleDeleteVariable = (variableId: string) => {
    removeVariable.mutate(
      { path: { variable_id: variableId } },
      { onError: (err) => toast.error(`Delete failed: ${err.message}`) },
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b shrink-0">
        {editingName ? (
          <Input
            autoFocus
            className="flex-1 !text-base font-semibold h-7 rounded-sm border border-border/60 bg-transparent px-2 py-0 shadow-none focus-visible:border-border focus-visible:ring-0"
            style={{ color: ROSE }}
            value={name}
            onChange={(e) => {
              const allowed = e.target.value.replace(/[^A-Za-z0-9_ ]/g, "")
              setName(allowed)
            }}
            onBlur={() => {
              commitName(name)
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitName(name)
                setEditingName(false)
              }
              if (e.key === "Escape") {
                setName(estimator.name.replace(/_/g, " "))
                setEditingName(false)
              }
            }}
          />
        ) : (
          <button
            className="flex-1 text-left text-base font-semibold truncate hover:opacity-80 transition-opacity cursor-text"
            style={{ color: ROSE }}
            onClick={() => setEditingName(true)}
          >
            {estimator.name.replace(/_/g, " ")}
          </button>
        )}
        {!editingName && (
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 px-5 py-4 flex-1 overflow-y-auto pb-72">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estimator-desc" className="text-xs font-medium">
            Description
          </Label>
          <Textarea
            id="estimator-desc"
            rows={2}
            placeholder="Optional — describe this estimator"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Variables are evaluated in dependency order. Reference fields with <code className="font-mono bg-muted px-1 rounded">@field_key</code>.
        </p>

        {estimator.variables.map((v) => (
          <VariableCard
            key={v.id}
            variable={v}
            ownEstimatorName={estimator.name}
            ownEstimatorVariables={estimator.variables
              .filter((ov) => ov.id !== v.id)
              .map((ov) => ov.name)}
            availableFieldKeys={availableFieldKeys}
            otherEstimators={otherEstimators}
            estimatorsIndex={estimatorsIndex}
            onUpdate={handleUpdateVariable}
            onDelete={handleDeleteVariable}
          />
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={handleAddVariable}
          disabled={addVariable.isPending}
        >
          {addVariable.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5 mr-1.5" />
          )}
          Add variable
        </Button>
      </div>
    </>
  )
}
