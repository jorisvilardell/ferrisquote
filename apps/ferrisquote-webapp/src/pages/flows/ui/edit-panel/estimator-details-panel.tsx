import { useEffect, useMemo, useState } from "react"
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
import { useUpdateBinding } from "@/api/bindings.api"
import { type EstimatorIndex } from "@/pages/flows/lib/expression-refs"
import {
  TEMP_PREFIX,
  useEstimatorDraftStore,
} from "@/pages/flows/feature/estimator-draft-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { InputCard } from "./input-card"
import { OutputCard } from "./output-card"

const ROSE = "hsl(330, 80%, 60%)"
const EMERALD = "hsl(158, 64%, 52%)"

// OpenAPI generator widens these to `Record<string, unknown>` — we restore the
// real wire shape locally instead of leaking `unknown` through the UI.
type InputsMap = Record<string, Schemas.InputBindingValueDto>
type ReduceMap = Record<string, Schemas.AggregationStrategyDto>

export function EstimatorDetailsPanel({
  estimator,
  flowId,
  flow,
  binding,
  otherBindings,
  availableFieldKeys,
  otherEstimators,
  estimatorsIndex,
  onClose,
}: {
  estimator: Schemas.EstimatorResponse
  flowId: string
  flow: Schemas.FlowResponse
  /** Optional — unified panel also edits the binding's wiring when one exists. */
  binding: Schemas.BindingResponse | null
  otherBindings: Schemas.BindingResponse[]
  availableFieldKeys: string[]
  otherEstimators: Array<{ id: string; name: string; outputs: string[] }>
  estimatorsIndex: EstimatorIndex
  onClose: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  // Accordion-style: only one input or output card expanded at a time.
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  const toggleCard = (id: string) =>
    setExpandedCardId((prev) => (prev === id ? null : id))

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

  // Reset the accordion when switching estimators.
  useEffect(() => {
    setExpandedCardId(null)
  }, [estimator.id])

  const updateEstimator = useUpdateEstimator(flowId, estimator.id)
  const addInput = useAddInput(flowId, estimator.id)
  const updateInput = useUpdateInput(flowId, estimator.id)
  const removeInput = useRemoveInput(flowId, estimator.id)
  const addOutput = useAddOutput(flowId, estimator.id)
  const updateOutput = useUpdateOutput(flowId, estimator.id)
  const removeOutput = useRemoveOutput(flowId, estimator.id)
  const updateBinding = useUpdateBinding(flowId)

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

  // ─── Binding wiring local state ──────────────────────────────────────────
  const serverInputsMap = (binding?.inputs_mapping ?? {}) as InputsMap
  const serverReduceMap = (binding?.outputs_reduce_strategy ?? {}) as ReduceMap
  const serverMapOver = binding?.map_over_step ?? null

  const [mapOverStep, setMapOverStep] = useState<string | null>(serverMapOver)
  const [inputsMapping, setInputsMapping] = useState<InputsMap>(serverInputsMap)
  const [reduceMap, setReduceMap] = useState<ReduceMap>(serverReduceMap)

  useEffect(() => {
    setMapOverStep(serverMapOver)
    setInputsMapping(serverInputsMap)
    setReduceMap(serverReduceMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding?.id])

  const allFields = useMemo(
    () =>
      flow.steps.flatMap((s) =>
        s.fields.map((f) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          stepId: s.id,
          numeric: f.config.type === "number",
        })),
      ),
    [flow.steps],
  )

  const repeatableSteps = useMemo(
    () => flow.steps.filter((s) => s.is_repeatable),
    [flow.steps],
  )

  // Resolve the *current* (draft-aware) key for an input id — bindings are
  // keyed by input.key, so renaming an input must rekey the binding's
  // inputs_mapping in step. Same idea for outputs → reduceMap.
  function currentInputKey(inputId: string): string | null {
    const temp = drafts.pendingInputAdds.find((v) => v.id === inputId)
    if (temp) return temp.key
    const edit = drafts.inputEdits[inputId]?.key
    const server = estimator.inputs.find((v) => v.id === inputId)
    return edit ?? server?.key ?? null
  }

  function currentOutputKey(outputId: string): string | null {
    const temp = drafts.pendingOutputAdds.find((v) => v.id === outputId)
    if (temp) return temp.key
    const edit = drafts.outputEdits[outputId]?.key
    const server = estimator.outputs.find((v) => v.id === outputId)
    return edit ?? server?.key ?? null
  }

  // ─── Validation + dirty detection ────────────────────────────────────────
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

  const bindingDirty =
    binding != null &&
    (mapOverStep !== serverMapOver ||
      JSON.stringify(inputsMapping) !== JSON.stringify(serverInputsMap) ||
      JSON.stringify(reduceMap) !== JSON.stringify(serverReduceMap))

  const isDirty =
    nameDirty ||
    descDirty ||
    inputEditsDirty ||
    inputAddsDirty ||
    inputDelsDirty ||
    outputEditsDirty ||
    outputAddsDirty ||
    outputDelsDirty ||
    bindingDirty

  const canSave =
    isDirty && nameValid && !duplicateName && normalizedName.length > 0

  // ─── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!canSave) return

    // Estimator signature must land BEFORE the binding update — binding
    // validation runs against the live estimator state on the server, so a
    // rename-then-rewire flow would fail the binding PUT otherwise.
    const signaturePromises: Promise<unknown>[] = []

    if (nameDirty || descDirty) {
      const body: Schemas.UpdateEstimatorRequest = {}
      if (nameDirty) body.name = normalizedName
      if (descDirty) body.description = drafts.descDraft ?? ""
      signaturePromises.push(
        updateEstimator.mutateAsync({ path: { estimator_id: estimator.id }, body }),
      )
    }

    for (const v of drafts.pendingInputAdds) {
      signaturePromises.push(
        addInput.mutateAsync({
          path: { estimator_id: estimator.id },
          body: {
            key: v.key,
            description: v.description || null,
            parameter_type: v.parameter_type,
          },
        }),
      )
    }
    for (const [inputId, patch] of Object.entries(drafts.inputEdits)) {
      signaturePromises.push(
        updateInput.mutateAsync({
          path: { estimator_id: estimator.id, input_id: inputId },
          body: {
            key: patch.key,
            description: patch.description ?? null,
            parameter_type: patch.parameter_type ?? null,
          },
        }),
      )
    }
    for (const inputId of drafts.pendingInputDeletes) {
      signaturePromises.push(
        removeInput.mutateAsync({
          path: { estimator_id: estimator.id, input_id: inputId },
        }),
      )
    }

    for (const v of drafts.pendingOutputAdds) {
      signaturePromises.push(
        addOutput.mutateAsync({
          path: { estimator_id: estimator.id },
          body: {
            key: v.key,
            expression: v.expression || "0",
            description: v.description || null,
          },
        }),
      )
    }
    for (const [outputId, patch] of Object.entries(drafts.outputEdits)) {
      signaturePromises.push(
        updateOutput.mutateAsync({
          path: { estimator_id: estimator.id, output_id: outputId },
          body: {
            key: patch.key,
            expression: patch.expression,
            description: patch.description ?? null,
          },
        }),
      )
    }
    for (const outputId of drafts.pendingOutputDeletes) {
      signaturePromises.push(
        removeOutput.mutateAsync({
          path: { estimator_id: estimator.id, output_id: outputId },
        }),
      )
    }

    try {
      await Promise.all(signaturePromises)
    } catch (err) {
      toast.error(`Signature update failed: ${(err as Error).message}`)
      return
    }

    if (bindingDirty && binding) {
      // Rebuild the mapping keyed strictly by the *current* input/output
      // keys. This guards against any stale entries that the live rekey
      // might have missed (double renames, server refetch races, etc.) and
      // drops entries that point to deleted inputs/outputs.
      const finalInputsMapping: InputsMap = {}
      for (const inp of effectiveInputs) {
        const serverKey = estimator.inputs.find((s) => s.id === inp.id)?.key
        const entry =
          inputsMapping[inp.key] ??
          (serverKey ? inputsMapping[serverKey] : undefined)
        if (entry) finalInputsMapping[inp.key] = entry
      }

      const finalReduceMap: ReduceMap = {}
      for (const out of effectiveOutputs) {
        const serverKey = estimator.outputs.find((s) => s.id === out.id)?.key
        const strat =
          reduceMap[out.key] ?? (serverKey ? reduceMap[serverKey] : undefined)
        if (strat) finalReduceMap[out.key] = strat
      }

      try {
        await updateBinding.mutateAsync({
          path: { flow_id: flowId, binding_id: binding.id },
          body: {
            inputs_mapping: finalInputsMapping,
            outputs_reduce_strategy: finalReduceMap,
            map_over_step: mapOverStep,
          },
        })
      } catch (err) {
        toast.error(`Wiring update failed: ${(err as Error).message}`)
        return
      }
    }

    drafts.clear()
    drafts.setActive(estimator.id)
  }

  function handleCancel() {
    drafts.clear()
    drafts.setActive(estimator.id)
    setEditingName(false)
    setMapOverStep(serverMapOver)
    setInputsMapping(serverInputsMap)
    setReduceMap(serverReduceMap)
  }

  // ─── Input/Output draft staging ──────────────────────────────────────────
  function handleInputPatch(inputId: string, patch: Partial<Schemas.InputResponse>) {
    // Rename cascade: input key changed → rekey any binding entry that used
    // the previous key so the PUT body matches the new signature.
    if (patch.key !== undefined) {
      const oldKey = currentInputKey(inputId)
      const newKey = patch.key
      if (oldKey && newKey && oldKey !== newKey) {
        setInputsMapping((prev) => {
          if (!(oldKey in prev)) return prev
          const next = { ...prev }
          next[newKey] = next[oldKey]
          delete next[oldKey]
          return next
        })
      }
    }

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
    setExpandedCardId(tempId)
  }

  function handleDeleteInput(inputId: string) {
    const key = currentInputKey(inputId)
    if (inputId.startsWith(TEMP_PREFIX)) {
      drafts.removePendingInput(inputId)
    } else {
      drafts.markInputDelete(inputId)
    }
    if (key) {
      setInputsMapping((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
    setExpandedCardId((prev) => (prev === inputId ? null : prev))
  }

  function handleOutputPatch(outputId: string, patch: Partial<Schemas.OutputResponse>) {
    if (patch.key !== undefined) {
      const oldKey = currentOutputKey(outputId)
      const newKey = patch.key
      if (oldKey && newKey && oldKey !== newKey) {
        setReduceMap((prev) => {
          if (!(oldKey in prev)) return prev
          const next = { ...prev }
          next[newKey] = next[oldKey]
          delete next[oldKey]
          return next
        })
      }
    }

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
    setExpandedCardId(tempId)
  }

  function handleDeleteOutput(outputId: string) {
    const key = currentOutputKey(outputId)
    if (outputId.startsWith(TEMP_PREFIX)) {
      drafts.removePendingOutput(outputId)
    } else {
      drafts.markOutputDelete(outputId)
    }
    if (key) {
      setReduceMap((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
    setExpandedCardId((prev) => (prev === outputId ? null : prev))
  }

  const ownInputKeys = effectiveInputs.map((i) => i.key)
  const ownOutputKeys = effectiveOutputs.map((o) => o.key)

  // ─── Wiring helpers ──────────────────────────────────────────────────────
  function currentSelectValue(inputKey: string): string {
    const v = inputsMapping[inputKey]
    if (!v) return ""
    if (v.source === "field") return `field:${v.field_id}`
    if (v.source === "binding_output") return `binding:${v.binding_id}.${v.output_key}`
    return ""
  }

  function handleSourceChange(inputKey: string, raw: string, numericOnly: boolean) {
    if (raw === "__unset__") {
      setInputsMapping((prev) => {
        const next = { ...prev }
        delete next[inputKey]
        return next
      })
      return
    }
    if (raw.startsWith("field:")) {
      const fid = raw.slice("field:".length)
      const meta = allFields.find((f) => f.id === fid)
      if (!meta) return
      if (numericOnly && !meta.numeric) {
        toast.error(`Field '${meta.key}' is not numeric`)
        return
      }
      setInputsMapping((prev) => ({ ...prev, [inputKey]: { source: "field", field_id: fid } }))
    } else if (raw.startsWith("binding:")) {
      const [bid, okey] = raw.slice("binding:".length).split(".", 2)
      setInputsMapping((prev) => ({
        ...prev,
        [inputKey]: { source: "binding_output", binding_id: bid, output_key: okey },
      }))
    }
  }

  function setReduceStrategy(outputKey: string, strategy: Schemas.AggregationStrategyDto) {
    setReduceMap((prev) => ({ ...prev, [outputKey]: strategy }))
  }

  const hasInputs = effectiveInputs.length > 0
  const showReduce = mapOverStep !== null && effectiveOutputs.length > 0

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

      <div className="flex flex-col gap-3 px-5 py-4 flex-1 min-h-0 overflow-y-auto pb-4">
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
        <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </h3>
        <p className="text-xs text-muted-foreground">
          Parameters required to run this estimator. Types: number, boolean, product.
        </p>

        {effectiveInputs.map((i) => (
          <InputCard
            key={i.id}
            input={i}
            expanded={expandedCardId === i.id}
            onToggle={() => toggleCard(i.id)}
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
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Outputs
        </h3>
        <p className="text-xs text-muted-foreground">
          Variables produced by the calculation. Reference inputs with <code className="font-mono bg-muted px-1 rounded">@input_key</code>.
        </p>

        {effectiveOutputs.map((o) => (
          <OutputCard
            key={o.id}
            output={o}
            expanded={expandedCardId === o.id}
            onToggle={() => toggleCard(o.id)}
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

        {/* ─── Execution context ─── */}
        {binding && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Execution context
            </h3>
            <p className="text-xs text-muted-foreground">
              Run once, or loop over each iteration of a repeatable step.
            </p>
            <Select
              value={mapOverStep ?? "__global__"}
              onValueChange={(v) => setMapOverStep(v === "__global__" ? null : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Global execution</SelectItem>
                {repeatableSteps.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No repeatable steps in this flow
                  </SelectItem>
                ) : (
                  repeatableSteps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Loop over: {s.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </>
        )}

        {/* ─── Argument mapping ─── */}
        {binding && hasInputs && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Arguments
            </h3>
            <p className="text-xs text-muted-foreground">
              Map each input to a flow field or another binding's output.
            </p>

            {effectiveInputs.map((input) => {
              const numericOnly = input.parameter_type.kind !== "product"
              return (
                <div
                  key={`wiring-${input.id}`}
                  className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2"
                >
                  <Label className="text-xs">
                    <span className="font-mono font-semibold" style={{ color: EMERALD }}>
                      {input.key}
                    </span>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      : {input.parameter_type.kind}
                      {input.parameter_type.kind === "product" && input.parameter_type.label_filter
                        ? ` (${input.parameter_type.label_filter})`
                        : ""}
                    </span>
                  </Label>
                  <Select
                    value={currentSelectValue(input.key) || "__unset__"}
                    onValueChange={(raw) => handleSourceChange(input.key, raw, numericOnly)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">— Not mapped —</SelectItem>
                      {allFields
                        .filter((f) => !numericOnly || f.numeric)
                        .map((f) => (
                          <SelectItem key={`f-${f.id}`} value={`field:${f.id}`}>
                            Field: {f.label || f.key}
                          </SelectItem>
                        ))}
                      {otherBindings.flatMap((b) =>
                        Object.keys(b.outputs_reduce_strategy as ReduceMap).map((key) => (
                          <SelectItem
                            key={`b-${b.id}-${key}`}
                            value={`binding:${b.id}.${key}`}
                          >
                            Binding {b.id.slice(0, 8)} → {key}
                          </SelectItem>
                        )),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </>
        )}

        {/* ─── Reduce ─── */}
        {binding && showReduce && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reduce
            </h3>
            <p className="text-xs text-muted-foreground">
              How to aggregate each output across iterations of the loop.
            </p>

            {effectiveOutputs.map((out) => (
              <div
                key={`reduce-${out.id}`}
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2"
              >
                <span
                  className="text-xs font-mono font-semibold flex-1 min-w-0 truncate"
                  style={{ color: ROSE }}
                >
                  {out.key}
                </span>
                <Select
                  value={reduceMap[out.key] ?? "first"}
                  onValueChange={(v) =>
                    setReduceStrategy(out.key, v as Schemas.AggregationStrategyDto)
                  }
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="first">First</SelectItem>
                    <SelectItem value="last">Last</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </>
        )}
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
