use std::sync::Arc;

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    evaluation::ports::FlowEvaluationService,
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
    FES: FlowEvaluationService,
> {
    pub flow_service: Arc<FS>,
    pub estimator_service: Arc<ES>,
    pub submission_service: Arc<SS>,
    pub binding_service: Arc<BS>,
    pub flow_evaluation_service: Arc<FES>,
}

impl<
    FS: FlowService + StepService + FieldService,
    ES: EstimatorService,
    SS: SubmissionService,
    BS: BindingService,
    FES: FlowEvaluationService,
> AppState<FS, ES, SS, BS, FES>
{
    pub fn new(
        flow_service: Arc<FS>,
        estimator_service: Arc<ES>,
        submission_service: Arc<SS>,
        binding_service: Arc<BS>,
        flow_evaluation_service: Arc<FES>,
    ) -> Self {
        Self {
            flow_service,
            estimator_service,
            submission_service,
            binding_service,
            flow_evaluation_service,
        }
    }
}
