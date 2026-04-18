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
