//! HTTP routes and request handlers for the Axum gateway service.

use axum::{
    body::Bytes,
    extract::{Multipart, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{error, info, warn};

use crate::config::GatewayConfig;
use crate::models::ValidationReport;
use crate::sanitizer::sanitize_filename;
use crate::validators::validate_document;

pub struct AppState {
    pub config: GatewayConfig,
    pub semaphore: Arc<Semaphore>,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
    pub max_file_bytes: usize,
    pub max_decompressed_bytes: usize,
    pub max_compression_ratio: f64,
}

#[derive(Deserialize)]
pub struct SanitizeRequest {
    pub filename: String,
}

#[derive(Serialize)]
pub struct SanitizeResponse {
    pub original: String,
    pub sanitized: String,
}

pub fn create_router(config: GatewayConfig) -> Router {
    let concurrency_limit = config.concurrency_limit;
    let state = Arc::new(AppState {
        config,
        semaphore: Arc::new(Semaphore::new(concurrency_limit)),
    });

    Router::new()
        .route("/health", get(health_handler))
        .route("/validate", post(validate_multipart_handler))
        .route("/validate-raw", post(validate_raw_handler))
        .route("/sanitize-filename", post(sanitize_filename_handler))
        .with_state(state)
}

async fn health_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        service: "custodia-secure-gateway",
        version: "0.1.0",
        max_file_bytes: state.config.max_file_bytes,
        max_decompressed_bytes: state.config.max_decompressed_bytes,
        max_compression_ratio: state.config.max_compression_ratio,
    })
}

async fn sanitize_filename_handler(Json(req): Json<SanitizeRequest>) -> impl IntoResponse {
    let clean = sanitize_filename(&req.filename);
    Json(SanitizeResponse {
        original: req.filename,
        sanitized: clean,
    })
}

async fn validate_multipart_handler(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let (filename, data) = match extract_from_multipart(&mut multipart).await {
        Ok(res) => res,
        Err((status, report)) => return (status, Json(report)),
    };

    execute_validation(&state, filename, data).await
}

async fn validate_raw_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> impl IntoResponse {
    let raw_name = headers
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unnamed_document")
        .to_string();

    execute_validation(&state, raw_name, body_bytes.to_vec()).await
}

async fn execute_validation(
    state: &Arc<AppState>,
    filename: String,
    data: Vec<u8>,
) -> (StatusCode, Json<ValidationReport>) {
    // Acquire concurrency permit to prevent CPU/memory exhaustion
    let _permit = match state.semaphore.try_acquire() {
        Ok(p) => p,
        Err(_) => {
            warn!("Document gateway concurrency ceiling reached; rejecting excess load");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ValidationReport::failure(
                    "CONCURRENCY_LIMIT_REACHED",
                    "Gateway is busy processing maximum concurrent uploads. Please retry shortly.",
                    String::new(),
                    0,
                    filename.clone(),
                    sanitize_filename(&filename),
                    vec!["Concurrency ceiling saturated".to_string()],
                )),
            );
        }
    };

    info!(
        filename = %filename,
        byte_size = data.len(),
        "Running memory-safe document validation"
    );

    let report = validate_document(&data, &filename, &state.config);

    if report.valid {
        info!(
            filename = %report.sanitized_filename,
            file_type = ?report.file_type,
            sha256 = %report.sha256,
            "Document validated successfully"
        );
        (StatusCode::OK, Json(report))
    } else {
        warn!(
            filename = %report.sanitized_filename,
            error_code = ?report.error_code,
            "Document validation rejected untrusted upload"
        );
        (StatusCode::UNPROCESSABLE_ENTITY, Json(report))
    }
}

#[allow(clippy::result_large_err)]
async fn extract_from_multipart(
    multipart: &mut Multipart,
) -> Result<(String, Vec<u8>), (StatusCode, ValidationReport)> {
    let mut filename = "uploaded_document".to_string();
    let mut data: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" || field.file_name().is_some() {
            if let Some(fn_str) = field.file_name() {
                filename = fn_str.to_string();
            }
            match field.bytes().await {
                Ok(b) => {
                    data = Some(b.to_vec());
                    break;
                }
                Err(e) => {
                    error!("Failed to read multipart stream: {}", e);
                    return Err((
                        StatusCode::BAD_REQUEST,
                        ValidationReport::failure(
                            "STREAM_READ_ERROR",
                            format!("Failed to read upload stream: {}", e),
                            String::new(),
                            0,
                            filename.clone(),
                            sanitize_filename(&filename),
                            vec![],
                        ),
                    ));
                }
            }
        }
    }

    match data {
        Some(d) => Ok((filename, d)),
        None => Err((
            StatusCode::BAD_REQUEST,
            ValidationReport::failure(
                "MISSING_FILE_FIELD",
                "Multipart payload missing 'file' field.",
                String::new(),
                0,
                filename.clone(),
                sanitize_filename(&filename),
                vec![],
            ),
        )),
    }
}
