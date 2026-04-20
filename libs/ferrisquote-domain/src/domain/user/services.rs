use crate::domain::error::DomainError;

use super::entities::{User, UserId};
use super::ports::{UserRepository, UserService};

#[derive(Clone)]
pub struct UserServiceImpl<UR> {
    repo: UR,
}

impl<UR> UserServiceImpl<UR> {
    pub fn new(repo: UR) -> Self {
        Self { repo }
    }
}

/// Minimal email validation. Centralized so the rule stays one-liner away.
fn validate_mail(mail: &str) -> Result<(), DomainError> {
    let trimmed = mail.trim();
    if trimmed.is_empty() {
        return Err(DomainError::validation("Email cannot be empty"));
    }
    // Must contain exactly one '@' with non-empty local + domain parts
    let mut parts = trimmed.split('@');
    let local = parts.next().unwrap_or("");
    let domain = parts.next().unwrap_or("");
    if local.is_empty() || domain.is_empty() || parts.next().is_some() || !domain.contains('.') {
        return Err(DomainError::validation("Invalid email format"));
    }
    Ok(())
}

fn validate_name(field: &str, value: &str) -> Result<(), DomainError> {
    if value.trim().is_empty() {
        return Err(DomainError::validation(format!("{field} cannot be empty")));
    }
    if value.len() > 255 {
        return Err(DomainError::validation(format!(
            "{field} must be at most 255 characters"
        )));
    }
    Ok(())
}

impl<UR> UserService for UserServiceImpl<UR>
where
    UR: UserRepository + Send + Sync,
{
    async fn create_user(
        &self,
        mail: String,
        first_name: String,
        last_name: String,
    ) -> Result<User, DomainError> {
        validate_mail(&mail)?;
        validate_name("First name", &first_name)?;
        validate_name("Last name", &last_name)?;
        let user = User::new(mail, first_name, last_name);
        self.repo.create(user).await
    }

    async fn get_user(&self, id: UserId) -> Result<User, DomainError> {
        self.repo.get_by_id(id).await
    }

    async fn get_user_by_mail(&self, mail: &str) -> Result<User, DomainError> {
        self.repo.get_by_mail(mail).await
    }

    async fn update_user(
        &self,
        id: UserId,
        mail: Option<String>,
        first_name: Option<String>,
        last_name: Option<String>,
    ) -> Result<User, DomainError> {
        if let Some(m) = &mail {
            validate_mail(m)?;
        }
        if let Some(f) = &first_name {
            validate_name("First name", f)?;
        }
        if let Some(l) = &last_name {
            validate_name("Last name", l)?;
        }
        self.repo.update(id, mail, first_name, last_name).await
    }

    async fn delete_user(&self, id: UserId) -> Result<(), DomainError> {
        self.repo.delete(id).await
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_mail_accepts_valid() {
        assert!(validate_mail("foo@bar.com").is_ok());
        assert!(validate_mail("a.b+c@x.y.z").is_ok());
    }

    #[test]
    fn test_validate_mail_rejects_empty() {
        assert!(validate_mail("").is_err());
        assert!(validate_mail("   ").is_err());
    }

    #[test]
    fn test_validate_mail_rejects_malformed() {
        assert!(validate_mail("no-at-sign").is_err());
        assert!(validate_mail("@nohost.com").is_err());
        assert!(validate_mail("nodomain@").is_err());
        assert!(validate_mail("a@b").is_err()); // no TLD separator
        assert!(validate_mail("a@b@c.com").is_err()); // multiple @
    }

    #[test]
    fn test_validate_name_accepts_valid() {
        assert!(validate_name("First", "Alice").is_ok());
    }

    #[test]
    fn test_validate_name_rejects_empty_or_too_long() {
        assert!(validate_name("First", "").is_err());
        assert!(validate_name("First", "   ").is_err());
        assert!(validate_name("First", &"x".repeat(256)).is_err());
    }
}
