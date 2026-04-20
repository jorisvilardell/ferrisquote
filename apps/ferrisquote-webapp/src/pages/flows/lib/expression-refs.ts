/**
 * Expression reference translation between storage form (ID-based) and
 * display form (name-based).
 *
 * Storage (what the backend stores and processes):
 *   @field_key           — field / same-estimator variable
 *   @#<uuid>.var_name    — cross-estimator reference (by ID)
 *
 * Display (what the user sees and types in the UI):
 *   @field_key           — unchanged
 *   @EstimatorName.var   — cross-ref (by name)
 */

export type EstimatorIndex = Array<{ id: string; name: string }>

/** Expression storage-form → display-form. Replaces `@#<id>.var` with `@Name.var`. */
export function idsToNames(expr: string, estimators: EstimatorIndex): string {
  return expr.replace(
    /@#([A-Za-z0-9-]+)\.([a-z][a-z0-9_]*)/g,
    (match, id, variable) => {
      const est = estimators.find((e) => e.id === id)
      return est ? `@${est.name}.${variable}` : match
    },
  )
}

/** Expression display-form → storage-form. Replaces `@Name.var` with `@#<id>.var`. */
export function namesToIds(expr: string, estimators: EstimatorIndex): string {
  return expr.replace(
    /@([A-Za-z_][A-Za-z0-9_]*)\.([a-z][a-z0-9_]*)/g,
    (match, name, variable) => {
      const est = estimators.find((e) => e.name === name)
      return est ? `@#${est.id}.${variable}` : match
    },
  )
}

/**
 * Like `namesToIds`, but when a `@Name.var` pair already appeared in `previousStorage`
 * as `@#<id>.var`, or was explicitly remembered in `overrides`, reuse that specific
 * id instead of falling back to first-by-name lookup. Prevents edge rerouting when
 * two estimators share a name.
 */
export function namesToIdsPreservingIds(
  expr: string,
  estimators: EstimatorIndex,
  previousStorage: string,
  overrides?: Map<string, string>,
): string {
  // Build preferred map: "name.var" → id (from previous storage)
  const preferred = new Map<string, string>()
  const prevRe = /@#([A-Za-z0-9-]+)\.([a-z][a-z0-9_]*)/g
  let m: RegExpExecArray | null
  while ((m = prevRe.exec(previousStorage)) !== null) {
    const est = estimators.find((e) => e.id === m![1])
    if (est) preferred.set(`${est.name}.${m![2]}`, m![1])
  }
  // Overrides take precedence (recent autocomplete picks)
  if (overrides) {
    for (const [k, v] of overrides) preferred.set(k, v)
  }

  return expr.replace(
    /@([A-Za-z_][A-Za-z0-9_]*)\.([a-z][a-z0-9_]*)/g,
    (match, name, variable) => {
      const pref = preferred.get(`${name}.${variable}`)
      if (pref) return `@#${pref}.${variable}`
      const est = estimators.find((e) => e.name === name)
      return est ? `@#${est.id}.${variable}` : match
    },
  )
}
