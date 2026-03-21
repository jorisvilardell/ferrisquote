use std::sync::Arc;

use ferrisquote_domain::domain::flows::ports::{FieldService, FlowService, StepService};

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState<S: FlowService + StepService + FieldService> {
    pub flow_service: Arc<S>,
}

impl<S: FlowService + StepService + FieldService> AppState<S> {
    pub fn new(flow_service: Arc<S>) -> Self {
        Self { flow_service }
    }
}
