use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::flows::entities::ids::{FlowId, StepId};
use crate::domain::user::entities::UserId;

use super::id::SubmissionId;
use super::step_iteration::StepIteration;

/// Aggregate of answers given by a user to a flow questionnaire.
/// Answers are nested: step_id → ordered list of iterations (for
/// repeatable steps). Each iteration holds one answer per field.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Submission {
    pub id: SubmissionId,
    pub flow_id: FlowId,
    pub user_id: UserId,
    pub submitted_at: DateTime<Utc>,
    pub answers: HashMap<StepId, Vec<StepIteration>>,
}

impl Submission {
    pub fn new(
        flow_id: FlowId,
        user_id: UserId,
        answers: HashMap<StepId, Vec<StepIteration>>,
    ) -> Self {
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
        answers: HashMap<StepId, Vec<StepIteration>>,
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
