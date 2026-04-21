import type { Schemas } from "@/api/api.client"

/**
 * Live validation model for the flow canvas. Mirrors the backend guards
 * in `BindingServiceImpl::validate_binding` +
 * `FlowEvaluationServiceImpl::evaluate_flow_bindings` so users see the same
 * errors in the editor that the API would raise on `/evaluate-bindings`.
 *
 * Diagnostics are POJOs — the canvas consumes them to tag edges, badge
 * nodes, and populate the toolbar counter.
 */

export type Diagnostic =
  | {
      kind: "unmapped_input"
      bindingId: string
      estimatorId: string
      inputKey: string
    }
  | {
      kind: "dangling_field_ref"
      bindingId: string
      estimatorId: string
      inputKey: string
      fieldId: string
    }
  | {
      kind: "dangling_binding_ref"
      bindingId: string
      estimatorId: string
      inputKey: string
      upstreamBindingId: string
      outputKey: string
      reason: "missing_binding" | "missing_output"
    }
  | {
      kind: "missing_map_step"
      bindingId: string
      estimatorId: string
      stepId: string
    }
  | {
      kind: "map_step_not_repeatable"
      bindingId: string
      estimatorId: string
      stepId: string
    }
  | {
      kind: "invalid_expression"
      estimatorId: string
      outputKey: string
      outputId: string
      reason: "missing_ref" | "empty"
      detail?: string
    }
  | {
      kind: "cycle_between_bindings"
      bindingIds: string[]
      estimatorIds: string[]
    }
  | {
      kind: "type_mismatch"
      bindingId: string
      estimatorId: string
      inputKey: string
      fieldId: string
      expected: "number" | "boolean" | "product"
      actual: string
    }
  | {
      kind: "missing_estimator"
      bindingId: string
      /** The dangling id the binding still points to. */
      estimatorId: string
    }

type InputMapping = Record<string, Schemas.InputBindingValueDto>

const EXPR_REF_REGEX = /@([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?)/g
const CROSS_REF_REGEX = /@#[A-Za-z0-9-]+\.[A-Za-z0-9_]+/g

/** Extract bare `@name` tokens from an expression (strips `@#<uuid>.var`
 *  cross-refs first so they don't pollute the bare set). */
export function extractBareRefs(expr: string): string[] {
  const stripped = expr.replace(CROSS_REF_REGEX, "")
  const out = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = EXPR_REF_REGEX.exec(stripped)) !== null) {
    // m[1] includes nothing after `.` here because cross-refs were stripped
    const token = m[1]
    if (!token.includes(".")) out.add(token)
  }
  return [...out]
}

