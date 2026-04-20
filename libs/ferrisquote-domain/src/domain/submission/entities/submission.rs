use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::flows::entities::ids::FlowId;
use crate::domain::user::entities::UserId;

use super::answer::SubmissionAnswer;
use super::id::SubmissionId;

/// Aggregate of answers given by a user to a flow questionnaire.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Submission {
    pub id: SubmissionId,
    pub flow_id: FlowId,
    pub user_id: UserId,
    pub submitted_at: DateTime<Utc>,
    pub answers: Vec<SubmissionAnswer>,
}

impl Submission {
    pub fn new(flow_id: FlowId, user_id: UserId, answers: Vec<SubmissionAnswer>) -> Self {
        Self {
            id: SubmissionId::new(),
            flow_id,
            user_id,
            submitted_at: Utc::now(),
            answers,
        }
    }

    pub fn with_id(
        id: SubmissionId,
        flow_id: FlowId,
        user_id: UserId,
        submitted_at: DateTime<Utc>,
        answers: Vec<SubmissionAnswer>,
    ) -> Self {
        Self {
            id,
            flow_id,
            user_id,
            submitted_at,
            answers,
        }
    }
}
