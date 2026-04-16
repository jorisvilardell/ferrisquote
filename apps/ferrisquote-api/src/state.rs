use std::sync::Arc;

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::ports::{FieldService, FlowService, StepService},
};

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState<FS: FlowService + StepService + FieldService, ES: EstimatorService> {
    pub flow_service: Arc<FS>,
    pub estimator_service: Arc<ES>,
}

impl<FS: FlowService + StepService + FieldService, ES: EstimatorService> AppState<FS, ES> {
    pub fn new(flow_service: Arc<FS>, estimator_service: Arc<ES>) -> Self {
        Self {
            flow_service,
            estimator_service,
        }
    }
}
