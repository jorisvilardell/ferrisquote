use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// Typed value submitted for a single field. Matches the domain `FieldValue`
/// enum — serialized untagged so JSON is just `"txt"`, `42.0`, `true` or
/// `["a", "b"]`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum FieldValueDto {
    Text(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<String>),
}

/// One iteration of a step. For non-repeatable steps exactly one iteration;
/// for repeatable ones, ordered list on the parent submission.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StepIterationDto {
    /// Answers keyed by field UUID (string form).
    pub answers: HashMap<String, FieldValueDto>,
}

/// Request body for POST /api/v1/flows/{flow_id}/submissions.
#[derive(Debug, Deserialize, ToSchema)]
pub struct SubmitAnswersRequest {
    /// Submitting user's UUID. (Will be replaced by auth-derived identity
    /// once authentication middleware is in place.)
    pub user_id: Uuid,
    /// Answers nested by step UUID (string form) → ordered iterations.
    pub answers: HashMap<String, Vec<StepIterationDto>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SubmissionResponse {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub user_id: Uuid,
    pub submitted_at: DateTime<Utc>,
    pub answers: HashMap<String, Vec<StepIterationDto>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SubmissionListResponse {
    pub submissions: Vec<SubmissionResponse>,
}
