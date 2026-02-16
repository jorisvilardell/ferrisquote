use ferrisquote_domain::domain::flows::services::FlowServiceImpl;
use ferrisquote_postgres::repositories::flow_repository::PostgresFlowRepository;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod state;

use state::AppState;

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

    // DI minimal: repo + service + app_state
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to Postgres");

    // Repository (no Arc needed - PgPool is already Arc internally)
    let flow_repository = PostgresFlowRepository::new(pool);

    // Service (concrete type for static dispatch)
    let flow_service = FlowServiceImpl::new(flow_repository);

    // AppState with Arc for sharing across handlers
    // Static dispatch: compiler infers concrete types at compile time
    let app_state = AppState::new(Arc::new(flow_service));

    // Router minimal (sans routes custom)
    let app = axum::Router::new().with_state(app_state);

    // Server
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
