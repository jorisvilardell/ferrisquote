use axum::{
    Router,
    routing::{delete, get, post, put},
};

use ferrisquote_domain::domain::flows::ports::FlowService;

use crate::{handlers, state::AppState};

/// Flow-specific routes
pub fn flow_routes<S: FlowService + Clone + 'static>() -> Router<AppState<S>> {
    Router::new()
        // Flow CRUD
        .route("/", post(handlers::create_flow))
        .route("/", get(handlers::list_flows))
        .route("/:flow_id", get(handlers::get_flow))
        .route("/:flow_id", put(handlers::update_flow_metadata))
        .route("/:flow_id", delete(handlers::delete_flow))
        // Step management
        .route("/:flow_id/steps", post(handlers::add_step))
        .route("/steps/:step_id", delete(handlers::remove_step))
        .route("/steps/:step_id/reorder", put(handlers::reorder_step))
        // Field management
        .route("/steps/:step_id/fields", post(handlers::add_field))
        .route("/fields/:field_id", put(handlers::update_field_config))
        .route("/fields/:field_id", delete(handlers::remove_field))
        .route("/fields/:field_id/move", put(handlers::move_field))
}
