use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::dto::{StepIterationDto, SubmissionResponse};

/// Request body for POST /flows/{id}/evaluate-bindings — same payload as a
/// submit, but not persisted. `user_id` is required for shape parity; any
/// non-null UUID is accepted (FK is not enforced here).
#[derive(Debug, Deserialize, ToSchema)]
pub struct EvaluateBindingsRequest {
    pub user_id: Uuid,
    pub answers: HashMap<String, Vec<StepIterationDto>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlowEvaluationResponse {
    /// Per-binding output map: `binding_id → output_key → value`.
    pub bindings: HashMap<String, HashMap<String, f64>>,
    /// Flat view keyed `"<binding_id>.<output_key>"` for convenience.
    pub flat: HashMap<String, f64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlowPreviewResponse {
    /// Synthetic submission the engine generated.
    pub submission: SubmissionResponse,
    pub evaluation: FlowEvaluationResponse,
}
