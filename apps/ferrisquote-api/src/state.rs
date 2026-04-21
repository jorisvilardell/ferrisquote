use std::sync::Arc;

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::ports::{FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
> {
    pub flow_service: Arc<FS>,
    pub estimator_service: Arc<ES>,
    pub submission_service: Arc<SS>,
}

impl<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
> AppState<FS, ES, SS>
{
    pub fn new(
        flow_service: Arc<FS>,
        estimator_service: Arc<ES>,
        submission_service: Arc<SS>,
    ) -> Self {
        Self {
            flow_service,
            estimator_service,
            submission_service,
        }
    }
}
