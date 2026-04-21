use serde::{Deserialize, Serialize};

/// Value submitted for a single field. The variant must be compatible
/// with the FieldConfig of the referenced field — enforced by the service.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum FieldValue {
    Text(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<String>),
}

impl FieldValue {
    /// Coerce to f64 for numeric evaluation (booleans → 0/1).
    /// Returns `None` for non-numeric variants.
    pub fn as_number(&self) -> Option<f64> {
        match self {
            FieldValue::Number(n) => Some(*n),
            FieldValue::Boolean(b) => Some(if *b { 1.0 } else { 0.0 }),
            _ => None,
        }
    }
}
