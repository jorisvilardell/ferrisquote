import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { Schemas } from "@/api/api.client"
import type { PanelState } from "@/pages/flows/ui/edit-panel/panel-state"

type DeleteStepMutation = (params: { path: { step_id: string } }) => void
type DeleteFieldMutation = (params: { path: { field_id: string } }) => void
type DeleteEstimatorMutation = (
  params: { path: { estimator_id: string } },
  options: { onError: (err: Error) => void },
) => void

type DeletingFieldState = { id: string; label: string; stepId: string } | null
type DeletingEstimatorState = { id: string; name: string } | null

/**
 * Centralizes delete confirmation state for steps, fields and estimators.
 * Also handles the post-delete cleanup (closing the right panel when the
 * deleted item was the one being edited).
 */
export function useDeleteDialogs(args: {
  flow: Schemas.FlowResponse | null
  estimators: Schemas.EstimatorResponse[]
  panelState: PanelState | null
  setPanelState: (s: PanelState | null) => void
  removeStep: DeleteStepMutation
  removeField: DeleteFieldMutation
  deleteEstimator: DeleteEstimatorMutation
}) {
  const {
    flow,
    estimators,
    panelState,
    setPanelState,
    removeStep,
    removeField,
    deleteEstimator,
  } = args

  const [deletingStep, setDeletingStep] = useState<Schemas.StepResponse | null>(null)
  const [deletingField, setDeletingField] = useState<DeletingFieldState>(null)
  const [deletingEstimator, setDeletingEstimator] = useState<DeletingEstimatorState>(null)

  // ─── Step ────────────────────────────────────────────────────────────────
  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const step = flow?.steps.find((s) => s.id === stepId) ?? null
      setDeletingStep(step)
    },
    [flow],
  )

  const confirmDeleteStep = useCallback(() => {
    if (!deletingStep) return
    removeStep({ path: { step_id: deletingStep.id } })
    if (
      panelState &&
      "stepId" in panelState &&
      panelState.stepId === deletingStep.id
    ) {
      setPanelState(null)
    }
    setDeletingStep(null)
  }, [deletingStep, removeStep, panelState, setPanelState])

  // ─── Field ───────────────────────────────────────────────────────────────
  const handleDeleteField = useCallback(
    (fieldId: string, stepId: string) => {
      const step = flow?.steps.find((s) => s.id === stepId)
      const field = step?.fields.find((f) => f.id === fieldId)
      setDeletingField({ id: fieldId, label: field?.label ?? "this field", stepId })
    },
    [flow],
  )

  const confirmDeleteField = useCallback(() => {
    if (!deletingField) return
    removeField({ path: { field_id: deletingField.id } })
    if (panelState?.mode === "edit-field" && panelState.fieldId === deletingField.id) {
      setPanelState({ mode: "step-details", stepId: deletingField.stepId })
    }
    setDeletingField(null)
  }, [deletingField, removeField, panelState, setPanelState])

  // ─── Estimator ───────────────────────────────────────────────────────────
  const handleDeleteEstimator = useCallback(
    (estimatorId: string) => {
      const est = estimators.find((e) => e.id === estimatorId)
      setDeletingEstimator({ id: estimatorId, name: est?.name ?? "this estimator" })
    },
    [estimators],
  )

  const confirmDeleteEstimator = useCallback(() => {
    if (!deletingEstimator) return
    deleteEstimator(
      { path: { estimator_id: deletingEstimator.id } },
      { onError: (err) => toast.error(`Failed to delete estimator: ${err.message}`) },
    )
    if (
      panelState?.mode === "estimator-details" &&
      panelState.estimatorId === deletingEstimator.id
    ) {
      setPanelState(null)
    }
    setDeletingEstimator(null)
  }, [deletingEstimator, deleteEstimator, panelState, setPanelState])

  const reset = useCallback(() => {
    setDeletingStep(null)
    setDeletingField(null)
    setDeletingEstimator(null)
  }, [])

  return {
    // state
    deletingStep,
    deletingField,
    deletingEstimator,
    // setters (for dialog close)
    setDeletingStep,
    setDeletingField,
    setDeletingEstimator,
    // handlers (open dialog)
    handleDeleteStep,
    handleDeleteField,
    handleDeleteEstimator,
    // confirm actions
    confirmDeleteStep,
    confirmDeleteField,
    confirmDeleteEstimator,
    reset,
  }
}
