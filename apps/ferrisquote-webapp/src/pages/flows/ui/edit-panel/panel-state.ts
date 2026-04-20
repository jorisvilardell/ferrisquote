/**
 * Edit panel state — discriminated union describing which form the sidenav
 * is currently showing. All variants are ID-based so that panel contents
 * can be derived from live query data rather than captured snapshots.
 */
export type PanelState =
  | { mode: "add-step" }
  | { mode: "step-details"; stepId: string }
  | { mode: "add-field"; stepId: string }
  | { mode: "edit-field"; fieldId: string; stepId: string }
  | { mode: "estimator-details"; estimatorId: string }