export function computeDiagnostics(
  flow: Schemas.FlowResponse,
  estimators: Schemas.EstimatorResponse[],
  bindings: Schemas.BindingResponse[],
): Diagnostic[] {
  const out: Diagnostic[] = []

  const estById = new Map(estimators.map((e) => [e.id, e]))
  const bindingById = new Map(bindings.map((b) => [b.id, b]))
  const stepById = new Map(flow.steps.map((s) => [s.id, s]))
  const fieldById = new Map(
    flow.steps.flatMap((s) =>
      s.fields.map((f) => [f.id, { field: f, stepId: s.id }] as const),
    ),
  )

  // ─── Per-binding validation ──────────────────────────────────────────────
  for (const binding of bindings) {
    const est = estById.get(binding.estimator_id)
    if (!est) {
      // Binding points to a deleted estimator — backend eval will return
      // 404. Surface it here so the user sees the issue without running
      // the preview first.
      out.push({
        kind: "missing_estimator",
        bindingId: binding.id,
        estimatorId: binding.estimator_id,
      })
      continue
    }
    const mapping = binding.inputs_mapping as InputMapping

    // Unmapped inputs: estimator declares an input key not present in mapping
    for (const input of est.inputs) {
      if (!(input.key in mapping)) {
        out.push({
          kind: "unmapped_input",
          bindingId: binding.id,
          estimatorId: est.id,
          inputKey: input.key,
        })
      }
    }

    // Mapping sources that resolve to dangling targets
    for (const [inputKey, source] of Object.entries(mapping)) {
      if (source.source === "field") {
        const target = fieldById.get(source.field_id)
        if (!target) {
          out.push({
            kind: "dangling_field_ref",
            bindingId: binding.id,
            estimatorId: est.id,
            inputKey,
            fieldId: source.field_id,
          })
          continue
        }
        // Type mismatch: estimator expects number/boolean/product but the
        // linked field is a non-numeric kind. Product inputs accept any
        // field type so they don't trigger this check.
        const input = est.inputs.find((i) => i.key === inputKey)
        if (!input) continue
        const expected = input.parameter_type.kind
        const actual = target.field.config.type
        if (expected === "number" && actual !== "number") {
          out.push({
            kind: "type_mismatch",
            bindingId: binding.id,
            estimatorId: est.id,
            inputKey,
            fieldId: source.field_id,
            expected,
            actual,
          })
        } else if (expected === "boolean" && actual !== "boolean") {
          out.push({
            kind: "type_mismatch",
            bindingId: binding.id,
            estimatorId: est.id,
            inputKey,
            fieldId: source.field_id,
            expected,
            actual,
          })
        }
      } else if (source.source === "binding_output") {
        const upstream = bindingById.get(source.binding_id)
        if (!upstream) {
          out.push({
            kind: "dangling_binding_ref",
            bindingId: binding.id,
            estimatorId: est.id,
            inputKey,
            upstreamBindingId: source.binding_id,
            outputKey: source.output_key,
            reason: "missing_binding",
          })
          continue
        }
        const upstreamEst = estById.get(upstream.estimator_id)
        const hasOutput = upstreamEst?.outputs.some(
          (o) => o.key === source.output_key,
        )
        if (!hasOutput) {
          out.push({
            kind: "dangling_binding_ref",
            bindingId: binding.id,
            estimatorId: est.id,
            inputKey,
            upstreamBindingId: source.binding_id,
            outputKey: source.output_key,
            reason: "missing_output",
          })
        }
      }
    }

    // map_over_step validity
    if (binding.map_over_step) {
      const step = stepById.get(binding.map_over_step)
      if (!step) {
        out.push({
          kind: "missing_map_step",
          bindingId: binding.id,
          estimatorId: est.id,
          stepId: binding.map_over_step,
        })
      } else if (!step.is_repeatable) {
        out.push({
          kind: "map_step_not_repeatable",
          bindingId: binding.id,
          estimatorId: est.id,
          stepId: binding.map_over_step,
        })
      }
    }
  }

  // ─── Per-estimator expression validation ─────────────────────────────────
  // The backend eval context only binds estimator inputs + sibling outputs.
  // Flow field keys (e.g. `@superficie`) look like valid `@refs` to the
  // user but blow up at eval time — flag them as missing so the user sees
  // the issue before hitting `/evaluate-bindings-preview`.
  for (const est of estimators) {
    const inputKeys = new Set(est.inputs.map((i) => i.key))
    const outputKeys = new Set(est.outputs.map((o) => o.key))
    for (const output of est.outputs) {
      if (!output.expression.trim()) {
        out.push({
          kind: "invalid_expression",
          estimatorId: est.id,
          outputKey: output.key,
          outputId: output.id,
          reason: "empty",
        })
        continue
      }
      for (const ref of extractBareRefs(output.expression)) {
        if (!inputKeys.has(ref) && !outputKeys.has(ref)) {
          out.push({
            kind: "invalid_expression",
            estimatorId: est.id,
            outputKey: output.key,
            outputId: output.id,
            reason: "missing_ref",
            detail: ref,
          })
        }
      }
    }
  }

  // ─── DAG cycle detection across bindings ─────────────────────────────────
  // Graph: edge from upstream binding → this binding for every
  // BindingOutput source. Kahn's algorithm; any unprocessed nodes = cycle.
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const b of bindings) {
    inDeg.set(b.id, 0)
    adj.set(b.id, [])
  }
  for (const b of bindings) {
    const mapping = b.inputs_mapping as InputMapping
    const deps = new Set<string>()
    for (const src of Object.values(mapping)) {
      if (
        src.source === "binding_output" &&
        bindingById.has(src.binding_id) &&
        src.binding_id !== b.id
      ) {
        deps.add(src.binding_id)
      }
    }
    for (const dep of deps) {
      adj.get(dep)!.push(b.id)
      inDeg.set(b.id, (inDeg.get(b.id) ?? 0) + 1)
    }
  }
  const queue: string[] = []
  inDeg.forEach((v, k) => {
    if (v === 0) queue.push(k)
  })
  const visited = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    visited.add(id)
    for (const child of adj.get(id) ?? []) {
      inDeg.set(child, (inDeg.get(child) ?? 0) - 1)
      if (inDeg.get(child) === 0) queue.push(child)
    }
  }
  if (visited.size !== bindings.length) {
    const cycleIds = bindings.filter((b) => !visited.has(b.id))
    out.push({
      kind: "cycle_between_bindings",
      bindingIds: cycleIds.map((b) => b.id),
      estimatorIds: [...new Set(cycleIds.map((b) => b.estimator_id))],
    })
  }

  return out
}

