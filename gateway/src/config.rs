//! Configuration for Custodia Secure Document Gateway.
//! Reads environment variables with secure defaults.

use std::env;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct GatewayConfig {
    pub host: String,
    pub port: u16,
    pub max_file_bytes: usize,
    pub max_decompressed_bytes: usize,
    pub max_zip_entries: usize,
    pub max_compression_ratio: f64,
    pub concurrency_limit: usize,
    pub request_timeout_ms: u64,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            host: env::var("GATEWAY_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("GATEWAY_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8002),
            // Default 10 MB upload ceiling
            max_file_bytes: env::var("GATEWAY_MAX_FILE_BYTES")
                .ok()
                .and_then(|b| b.parse().ok())
                .unwrap_or(10 * 1024 * 1024),
            // Maximum total uncompressed payload from zip container (50 MB)
            max_decompressed_bytes: env::var("GATEWAY_MAX_DECOMPRESSED_BYTES")
                .ok()
                .and_then(|b| b.parse().ok())
                .unwrap_or(50 * 1024 * 1024),
            // Maximum entries in zip container (DOCX / XLSX)
            max_zip_entries: env::var("GATEWAY_MAX_ZIP_ENTRIES")
                .ok()
                .and_then(|n| n.parse().ok())
                .unwrap_or(1000),
            // Maximum allowed compression ratio before flagging as Zip Bomb
            max_compression_ratio: env::var("GATEWAY_MAX_COMPRESSION_RATIO")
                .ok()
                .and_then(|r| r.parse().ok())
                .unwrap_or(100.0),
            // Concurrency limit for parallel file validations
            concurrency_limit: env::var("GATEWAY_CONCURRENCY_LIMIT")
                .ok()
                .and_then(|c| c.parse().ok())
                .unwrap_or(16),
            // Timeout per validation request in milliseconds
            request_timeout_ms: env::var("GATEWAY_TIMEOUT_MS")
                .ok()
                .and_then(|t| t.parse().ok())
                .unwrap_or(5000),
        }
    }
}
