use axum::{
    Router,
    routing::{delete, get, post, put},
};

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    evaluation::ports::FlowEvaluationService,
    flows::ports::{BindingService, FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};

use crate::{handlers, state::AppState};

pub fn binding_flow_routes<
    FS: FlowService + StepService + FieldService + Clone + 'static,
    ES: EstimatorService + Clone + 'static,
    SS: SubmissionService + Clone + 'static,
    BS: BindingService + Clone + 'static,
    FES: FlowEvaluationService + Clone + 'static,
>() -> Router<AppState<FS, ES, SS, BS, FES>> {
    Router::new()
        .route("/{flow_id}/bindings", post(handlers::add_binding))
        .route("/{flow_id}/bindings", get(handlers::list_bindings))
        .route(
            "/{flow_id}/bindings/{binding_id}",
            put(handlers::update_binding),
        )
        .route(
            "/{flow_id}/bindings/{binding_id}",
            delete(handlers::remove_binding),
        )
}
