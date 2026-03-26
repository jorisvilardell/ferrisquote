use axum::{Router, routing::get};
use tower_http::cors::{AllowHeaders, AllowMethods, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use ferrisquote_domain::domain::flows::ports::{FieldService, FlowService, StepService};

use crate::{openapi::ApiDoc, routes::flow_routes, state::AppState};

/// Build the complete API router with all routes
pub fn build_routes<S: FlowService + StepService + FieldService + Clone + 'static>(
    state: AppState<S>,
) -> Router {
    let allowed_origins = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());

    let cors = CorsLayer::new()
        .allow_origin(
            allowed_origins
                .split(',')
                .filter_map(|o| o.trim().parse().ok())
                .collect::<Vec<_>>(),
        )
        .allow_methods(AllowMethods::any())
        .allow_headers(AllowHeaders::any());

    let api = Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1/flows", flow_routes::flow_routes())
        .with_state(state);

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .merge(api)
        .layer(cors)
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
