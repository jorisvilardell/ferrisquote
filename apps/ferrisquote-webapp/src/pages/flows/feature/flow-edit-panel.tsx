import type { Schemas } from "@/api/api.client"
import { type EstimatorIndex } from "@/pages/flows/lib/expression-refs"
import { AddFieldForm } from "@/pages/flows/ui/edit-panel/add-field-form"
import { AddStepForm } from "@/pages/flows/ui/edit-panel/add-step-form"
import { EditFieldForm } from "@/pages/flows/ui/edit-panel/edit-field-form"
import { EstimatorDetailsPanel } from "@/pages/flows/ui/edit-panel/estimator-details-panel"
import { StepDetailsPanel } from "@/pages/flows/ui/edit-panel/step-details-panel"
import { type PanelState } from "@/pages/flows/ui/edit-panel/panel-state"
import { cn } from "@/lib/utils"

export type { PanelState } from "@/pages/flows/ui/edit-panel/panel-state"

type Props = {
  state: PanelState | null
  step: Schemas.StepResponse | null
  field: Schemas.FieldResponse | null
  estimator: Schemas.EstimatorResponse | null
  flowId: string
  availableFieldKeys: string[]
  otherEstimators: Array<{ id: string; name: string; variables: string[] }>
  estimatorsIndex: EstimatorIndex
  onClose: () => void
  onAddStep: (data: { title: string; description: string }) => void
  onUpdateStep: (stepId: string, data: Schemas.UpdateStepMetadataRequest) => void
  onAddField: (
    stepId: string,
    data: { label: string; key: string; config: Schemas.FieldConfigDto },
  ) => void
  onEditField: (
    fieldId: string,
    stepId: string,
    data: {
      label?: string
      key?: string
      description?: string | null
      config?: Schemas.FieldConfigDto
    },
  ) => void
  onDeleteField: (fieldId: string, stepId: string) => void
  onOpenAddField: (stepId: string) => void
  onOpenEditField: (fieldId: string, stepId: string) => void
}

/**
 * Dispatches the right form/panel based on the current `state.mode`.
 * Each concrete panel lives in `ui/edit-panel/*` and has no canvas awareness.
 */
export function FlowEditPanel({
  state,
  step,
  field,
  estimator,
  flowId,
  availableFieldKeys,
  otherEstimators,
  estimatorsIndex,
  onClose,
  onAddStep,
  onUpdateStep,
  onAddField,
  onEditField,
  onDeleteField,
  onOpenAddField,
  onOpenEditField,
}: Props) {
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        state ? "w-80" : "w-0",
      )}
    >
      <div className="w-80 h-full border-l bg-background flex flex-col overflow-hidden">
        {state?.mode === "add-step" && (
          <AddStepForm onClose={onClose} onSubmit={onAddStep} />
        )}
        {state?.mode === "step-details" && step && (
          <StepDetailsPanel
            step={step}
            onClose={onClose}
            onUpdateStep={onUpdateStep}
            onAddField={onOpenAddField}
            onEditField={onOpenEditField}
            onDeleteField={onDeleteField}
          />
        )}
        {state?.mode === "add-field" && step && (
          <AddFieldForm
            stepId={step.id}
            stepTitle={step.title}
            onClose={onClose}
            onSubmit={onAddField}
          />
        )}
        {state?.mode === "edit-field" && field && state.stepId && (
          <EditFieldForm
            field={field}
            stepId={state.stepId}
            onClose={onClose}
            onSubmit={onEditField}
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
