use std::future::Future;

use crate::domain::error::DomainError;
use crate::domain::flows::entities::ids::FlowId;
use crate::domain::user::entities::UserId;

use super::entities::{AnswerValue, Submission, SubmissionId};

/// Persistence contract for submissions.
pub trait SubmissionRepository: Send + Sync {
    fn create_submission(
        &self,
        submission: Submission,
    ) -> impl Future<Output = Result<Submission, DomainError>> + Send;

    fn get_submission(
        &self,
        id: SubmissionId,
    ) -> impl Future<Output = Result<Submission, DomainError>> + Send;

    fn list_user_submissions(
        &self,
        user_id: UserId,
    ) -> impl Future<Output = Result<Vec<Submission>, DomainError>> + Send;

    fn list_flow_submissions(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<Vec<Submission>, DomainError>> + Send;
}

/// Domain service — validates answers against flow fields before persisting.
pub trait SubmissionService: Send + Sync {
    fn submit(
        &self,
        flow_id: FlowId,
        user_id: UserId,
        answers: Vec<(String, AnswerValue)>,
    ) -> impl Future<Output = Result<Submission, DomainError>> + Send;

    fn get_submission(
        &self,
        id: SubmissionId,
    ) -> impl Future<Output = Result<Submission, DomainError>> + Send;

    fn list_submissions_for_flow(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<Vec<Submission>, DomainError>> + Send;

    fn list_submissions_for_user(
        &self,
        user_id: UserId,
    ) -> impl Future<Output = Result<Vec<Submission>, DomainError>> + Send;
}
