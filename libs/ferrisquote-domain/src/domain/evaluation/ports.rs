use std::collections::HashMap;
use std::future::Future;

use serde::{Deserialize, Serialize};

use crate::domain::{
    error::DomainError,
    flows::entities::id::{BindingId, FlowId},
    submission::entities::Submission,
};

/// Output of a flow-level evaluation: per-binding maps of `output_key → value`,
/// plus a convenience flat view keyed `"<binding_id>.<output_key>"` for
/// clients that don't want to walk the nested shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEvaluationResult {
    pub bindings: HashMap<BindingId, HashMap<String, f64>>,
    pub flat: HashMap<String, f64>,
}

/// Outcome of a random preview evaluation: includes the synthetic submission
/// used so the client can display what values were injected.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowPreviewResult {
    pub submission: Submission,
    pub evaluation: FlowEvaluationResult,
}

pub trait FlowEvaluationService: Send + Sync {
    /// Evaluate all bindings of a flow against a user-supplied submission.
    fn evaluate_flow_bindings(
        &self,
        flow_id: FlowId,
        submission: Submission,
    ) -> impl Future<Output = Result<FlowEvaluationResult, DomainError>> + Send;

    /// Generate a random submission (respecting field types and step repeat
    /// bounds) and immediately evaluate the flow's bindings against it. Used
    /// by the "Test this flow" button in the builder UI.
    fn preview_flow(
        &self,
        flow_id: FlowId,
    ) -> impl Future<Output = Result<FlowPreviewResult, DomainError>> + Send;
}
