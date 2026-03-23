use axum::{Router, routing::get};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use ferrisquote_domain::domain::flows::ports::{FieldService, FlowService, StepService};

use crate::{openapi::ApiDoc, routes::flow_routes, state::AppState};

/// Build the complete API router with all routes
pub fn build_routes<S: FlowService + StepService + FieldService + Clone + 'static>(
    state: AppState<S>,
) -> Router {
    let api = Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1/flows", flow_routes::flow_routes())
        .with_state(state);

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .merge(api)
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
