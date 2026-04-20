use serde::{Deserialize, Serialize};

use super::answer_value::AnswerValue;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SubmissionAnswer {
    pub field_key: String,
    pub value: AnswerValue,
}

impl SubmissionAnswer {
    pub fn new(field_key: String, value: AnswerValue) -> Self {
        Self { field_key, value }
    }
}
