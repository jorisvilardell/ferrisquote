use std::sync::Arc;

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::ports::{BindingService, FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
> {
    pub flow_service: Arc<FS>,
    pub estimator_service: Arc<ES>,
    pub submission_service: Arc<SS>,
    pub binding_service: Arc<BS>,
}

impl<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
> AppState<FS, ES, SS, BS>
{
    pub fn new(
        flow_service: Arc<FS>,
        estimator_service: Arc<ES>,
        submission_service: Arc<SS>,
        binding_service: Arc<BS>,
    ) -> Self {
        Self {
            flow_service,
            estimator_service,
            submission_service,
            binding_service,
        }
    }
}
