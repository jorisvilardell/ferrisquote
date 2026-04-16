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
