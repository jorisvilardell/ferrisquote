use axum::{Router, routing::get};

use ferrisquote_domain::domain::flows::ports::{FieldService, FlowService, StepService};

use crate::{routes::flow_routes, state::AppState};

/// Build the complete API router with all routes
pub fn build_routes<S: FlowService + StepService + FieldService + Clone + 'static>(
    state: AppState<S>,
) -> Router {
    Router::new()
        // Health check
        .route("/health", get(health_check))
        // Flow routes
        .nest("/api/v1/flows", flow_routes::flow_routes())
        // Add state to all routes
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
