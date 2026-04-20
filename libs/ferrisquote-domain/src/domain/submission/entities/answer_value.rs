use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Value submitted for a single field. The variant must match the
/// FieldConfig of the referenced field — enforced by the service.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum AnswerValue {
    Text(String),
    Number(f64),
    Date(NaiveDate),
    Boolean(bool),
    Select(String),
}
