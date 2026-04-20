use std::future::Future;

use crate::domain::error::DomainError;

use super::entities::{User, UserId};

/// Persistence contract for user aggregates. Technology-agnostic.
pub trait UserRepository: Send + Sync {
    fn create(&self, user: User) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn get_by_id(&self, id: UserId) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn get_by_mail(&self, mail: &str)
        -> impl Future<Output = Result<User, DomainError>> + Send;

    /// Partial update — only `Some(...)` fields are written.
    fn update(
        &self,
        id: UserId,
        mail: Option<String>,
        first_name: Option<String>,
        last_name: Option<String>,
    ) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn delete(&self, id: UserId) -> impl Future<Output = Result<(), DomainError>> + Send;
}

/// Domain service — orchestrates business rules (validation, uniqueness
/// checks, welcome hooks, etc.) on top of the repository.
pub trait UserService: Send + Sync {
    fn create_user(
        &self,
        mail: String,
        first_name: String,
        last_name: String,
    ) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn get_user(&self, id: UserId) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn get_user_by_mail(
        &self,
        mail: &str,
    ) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn update_user(
        &self,
        id: UserId,
        mail: Option<String>,
        first_name: Option<String>,
        last_name: Option<String>,
    ) -> impl Future<Output = Result<User, DomainError>> + Send;

    fn delete_user(&self, id: UserId) -> impl Future<Output = Result<(), DomainError>> + Send;
}