// ─── Helpers: index diagnostics by the node/edge they apply to ───────────

export type DiagnosticIndex = {
  /** binding_id + input_key → diagnostics that affect that specific wiring. */
  edges: Map<string, Diagnostic[]>
  /** estimator_id → diagnostics that affect the estimator node overall. */
  estimators: Map<string, Diagnostic[]>
  /** all diagnostics, in a stable order for the toolbar list. */
  all: Diagnostic[]
}

export function indexDiagnostics(diags: Diagnostic[]): DiagnosticIndex {
  const edges = new Map<string, Diagnostic[]>()
  const estimators = new Map<string, Diagnostic[]>()
  const push = <K>(map: Map<K, Diagnostic[]>, key: K, d: Diagnostic) => {
    const arr = map.get(key)
    if (arr) arr.push(d)
    else map.set(key, [d])
  }

  for (const d of diags) {
    switch (d.kind) {
      case "unmapped_input":
      case "dangling_field_ref":
      case "dangling_binding_ref":
      case "type_mismatch":
        push(edges, `${d.bindingId}::${d.inputKey}`, d)
        push(estimators, d.estimatorId, d)
        break
      case "missing_map_step":
      case "map_step_not_repeatable":
      case "invalid_expression":
      case "missing_estimator":
        push(estimators, d.estimatorId, d)
        break
      case "cycle_between_bindings":
        for (const eid of d.estimatorIds) push(estimators, eid, d)
        break
    }
  }

  return { edges, estimators, all: diags }
}

/** Translation key + interpolation vars for a diagnostic. Keeps rendering
 *  logic out of the domain module so both the tooltip and the toolbar list
 *  can reuse the same i18n call. */
export function diagnosticI18n(d: Diagnostic): {
  key: string
  vars: Record<string, string>
} {
  switch (d.kind) {
    case "unmapped_input":
      return {
        key: "diagnostics.unmapped_input",
        vars: { input: d.inputKey },
      }
    case "dangling_field_ref":
      return {
        key: "diagnostics.dangling_field_ref",
        vars: { input: d.inputKey },
      }
    case "dangling_binding_ref":
      return {
        key:
          d.reason === "missing_binding"
            ? "diagnostics.dangling_binding_missing"
            : "diagnostics.dangling_binding_output_missing",
        vars: { input: d.inputKey, output: d.outputKey },
      }
    case "missing_map_step":
      return { key: "diagnostics.missing_map_step", vars: {} }
    case "map_step_not_repeatable":
      return { key: "diagnostics.map_step_not_repeatable", vars: {} }
    case "invalid_expression":
      return d.reason === "empty"
        ? {
            key: "diagnostics.invalid_expression_empty",
            vars: { output: d.outputKey },
          }
        : {
            key: "diagnostics.invalid_expression_missing_ref",
            vars: { output: d.outputKey, ref: d.detail ?? "" },
          }
    case "cycle_between_bindings":
      return {
        key: "diagnostics.cycle_between_bindings",
        vars: { count: String(d.bindingIds.length) },
      }
    case "type_mismatch":
      return {
        key: "diagnostics.type_mismatch",
        vars: {
          input: d.inputKey,
          expected: d.expected,
          actual: d.actual,
        },
      }
    case "missing_estimator":
      return { key: "diagnostics.missing_estimator", vars: {} }
  }
}
