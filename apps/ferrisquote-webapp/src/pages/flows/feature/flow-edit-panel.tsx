import { memo } from "react"
import type { Schemas } from "@/api/api.client"
import {
  useAddField,
  useAddStep,
  useGetFlow,
  useRemoveField,
  useUpdateField,
  useUpdateStep,
} from "@/api/flows.api"
import { useEstimators } from "@/api/estimators.api"
import { AddFieldForm } from "@/pages/flows/ui/edit-panel/add-field-form"
import { AddStepForm } from "@/pages/flows/ui/edit-panel/add-step-form"
import { EditFieldForm } from "@/pages/flows/ui/edit-panel/edit-field-form"
import { EstimatorDetailsPanel } from "@/pages/flows/ui/edit-panel/estimator-details-panel"
import { StepDetailsPanel } from "@/pages/flows/ui/edit-panel/step-details-panel"
import { type PanelState } from "@/pages/flows/ui/edit-panel/panel-state"
import { cn } from "@/lib/utils"

export type { PanelState } from "@/pages/flows/ui/edit-panel/panel-state"

type Props = {
  flowId: string
  state: PanelState | null
  onClose: () => void
  setPanelState: (s: PanelState | null) => void
}

/**
 * Sidenav dispatcher. Self-subscribes to the queries it needs so the parent
 * stays decoupled from flow/estimator cache invalidations.
 *
 * Memoized so unrelated parent rerenders (e.g. flow drawer) don't cascade.
 */
function FlowEditPanelImpl({ flowId, state, onClose, setPanelState }: Props) {
  // Queries
  const { data: flowData } = useGetFlow(flowId)
  const { data: estimatorsData } = useEstimators(flowId)
  const flow = flowData?.data ?? null
  const estimators = estimatorsData?.data?.estimators ?? []

  // Sidenav-side mutations (forms submit → mutation here, parent stays clean)
  const { mutate: addStep } = useAddStep(flowId)
  const { mutate: updateStep } = useUpdateStep(flowId)
  const { mutate: addField } = useAddField(flowId)
  const { mutate: updateField } = useUpdateField(flowId)
  const { mutate: removeField } = useRemoveField(flowId)

  // Derive live panel content from query data + current state
  const step =
    state && "stepId" in state
      ? flow?.steps.find((s) => s.id === state.stepId) ?? null
      : null
  const field =
    state?.mode === "edit-field"
      ? step?.fields.find((f) => f.id === state.fieldId) ?? null
      : null
  const estimator =
    state?.mode === "estimator-details"
      ? estimators.find((e) => e.id === state.estimatorId) ?? null
      : null

  // Autocomplete data
  const availableFieldKeys =
    flow?.steps.flatMap((s) => s.fields.map((f) => f.key)) ?? []
  const otherEstimators = estimators
    .filter((e) => e.id !== estimator?.id)
    .map((e) => ({ id: e.id, name: e.name, variables: e.variables.map((v) => v.name) }))
  const estimatorsIndex = estimators.map((e) => ({ id: e.id, name: e.name }))

  // Form submit handlers (local to the panel)
  const handleAddStep = (data: { title: string; description: string }) => {
    addStep({
      path: { flow_id: flowId },
      body: { title: data.title, description: data.description || null },
    })
  }

  const handleUpdateStep = (stepId: string, data: Schemas.UpdateStepMetadataRequest) => {
    updateStep({ path: { step_id: stepId }, body: data })
  }

  const handleAddField = (
    stepId: string,
    data: { label: string; key: string; config: Schemas.FieldConfigDto },
  ) => {
    addField({
      path: { step_id: stepId },
      body: { label: data.label, key: data.key, config: data.config },
    })
  }

  const handleEditField = (
    fieldId: string,
    _stepId: string,
    data: {
      label?: string
      key?: string
      description?: string | null
      config?: Schemas.FieldConfigDto
    },
  ) => {
    updateField({
      path: { field_id: fieldId },
      body: {
        label: data.label,
        key: data.key,
        description: data.description,
        config: data.config,
      },
    })
  }

  const handleOpenAddField = (stepId: string) => {
    setPanelState({ mode: "add-field", stepId })
  }
  const handleOpenEditField = (fieldId: string, stepId: string) => {
    setPanelState({ mode: "edit-field", fieldId, stepId })
  }

  const handleDeleteField = (fieldId: string, stepId: string) => {
    removeField({ path: { field_id: fieldId } })
    // If the edit panel was on this field, fall back to step-details
    if (state?.mode === "edit-field" && state.fieldId === fieldId) {
      setPanelState({ mode: "step-details", stepId })
    }
  }

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        state ? "w-80" : "w-0",
      )}
    >
      <div className="w-80 h-full border-l bg-background flex flex-col overflow-hidden">
        {state?.mode === "add-step" && (
          <AddStepForm onClose={onClose} onSubmit={handleAddStep} />
        )}
        {state?.mode === "step-details" && step && (
          <StepDetailsPanel
            step={step}
            onClose={onClose}
            onUpdateStep={handleUpdateStep}
            onAddField={handleOpenAddField}
            onEditField={handleOpenEditField}
            onDeleteField={handleDeleteField}
          />
        )}
        {state?.mode === "add-field" && step && (
          <AddFieldForm
            stepId={step.id}
            stepTitle={step.title}
            onClose={onClose}
            onSubmit={handleAddField}
          />
        )}
        {state?.mode === "edit-field" && field && state.stepId && (
          <EditFieldForm
            field={field}
            stepId={state.stepId}
            onClose={onClose}
            onSubmit={handleEditField}
          />
        )}
        {state?.mode === "estimator-details" && estimator && (
          <EstimatorDetailsPanel
            key={estimator.id}
            estimator={estimator}
            flowId={flowId}
            availableFieldKeys={availableFieldKeys}
            otherEstimators={otherEstimators}
            estimatorsIndex={estimatorsIndex}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

export const FlowEditPanel = memo(FlowEditPanelImpl)
