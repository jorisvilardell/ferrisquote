use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::domain::flows::entities::id::FieldId;

use super::field_value::FieldValue;

/// One iteration of a (possibly repeatable) step — a bundle of answers
/// indexed by FieldId. For non-repeatable steps there is exactly one
/// iteration per step; for repeatable ones, the `Vec<StepIteration>` on
/// the parent `Submission` preserves ordered iterations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct StepIteration {
    pub answers: HashMap<FieldId, FieldValue>,
}

impl StepIteration {
    pub fn new(answers: HashMap<FieldId, FieldValue>) -> Self {
        Self { answers }
    }
}
