use std::sync::Arc;

use ferrisquote_domain::domain::{
    error::DomainError,
    user::{
        entities::{User, UserId},
        ports::UserRepository,
    },
};
use sqlx::{PgPool, Row};

#[derive(Clone)]
pub struct PostgresUserRepository {
    pool: Arc<PgPool>,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool: Arc::new(pool) }
    }

    pub fn with_pool(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

/// Map a sqlx error into a DomainError. Catches Postgres UNIQUE violations
/// (SQLSTATE 23505) and surfaces them as `Conflict` rather than raw repository
/// errors — keeps clean domain-level semantics for duplicate emails.
fn map_sqlx_err(err: sqlx::Error) -> DomainError {
    if let sqlx::Error::Database(db_err) = &err {
        if db_err.code().as_deref() == Some("23505") {
            return DomainError::conflict("A user with this email already exists");
        }
    }
    DomainError::repository(err.to_string())
}

fn row_to_user(row: &sqlx::postgres::PgRow) -> User {
    User::with_id(
        UserId::from_uuid(row.get("id")),
        row.get("mail"),
        row.get("first_name"),
        row.get("last_name"),
    )
}

impl UserRepository for PostgresUserRepository {
    async fn create(&self, user: User) -> Result<User, DomainError> {
        sqlx::query(
            "INSERT INTO users (id, mail, first_name, last_name, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, NOW(), NOW())",
        )
        .bind(user.id.into_uuid())
        .bind(&user.mail)
        .bind(&user.first_name)
        .bind(&user.last_name)
        .execute(&*self.pool)
        .await
        .map_err(map_sqlx_err)?;

        Ok(user)
    }

    async fn get_by_id(&self, id: UserId) -> Result<User, DomainError> {
        let row = sqlx::query(
            "SELECT id, mail, first_name, last_name FROM users WHERE id = $1",
        )
        .bind(id.into_uuid())
        .fetch_optional(&*self.pool)
        .await
        .map_err(map_sqlx_err)?
        .ok_or_else(|| DomainError::not_found("User", id.to_string()))?;

        Ok(row_to_user(&row))
    }

    async fn get_by_mail(&self, mail: &str) -> Result<User, DomainError> {
        let row = sqlx::query(
            "SELECT id, mail, first_name, last_name FROM users WHERE mail = $1",
        )
        .bind(mail)
        .fetch_optional(&*self.pool)
        .await
        .map_err(map_sqlx_err)?
        .ok_or_else(|| DomainError::not_found("User", mail.to_string()))?;

        Ok(row_to_user(&row))
    }

    async fn update(
        &self,
        id: UserId,
        mail: Option<String>,
        first_name: Option<String>,
        last_name: Option<String>,
    ) -> Result<User, DomainError> {
        let row = sqlx::query(
            "UPDATE users \
             SET mail = COALESCE($2, mail), \
                 first_name = COALESCE($3, first_name), \
                 last_name = COALESCE($4, last_name), \
                 updated_at = NOW() \
             WHERE id = $1 \
             RETURNING id, mail, first_name, last_name",
        )
        .bind(id.into_uuid())
        .bind(mail)
        .bind(first_name)
        .bind(last_name)
        .fetch_optional(&*self.pool)
        .await
        .map_err(map_sqlx_err)?
        .ok_or_else(|| DomainError::not_found("User", id.to_string()))?;

        Ok(row_to_user(&row))
    }

    async fn delete(&self, id: UserId) -> Result<(), DomainError> {
        let result = sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id.into_uuid())
            .execute(&*self.pool)
            .await
            .map_err(map_sqlx_err)?;

        if result.rows_affected() == 0 {
            return Err(DomainError::not_found("User", id.to_string()));
        }
        Ok(())
    }
}
