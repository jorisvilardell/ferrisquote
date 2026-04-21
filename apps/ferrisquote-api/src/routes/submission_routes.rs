use axum::{
    Router,
    routing::{get, post},
};

use ferrisquote_domain::domain::{
    estimator::ports::EstimatorService,
    flows::ports::{FieldService, FlowService, StepService},
    submission::ports::SubmissionService,
};

use crate::{handlers, state::AppState};

/// Submission routes nested under /flows (submit + list per flow).
pub fn submission_flow_routes<
    FS: FlowService + StepService + FieldService + Clone + 'static,
    ES: EstimatorService + Clone + 'static,
    SS: SubmissionService + Clone + 'static,
    BS: ferrisquote_domain::domain::flows::ports::BindingService + Clone + 'static,
>() -> Router<AppState<FS, ES, SS, BS>> {
    Router::new()
        .route("/{flow_id}/submissions", post(handlers::submit_answers))
        .route(
            "/{flow_id}/submissions",
            get(handlers::list_submissions_for_flow),
        )
}

/// Standalone submission routes under /submissions (fetch by id).
pub fn submission_routes<
    FS: FlowService + StepService + FieldService + Clone + 'static,
    ES: EstimatorService + Clone + 'static,
    SS: SubmissionService + Clone + 'static,
    BS: ferrisquote_domain::domain::flows::ports::BindingService + Clone + 'static,
>() -> Router<AppState<FS, ES, SS, BS>> {
    Router::new().route(
        "/{submission_id}",
        get(handlers::get_submission_by_id),
    )
}
