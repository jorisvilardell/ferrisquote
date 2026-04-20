use serde::{Deserialize, Deserializer, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// Deserializes a double-option field so that:
/// - absent key   → `None`       (don't touch)
/// - `null`       → `Some(None)` (set to null)
/// - `value`      → `Some(Some(value))`
fn deserialize_double_option<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateFlowRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateFlowMetadataRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateStepRequest {
    #[validate(length(min = 1, max = 255))]
    pub title: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub is_repeatable: Option<bool>,
    #[validate(length(max = 255))]
    pub repeat_label: Option<String>,
    pub min_repeats: Option<u32>,
    pub max_repeats: Option<u32>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateStepMetadataRequest {
    #[validate(length(min = 1, max = 255))]
    pub title: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub is_repeatable: Option<bool>,
    #[validate(length(max = 255))]
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub repeat_label: Option<Option<String>>,
    pub min_repeats: Option<u32>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub max_repeats: Option<Option<u32>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct ReorderStepRequest {
    pub after_id: Option<Uuid>,
    pub before_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
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

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateFieldConfigRequest {
    #[validate(length(min = 1, max = 255))]
    pub label: Option<String>,
    #[validate(length(min = 1, max = 100))]
    #[validate(regex(path = *FIELD_KEY_REGEX))]
    pub key: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub config: Option<FieldConfigDto>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct MoveFieldRequest {
    pub target_step_id: Option<Uuid>,
    pub after_id: Option<Uuid>,
    pub before_id: Option<Uuid>,
}

// ============================================================================
// Field Config DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldConfigDto {
    Text { max_length: u32 },
    Number { min: Option<f64>, max: Option<f64> },
    /// ISO 8601 date strings
    Date { min: String, max: String },
    Boolean { default: bool },
    Select { options: Vec<String> },
}

// ============================================================================
// Response DTOs
// ============================================================================

#[derive(Debug, Serialize, ToSchema)]
pub struct FlowResponse {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub steps: Vec<StepResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StepResponse {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub rank: String,
    pub is_repeatable: bool,
    pub repeat_label: Option<String>,
    pub min_repeats: u32,
    pub max_repeats: Option<u32>,
    pub fields: Vec<FieldResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FieldResponse {
    pub id: Uuid,
    pub key: String,
    pub label: String,
    pub description: String,
    pub rank: String,
    pub config: FieldConfigDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlowListResponse {
    pub flows: Vec<FlowSummaryResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlowSummaryResponse {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub step_count: usize,
}

// ============================================================================
// Success Response Wrappers
// ============================================================================

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiResponse<#[allow(dead_code)] T: ToSchema> {
    pub success: bool,
    pub data: T,
}

impl<T: ToSchema> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
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
