use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFlowRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateFlowMetadataRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateStepRequest {
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ReorderStepRequest {
    #[validate(range(min = 0))]
    pub new_order: u32,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateFieldRequest {
    #[validate(length(min = 1, max = 255))]
    pub label: String,
    #[validate(length(min = 1, max = 100))]
    #[validate(regex(path = *FIELD_KEY_REGEX))]
    pub key: String,
    pub config: FieldConfigDto,
}

lazy_static::lazy_static! {
    static ref FIELD_KEY_REGEX: regex::Regex = regex::Regex::new(r"^[a-z][a-z0-9_]*$").unwrap();
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateFieldConfigRequest {
    #[validate(length(min = 1, max = 255))]
    pub label: String,
    pub config: FieldConfigDto,
}

#[derive(Debug, Deserialize, Validate)]
pub struct MoveFieldRequest {
    pub target_step_id: Uuid,
    #[validate(range(min = 0))]
    pub new_order: u32,
}

// ============================================================================
// Field Config DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldConfigDto {
    Text { max_length: u32 },
    Number { min: f64, max: f64 },
    Date { min: String, max: String }, // ISO 8601 format
    Boolean { default: bool },
    Select { options: Vec<String> },
}

// ============================================================================
// Response DTOs
// ============================================================================

#[derive(Debug, Serialize)]
pub struct FlowResponse {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub steps: Vec<StepResponse>,
}

#[derive(Debug, Serialize)]
pub struct StepResponse {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub order: u32,
    pub fields: Vec<FieldResponse>,
}

#[derive(Debug, Serialize)]
pub struct FieldResponse {
    pub id: Uuid,
    pub key: String,
    pub label: String,
    pub description: String,
    pub order: u32,
    pub config: FieldConfigDto,
}

#[derive(Debug, Serialize)]
pub struct FlowListResponse {
    pub flows: Vec<FlowSummaryResponse>,
}

#[derive(Debug, Serialize)]
pub struct FlowSummaryResponse {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub step_count: usize,
}

// ============================================================================
// Success Response Wrappers
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

impl MessageResponse {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}
