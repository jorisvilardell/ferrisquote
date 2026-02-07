use axum::{
    Router,
    extract::Request,
    http::{
        HeaderValue, Method,
        header::{ACCEPT, AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE, LOCATION},
    },
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info_span;

use crate::{errors::ApiError, state::AppState};

pub fn router(state: AppState) -> Result<Router, ApiError> {
    let trace_layer = TraceLayer::new_for_http().make_span_with(|request: &Request| {
        let uri: String = request.uri().to_string();
        info_span!("http_request", method = ?request.method(), uri)
    });

    let allowed_origins: Vec<HeaderValue> = vec![HeaderValue::from_static("http://localhost:5173")];

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::DELETE,
            Method::PUT,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_origin(allowed_origins)
        .allow_headers([
            AUTHORIZATION,
            CONTENT_TYPE,
            CONTENT_LENGTH,
            ACCEPT,
            LOCATION,
        ])
        .allow_credentials(true);

    let router = Router::new()
        .layer(trace_layer)
        .layer(cors)
        .with_state(state);

    Ok(router)
}
