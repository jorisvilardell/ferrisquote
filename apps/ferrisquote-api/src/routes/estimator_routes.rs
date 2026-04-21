use axum::{
    Router,
    routing::{delete, get, post, put},
};

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::ports::{FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};

use crate::{handlers, state::AppState};

pub fn estimator_flow_routes<
    FS: FlowService + StepService + FieldService + Clone + 'static,
    ES: EstimatorService + Clone + 'static,
    SS: SubmissionService + Clone + 'static,
    BS: ferrisquote_domain::domain::flows::ports::BindingService + Clone + 'static,
    FES: ferrisquote_domain::domain::evaluation::ports::FlowEvaluationService + Clone + 'static,
>() -> Router<AppState<FS, ES, SS, BS, FES>> {
    Router::new()
        .route("/{flow_id}/estimators", post(handlers::create_estimator))
        .route("/{flow_id}/estimators", get(handlers::list_estimators))
        .route("/{flow_id}/evaluate-all", post(handlers::evaluate_flow))
}

pub fn estimator_routes<
    FS: FlowService + StepService + FieldService + Clone + 'static,
    ES: EstimatorService + Clone + 'static,
    SS: SubmissionService + Clone + 'static,
    BS: ferrisquote_domain::domain::flows::ports::BindingService + Clone + 'static,
    FES: ferrisquote_domain::domain::evaluation::ports::FlowEvaluationService + Clone + 'static,
>() -> Router<AppState<FS, ES, SS, BS, FES>> {
    Router::new()
        .route("/{estimator_id}", get(handlers::get_estimator))
        .route("/{estimator_id}", put(handlers::update_estimator))
        .route("/{estimator_id}", delete(handlers::delete_estimator))
        .route("/{estimator_id}/inputs", post(handlers::add_input))
        .route(
            "/{estimator_id}/inputs/{input_id}",
            put(handlers::update_input),
        )
        .route(
            "/{estimator_id}/inputs/{input_id}",
            delete(handlers::remove_input),
        )
        .route("/{estimator_id}/outputs", post(handlers::add_output))
        .route(
            "/{estimator_id}/outputs/{output_id}",
            put(handlers::update_output),
        )
        .route(
            "/{estimator_id}/outputs/{output_id}",
            delete(handlers::remove_output),
        )
        .route("/{estimator_id}/evaluate", post(handlers::evaluate))
        .route(
            "/{estimator_id}/evaluate-submission",
            post(handlers::evaluate_submission),
        )
}
