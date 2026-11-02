//! Core validation dispatcher coordinating all file type validators and security checks.

pub mod pdf;
pub mod text;
pub mod zip_archive;

use crate::config::GatewayConfig;
use crate::models::{FileType, ValidationReport};
use crate::sanitizer::sanitize_filename;
use crate::signatures::{
    check_extension_mismatch, compute_sha256, identify_signature, is_suspicious_binary,
};

/// Master document validator entry point.
pub fn validate_document(
    data: &[u8],
    raw_filename: &str,
    config: &GatewayConfig,
) -> ValidationReport {
    let sanitized_filename = sanitize_filename(raw_filename);
    let sha256 = compute_sha256(data);
    let byte_size = data.len();

    // 1. Reject empty uploads
    if byte_size == 0 {
        return ValidationReport::failure(
            "EMPTY_FILE",
            format!("File '{}' is empty (0 bytes).", sanitized_filename),
            sha256,
            0,
            raw_filename.to_string(),
            sanitized_filename,
            vec![],
        );
    }

    // 2. Reject files exceeding max configured size
    if byte_size > config.max_file_bytes {
        return ValidationReport::failure(
            "FILE_TOO_LARGE",
            format!(
                "File size ({} MB) exceeds maximum allowed size ({} MB).",
                byte_size / (1024 * 1024),
                config.max_file_bytes / (1024 * 1024)
            ),
            sha256,
            byte_size,
            raw_filename.to_string(),
            sanitized_filename,
            vec!["Payload size quota exceeded".to_string()],
        );
    }

    // 3. Scan for disguised executable binaries (ELF, Windows PE/EXE, scripts)
    if let Some(binary_threat) = is_suspicious_binary(data) {
        return ValidationReport::failure(
            "DISGUISED_EXECUTABLE_REJECTED",
            format!("Rejected dangerous executable payload: {}", binary_threat),
            sha256,
            byte_size,
            raw_filename.to_string(),
            sanitized_filename,
            vec![binary_threat.to_string()],
        );
    }

    // 4. Identify signature from actual byte content
    let detected_type = match identify_signature(data) {
        Some(t) => t,
        None => {
            return ValidationReport::failure(
                "UNSUPPORTED_OR_MALFORMED_FORMAT",
                "File format signature not recognized. Supported formats: PDF, DOCX, XLSX, CSV, TXT.",
                sha256,
                byte_size,
                raw_filename.to_string(),
                sanitized_filename,
                vec!["Unrecognized magic signature".to_string()],
            );
        }
    };

    // 5. Check extension vs content mismatch
    if let Err(mismatch_err) = check_extension_mismatch(&sanitized_filename, detected_type) {
        return ValidationReport::failure(
            "EXTENSION_CONTENT_MISMATCH",
            mismatch_err,
            sha256,
            byte_size,
            raw_filename.to_string(),
            sanitized_filename,
            vec!["Extension spoofing detected".to_string()],
        );
    }

    // 6. Deep format validation
    match detected_type {
        FileType::Pdf => pdf::validate_pdf(data, raw_filename, &sanitized_filename),
        FileType::Docx | FileType::Xlsx => {
            zip_archive::validate_zip_container(data, raw_filename, &sanitized_filename, config)
        }
        FileType::Csv | FileType::Txt => {
            text::validate_text_document(data, raw_filename, &sanitized_filename)
        }
    }
}
