use axum::{
    Router,
    routing::{delete, get, post, put},
};

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::ports::{FieldService, FlowService, StepService},
};

use crate::{handlers, state::AppState};

/// Estimator routes nested under /flows (create + list by flow, flow-wide evaluation)
pub fn estimator_flow_routes<FS: FlowService + StepService + FieldService + Clone + 'static, ES: EstimatorService + Clone + 'static>(
) -> Router<AppState<FS, ES>> {
    Router::new()
        .route("/{flow_id}/estimators", post(handlers::create_estimator))
        .route("/{flow_id}/estimators", get(handlers::list_estimators))
        .route("/{flow_id}/evaluate-all", post(handlers::evaluate_flow))
}

/// Standalone estimator routes under /estimators
pub fn estimator_routes<FS: FlowService + StepService + FieldService + Clone + 'static, ES: EstimatorService + Clone + 'static>(
) -> Router<AppState<FS, ES>> {
    Router::new()
        .route("/{estimator_id}", get(handlers::get_estimator))
        .route("/{estimator_id}", put(handlers::update_estimator))
        .route("/{estimator_id}", delete(handlers::delete_estimator))
        .route("/{estimator_id}/variables", post(handlers::add_variable))
        .route("/{estimator_id}/evaluate", post(handlers::evaluate))
        .route(
            "/{estimator_id}/evaluate-submission",
            post(handlers::evaluate_submission),
        )
}

/// Variable routes under /variables
pub fn variable_routes<FS: FlowService + StepService + FieldService + Clone + 'static, ES: EstimatorService + Clone + 'static>(
) -> Router<AppState<FS, ES>> {
    Router::new()
        .route("/{variable_id}", put(handlers::update_variable))
        .route("/{variable_id}", delete(handlers::remove_variable))
}
