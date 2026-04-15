use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SubmissionData {
    pub field_values: HashMap<String, f64>,
    pub iteration_values: HashMap<String, Vec<f64>>,
    pub iteration_counts: HashMap<String, usize>,
}
