use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use ferrisquote_domain::domain::{
    error::DomainError,
    flows::entities::ids::{FlowId, StepId},
    submission::{
        entities::{StepIteration, Submission, SubmissionId},
        ports::SubmissionRepository,
    },
    user::entities::UserId,
};
use sqlx::{PgPool, Row};

#[derive(Clone)]
pub struct PostgresSubmissionRepository {
    pool: Arc<PgPool>,
}

impl PostgresSubmissionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool: Arc::new(pool) }
    }

    pub fn with_pool(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

fn map_sqlx_err(err: sqlx::Error) -> DomainError {
    if let sqlx::Error::Database(db_err) = &err {
        // foreign_key_violation — referenced flow/user does not exist
        if db_err.code().as_deref() == Some("23503") {
            return DomainError::validation("Referenced flow or user does not exist");
        }
    }
    DomainError::repository(err.to_string())
}

fn row_to_submission(row: &sqlx::postgres::PgRow) -> Result<Submission, DomainError> {
    let answers_json: sqlx::types::Json<HashMap<StepId, Vec<StepIteration>>> = row
        .try_get("answers")
        .map_err(|e| DomainError::internal(format!("Failed to decode submission answers: {e}")))?;
    Ok(Submission::with_id(
        SubmissionId::from_uuid(row.get("id")),
        FlowId::from_uuid(row.get("flow_id")),
        UserId::from_uuid(row.get("user_id")),
        row.get::<DateTime<Utc>, _>("submitted_at"),
        answers_json.0,
    ))
}

impl SubmissionRepository for PostgresSubmissionRepository {
    async fn create_submission(
        &self,
        submission: Submission,
    ) -> Result<Submission, DomainError> {
        let answers_json = sqlx::types::Json(&submission.answers);
        sqlx::query(
            "INSERT INTO submissions (id, flow_id, user_id, submitted_at, answers) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(submission.id.into_uuid())
        .bind(submission.flow_id.into_uuid())
        .bind(submission.user_id.into_uuid())
        .bind(submission.submitted_at)
        .bind(answers_json)
        .execute(&*self.pool)
        .await
        .map_err(map_sqlx_err)?;

        Ok(submission)
    }

    async fn get_submission(&self, id: SubmissionId) -> Result<Submission, DomainError> {
        let row = sqlx::query(
            "SELECT id, flow_id, user_id, submitted_at, answers FROM submissions WHERE id = $1",
        )
        .bind(id.into_uuid())
        .fetch_optional(&*self.pool)
        .await
        .map_err(map_sqlx_err)?
        .ok_or_else(|| DomainError::not_found("Submission", id.to_string()))?;

        row_to_submission(&row)
    }

    async fn list_flow_submissions(
        &self,
        flow_id: FlowId,
    ) -> Result<Vec<Submission>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, flow_id, user_id, submitted_at, answers \
             FROM submissions WHERE flow_id = $1 ORDER BY submitted_at DESC",
        )
        .bind(flow_id.into_uuid())
        .fetch_all(&*self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.iter().map(row_to_submission).collect()
    }

    async fn list_user_submissions(
        &self,
        user_id: UserId,
    ) -> Result<Vec<Submission>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, flow_id, user_id, submitted_at, answers \
             FROM submissions WHERE user_id = $1 ORDER BY submitted_at DESC",
        )
        .bind(user_id.into_uuid())
        .fetch_all(&*self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.iter().map(row_to_submission).collect()
    }
}
