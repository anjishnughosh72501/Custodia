//! Custodia Secure Document Gateway — Binary Entry Point.
//! Runs a private local loopback microservice on 127.0.0.1:8002.

mod config;
mod models;
mod routes;
mod sanitizer;
mod signatures;
mod validators;

#[cfg(test)]
mod tests;

use config::GatewayConfig;
use routes::create_router;
use std::net::SocketAddr;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize structured logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "custodia_secure_gateway=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Load configuration
    let config = GatewayConfig::default();

    // 3. Security invariant: verify bind host is local loopback
    if config.host != "127.0.0.1" && config.host != "localhost" {
        panic!(
            "SECURITY VIOLATION: Custodia Secure Document Gateway must bind exclusively to 127.0.0.1 (attempted: {})",
            config.host
        );
    }

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let router = create_router(config.clone());

    info!(
        bind_addr = %addr,
        max_file_mb = config.max_file_bytes / (1024 * 1024),
        max_decompressed_mb = config.max_decompressed_bytes / (1024 * 1024),
        max_ratio = config.max_compression_ratio,
        "Starting Custodia Secure Document Gateway on private loopback interface"
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Custodia Secure Document Gateway stopped gracefully.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
