use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SubmissionData {
    pub field_values: HashMap<String, f64>,
    pub iteration_values: HashMap<String, Vec<f64>>,
    pub iteration_counts: HashMap<String, usize>,
    /// Optional stub values for cross-estimator references
    /// (`@#<uuid>.variable_name`). Used for single-estimator "preview"
    /// evaluation when the full flow context isn't available.
    /// Nested map: estimator_id (UUID string) → variable_name → value.
    #[serde(default)]
    pub cross_values: HashMap<String, HashMap<String, f64>>,
}
