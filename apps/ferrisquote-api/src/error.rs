use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use ferrisquote_domain::DomainError;
use serde_json::json;
use std::fmt;

/// API Error type that can be converted to HTTP responses
#[derive(Debug)]
pub enum ApiError {
    /// Domain errors from business logic
    Domain(DomainError),
    /// Validation errors from request DTOs
    Validation(String),
    /// Internal server errors
    Internal(String),
    /// Bad request errors
    BadRequest(String),
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiError::Domain(e) => write!(f, "Domain error: {}", e),
            ApiError::Validation(msg) => write!(f, "Validation error: {}", msg),
            ApiError::Internal(msg) => write!(f, "Internal error: {}", msg),
            ApiError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
        }
    }
}

impl std::error::Error for ApiError {}

/// Convert DomainError to ApiError
impl From<DomainError> for ApiError {
    fn from(error: DomainError) -> Self {
        ApiError::Domain(error)
    }
}

/// Convert validation errors to ApiError
impl From<validator::ValidationErrors> for ApiError {
    fn from(errors: validator::ValidationErrors) -> Self {
        ApiError::Validation(format!("Validation failed: {}", errors))
    }
}

/// Convert UUID parse errors to ApiError
impl From<uuid::Error> for ApiError {
    fn from(error: uuid::Error) -> Self {
        ApiError::BadRequest(format!("Invalid UUID: {}", error))
    }
}

/// Convert ApiError into HTTP responses
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match self {
            ApiError::Domain(ref domain_error) => match domain_error {
                DomainError::NotFound { entity, id } => (
                    StatusCode::NOT_FOUND,
                    "not_found",
                    format!("{} with id {} not found", entity, id),
                ),
                DomainError::ValidationError { message } => (
                    StatusCode::BAD_REQUEST,
                    "validation_error",
                    message.clone(),
                ),
                DomainError::Conflict { message } => {
                    (StatusCode::CONFLICT, "conflict", message.clone())
                }
                DomainError::Unauthorized { message } => {
                    (StatusCode::UNAUTHORIZED, "unauthorized", message.clone())
                }
                DomainError::Forbidden { message } => {
                    (StatusCode::FORBIDDEN, "forbidden", message.clone())
                }
                DomainError::RepositoryError { message } => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "repository_error",
                    message.clone(),
                ),
                DomainError::InternalError { message } => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    message.clone(),
                ),
            },
            ApiError::Validation(ref msg) => {
                (StatusCode::BAD_REQUEST, "validation_error", msg.clone())
            }
            ApiError::BadRequest(ref msg) => {
                (StatusCode::BAD_REQUEST, "bad_request", msg.clone())
            }
            ApiError::Internal(ref msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                msg.clone(),
            ),
        };

        // Log the error
        tracing::error!(
            error_type = error_type,
            status = status.as_u16(),
            message = message,
            "API error occurred"
        );

        let body = Json(json!({
            "success": false,
            "error": {
                "type": error_type,
                "message": message,
            }
        }));

        (status, body).into_response()
    }
}

/// Result type alias for API handlers
pub type ApiResult<T> = Result<T, ApiError>;
