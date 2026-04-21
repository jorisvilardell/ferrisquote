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
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

/// Wire representation of an `EstimatorParameterType`. Tagged enum so clients
/// pick one of `number`, `boolean`, or `product` with an optional label filter.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EstimatorParameterTypeDto {
    Number,
    Boolean,
    Product {
        #[serde(default)]
        label_filter: Option<String>,
    },
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateInputRequest {
    #[validate(length(min = 1, max = 255))]
    pub key: String,
    #[validate(length(max = 1000))]
    #[serde(default)]
    pub description: Option<String>,
    pub parameter_type: EstimatorParameterTypeDto,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateInputRequest {
    #[validate(length(min = 1, max = 255))]
    pub key: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub parameter_type: Option<EstimatorParameterTypeDto>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateOutputRequest {
    #[validate(length(min = 1, max = 255))]
    pub key: String,
    #[validate(length(min = 1))]
    pub expression: String,
    #[validate(length(max = 1000))]
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateOutputRequest {
    #[validate(length(min = 1, max = 255))]
    pub key: Option<String>,
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
    #[serde(default)]
    pub cross_values: HashMap<String, HashMap<String, f64>>,
}

// ============================================================================
// Response DTOs
// ============================================================================

#[derive(Debug, Serialize, ToSchema)]
pub struct InputResponse {
    pub id: Uuid,
    pub key: String,
    pub description: String,
    pub parameter_type: EstimatorParameterTypeDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OutputResponse {
    pub id: Uuid,
    pub key: String,
    pub expression: String,
    pub description: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EstimatorResponse {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub name: String,
    pub description: String,
    pub inputs: Vec<InputResponse>,
    pub outputs: Vec<OutputResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EstimatorListResponse {
    pub estimators: Vec<EstimatorResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EvaluateResponse {
    pub results: HashMap<String, f64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EvaluateFlowResponse {
    pub results: HashMap<String, HashMap<String, f64>>,
    pub flat_results: HashMap<String, f64>,
}
