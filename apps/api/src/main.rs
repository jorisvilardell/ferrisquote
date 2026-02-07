use std::{
    net::{SocketAddr, ToSocketAddrs},
    sync::Arc,
};

use axum::Router;
use clap::Parser;
use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::{
    args::{Args, LogArgs},
    errors::ApiError,
    router::router,
    state::state,
};

pub mod args;
pub mod errors;
pub mod response;
pub mod router;
pub mod state;

pub async fn get_addr(host: &str, port: u16) -> Result<SocketAddr, ApiError> {
    let addrs = format!("{}:{}", host, port)
        .to_socket_addrs()
        .map_err(|e| ApiError::InternalServerError {
            reason: format!("Failed to resolve address: {}", e),
        })?
        .collect::<Vec<SocketAddr>>();

    let socket = match addrs.first() {
        Some(addr) => *addr,
        None => {
            return Err(ApiError::InternalServerError {
                reason: "No socket adresses found".into(),
            });
        }
    };

    Ok(socket)
}

pub fn init_logger(args: &LogArgs) {
    let filter = EnvFilter::try_new(&args.filter).unwrap_or_else(|err| {
        eprintln!("invalid log filter: {err}");
        eprintln!("using default log filter: info");
        EnvFilter::new("info")
    });

    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr);

    if args.json {
        subscriber.json().init();
    } else {
        subscriber.init();
    }
}

pub async fn run_server(addr: SocketAddr, router: Router) {
    info!("listening on {addr}");

    axum_server::bind(addr)
        .serve(router.into_make_service())
        .await
        .expect("error when start server")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    let args = Arc::new(Args::parse());
    init_logger(&args.log);

    let app_state = state(args.clone()).await?;

    let router = router(app_state)?;

    let addr = get_addr(&args.server.host, args.server.port).await?;

    run_server(addr, router).await;

    Ok(())
}
