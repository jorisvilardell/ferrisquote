use ferrisquote_domain::domain::{
    estimator::services::EstimatorServiceImpl,
    flows::services::FlowServiceImpl,
    rank::services::LexoRankProvider,
    submission::services::SubmissionServiceImpl,
};
use ferrisquote_postgres::repositories::{
    estimator_repository::PostgresEstimatorRepository,
    flow_repository::PostgresFlowRepository,
    submission_repository::PostgresSubmissionRepository,
};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod error;
mod openapi;
mod state;

use routes::build_routes::build_routes;
use state::AppState;

pub mod dto;
pub mod handlers;
pub mod routes;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Env
    dotenvy::dotenv().ok();

    // Tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ferrisquote_api=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting FerrisQuote API (minimal)");

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to Postgres");

    let pg_pool = Arc::new(pool);

    let flow_repo = PostgresFlowRepository::with_pool(pg_pool.clone());
    let estimator_repo = PostgresEstimatorRepository::with_pool(pg_pool.clone());
    let submission_repo = PostgresSubmissionRepository::with_pool(pg_pool);
    let rank_service = LexoRankProvider;

    let flow_service = FlowServiceImpl::new(
        flow_repo.clone(),
        flow_repo.clone(),
        flow_repo.clone(),
        rank_service,
    );

    let estimator_service = EstimatorServiceImpl::new(estimator_repo);
    let submission_service = SubmissionServiceImpl::new(submission_repo, flow_repo);

    let app_state = AppState::new(
        Arc::new(flow_service),
        Arc::new(estimator_service),
        Arc::new(submission_service),
    );

    let app = build_routes(app_state);

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
