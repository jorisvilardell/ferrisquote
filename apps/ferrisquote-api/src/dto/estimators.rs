use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateEstimatorRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateEstimatorRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateVariableRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(min = 1))]
    pub expression: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateVariableRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    #[validate(length(min = 1))]
    pub expression: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct EvaluateRequest {
    pub field_values: HashMap<String, f64>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct EvaluateSubmissionRequest {
    pub field_values: HashMap<String, f64>,
    pub iteration_values: HashMap<String, Vec<f64>>,
    pub iteration_counts: HashMap<String, usize>,
    /// Optional stub values for cross-estimator references used in preview
    /// mode. Nested as `estimator_name → variable_name → value`. When evaluating
    /// a single estimator, any `@EstimatorName.var` not present here silently
    /// defaults to `0.0`.
    #[serde(default)]
    pub cross_values: HashMap<String, HashMap<String, f64>>,
}

// ============================================================================
// Response DTOs
// ============================================================================

#[derive(Debug, Serialize, ToSchema)]
pub struct EstimatorResponse {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub name: String,
    pub variables: Vec<VariableResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct VariableResponse {
    pub id: Uuid,
    pub name: String,
    pub expression: String,
    pub description: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EstimatorListResponse {
    pub estimators: Vec<EstimatorResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EvaluateResponse {
    pub results: HashMap<String, f64>,
}

/// Response for the flow-level evaluation endpoint.
///
/// `results` is a nested map: estimator_name → variable_name → value.
/// `flat_results` provides the same data flattened with `"EstName.varName"` keys,
/// for convenience when variable names may clash across estimators.
#[derive(Debug, Serialize, ToSchema)]
pub struct EvaluateFlowResponse {
    pub results: HashMap<String, HashMap<String, f64>>,
    pub flat_results: HashMap<String, f64>,
}
