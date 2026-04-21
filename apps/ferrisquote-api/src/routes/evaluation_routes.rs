use axum::{Router, routing::post};

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    evaluation::ports::FlowEvaluationService,
    flows::ports::{BindingService, FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};

use crate::{handlers, state::AppState};

pub fn evaluation_flow_routes<
    FS: FlowService + StepService + FieldService + Clone + 'static,
    ES: EstimatorService + Clone + 'static,
    SS: SubmissionService + Clone + 'static,
    BS: BindingService + Clone + 'static,
    FES: FlowEvaluationService + Clone + 'static,
>() -> Router<AppState<FS, ES, SS, BS, FES>> {
    Router::new()
        .route(
            "/{flow_id}/evaluate-bindings",
            post(handlers::evaluate_bindings),
        )
        .route(
            "/{flow_id}/evaluate-bindings-preview",
            post(handlers::preview_flow),
        )
}
