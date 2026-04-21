import { useEffect } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Schemas } from "@/api/api.client"
import { usePreviewFlow } from "@/api/bindings.api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Modal that runs `POST /flows/{id}/evaluate-bindings-preview` and renders
 * both halves of the response: the random submission the backend generated
 * and the evaluation results per binding. Clicking "Run again" triggers a
 * fresh random preview — handy to eyeball behavior over several draws.
 */
export function FlowTestDialog({
  flowId,
  flow,
  estimators,
  bindings,
  open,
  onOpenChange,
}: {
  flowId: string
  flow: Schemas.FlowResponse | null
  estimators: Schemas.EstimatorResponse[]
  bindings: Schemas.BindingResponse[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useTranslation()
  const preview = usePreviewFlow()

  // Fire a preview whenever the dialog opens (or flowId changes while open).
  // The response isn't query-cached on purpose — every open should produce
  // fresh random values, otherwise the test loses value.
  useEffect(() => {
    if (open && flowId) {
      preview.mutate({ path: { flow_id: flowId } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flowId])

  const result = preview.data?.data
  const submission = result?.submission
  const evaluation = result?.evaluation

  // ─── Lookup maps ─────────────────────────────────────────────────────────
  const stepById = new Map(flow?.steps.map((s) => [s.id, s]) ?? [])
  const fieldById = new Map(
    flow?.steps.flatMap((s) => s.fields.map((f) => [f.id, f])) ?? [],
  )
  const bindingById = new Map(bindings.map((b) => [b.id, b]))
  const estById = new Map(estimators.map((e) => [e.id, e]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("test_flow.title")}</DialogTitle>
          <DialogDescription>{t("test_flow.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 -mx-6 px-6">
          {preview.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("test_flow.running")}
            </div>
          )}

          {preview.isError && (
            <p className="text-sm text-destructive">
              {t("test_flow.error", {
                msg: preview.error instanceof Error ? preview.error.message : "",
              })}
            </p>
          )}

          {submission && evaluation && (
            <>
              {/* Random values injected per step/iteration */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("test_flow.inputs_injected")}
                </h3>
                {Object.keys(submission.answers).length === 0 ? (
                  <p className="text-sm text-muted-foreground/70 italic">
                    {t("test_flow.no_inputs")}
                  </p>
                ) : (
                  Object.entries(submission.answers).map(([stepId, iterations]) => {
                    const step = stepById.get(stepId)
                    return (
                      <div
                        key={stepId}
                        className="rounded-md border border-border/60 overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-muted/40 border-b border-border/60">
                          <p className="text-sm font-semibold">
                            {step?.title ?? stepId.slice(0, 8)}
                          </p>
                        </div>
                        <div className="p-3 space-y-2">
                          {iterations.map((iter, idx) => (
                            <div key={idx} className="text-xs space-y-1">
                              {iterations.length > 1 && (
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {t("test_flow.step_iteration", { index: idx + 1 })}
                                </p>
                              )}
                              <ul className="font-mono space-y-0.5">
                                {Object.entries(iter.answers).map(([fieldId, val]) => {
                                  const field = fieldById.get(fieldId)
                                  return (
                                    <li key={fieldId} className="flex items-center gap-2">
                                      <span className="text-muted-foreground">
                                        {field?.label ?? field?.key ?? fieldId.slice(0, 8)}
                                      </span>
                                      <span className="text-foreground">=</span>
                                      <span className="text-foreground font-semibold">
                                        {formatFieldValue(val)}
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </section>

              {/* Binding results */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("test_flow.results")}
                </h3>
                {Object.keys(evaluation.bindings).length === 0 ? (
                  <p className="text-sm text-muted-foreground/70 italic">
                    {t("test_flow.no_results")}
                  </p>
                ) : (
                  Object.entries(evaluation.bindings).map(([bid, outs]) => {
                    const binding = bindingById.get(bid)
                    const est = binding ? estById.get(binding.estimator_id) : undefined
                    return (
                      <div
                        key={bid}
                        className="rounded-md border border-border/60 overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-muted/40 border-b border-border/60">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: "hsl(330, 80%, 60%)" }}
                          >
                            {est?.name.replace(/_/g, " ") ?? bid.slice(0, 8)}
                          </p>
                        </div>
                        <ul className="p-3 text-sm font-mono space-y-1">
                          {Object.entries(outs).map(([key, val]) => (
                            <li key={key} className="flex items-center gap-2">
                              <span className="text-muted-foreground">{key}</span>
                              <span>=</span>
                              <span className="font-semibold">{formatNumber(val)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })
                )}
              </section>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={preview.isPending || !flowId}
            onClick={() => preview.mutate({ path: { flow_id: flowId } })}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {t("test_flow.run_again")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatFieldValue(v: unknown): string {
  if (typeof v === "number") return formatNumber(v)
  if (typeof v === "boolean") return v ? "✓" : "✗"
  if (Array.isArray(v)) return v.join(", ")
  if (typeof v === "string") return v
  return JSON.stringify(v)
}

function formatNumber(n: number): string {
  // 2 decimals when non-integer, clean display when integer.
  return Number.isInteger(n) ? n.toString() : n.toFixed(2)
}
