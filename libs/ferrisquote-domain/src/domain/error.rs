use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },

    #[error("validation error: {message}")]
    ValidationError { message: String },

    #[error("conflict: {message}")]
    Conflict { message: String },

    #[error("repository error: {message}")]
    RepositoryError { message: String },

    #[error("internal error: {message}")]
    InternalError { message: String },

    #[error("unauthorized: {message}")]
    Unauthorized { message: String },

    #[error("forbidden: {message}")]
    Forbidden { message: String },
}

impl DomainError {
    pub fn not_found(entity: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFound {
            entity: entity.into(),
            id: id.into(),
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::ValidationError {
            message: message.into(),
        }
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict {
            message: message.into(),
        }
    }

    pub fn repository(message: impl Into<String>) -> Self {
        Self::RepositoryError {
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::InternalError {
            message: message.into(),
        }
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::Unauthorized {
            message: message.into(),
        }
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::Forbidden {
            message: message.into(),
        }
    }
}
