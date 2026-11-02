//! Memory-safe ZIP container validator for DOCX and XLSX documents.
//! Enforces strict decompressed-size bounds, compression ratio limits,
//! entry count ceilings, and internal path traversal checks to defeat Zip bombs.

use std::io::Cursor;
use zip::ZipArchive;

use crate::config::GatewayConfig;
use crate::models::{FileType, ValidationMetadata, ValidationReport};
use crate::signatures::compute_sha256;

/// Validates DOCX/XLSX zip container structure and enforces anti-exhaustion limits.
pub fn validate_zip_container(
    data: &[u8],
    original_filename: &str,
    sanitized_filename: &str,
    config: &GatewayConfig,
) -> ValidationReport {
    let sha256 = compute_sha256(data);
    let byte_size = data.len();

    // 1. Open archive in-memory without disk extraction
    let cursor = Cursor::new(data);
    let mut archive = match ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(e) => {
            return ValidationReport::failure(
                "CORRUPT_ZIP_CONTAINER",
                format!("Failed to parse ZIP container header: {}", e),
                sha256,
                byte_size,
                original_filename.to_string(),
                sanitized_filename.to_string(),
                vec!["Malformed archive format".to_string()],
            );
        }
    };

    let entry_count = archive.len();

    // 2. Enforce entry count ceiling
    if entry_count > config.max_zip_entries {
        return ValidationReport::failure(
            "EXCESSIVE_ZIP_ENTRIES",
            format!(
                "Archive contains {} entries; exceeds maximum limit of {}.",
                entry_count, config.max_zip_entries
            ),
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec!["Possible Zip bomb via excessive entry count".to_string()],
        );
    }

    if entry_count == 0 {
        return ValidationReport::failure(
            "EMPTY_ZIP_ARCHIVE",
            "Archive contains zero files or directory entries.",
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec![],
        );
    }

    let mut total_uncompressed_bytes: usize = 0;
    let mut is_docx = false;
    let mut is_xlsx = false;
    let mut has_content_types = false;
    let mut warnings = Vec::new();
    let mut threats = Vec::new();

    // 3. Inspect every entry in the central directory header WITHOUT decompressing
    for i in 0..entry_count {
        let file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                let err_str = e.to_string();
                if err_str.to_lowercase().contains("password") || err_str.to_lowercase().contains("encrypted") {
                    return ValidationReport::failure(
                        "ENCRYPTED_ZIP_UNSUPPORTED",
                        format!("Entry #{} is password-encrypted; encrypted archives are not supported.", i),
                        sha256,
                        byte_size,
                        original_filename.to_string(),
                        sanitized_filename.to_string(),
                        vec!["Encrypted payload prevents verification".to_string()],
                    );
                }
                return ValidationReport::failure(
                    "CORRUPT_ZIP_ENTRY",
                    format!("Entry #{} central directory record is corrupted: {}", i, e),
                    sha256,
                    byte_size,
                    original_filename.to_string(),
                    sanitized_filename.to_string(),
                    vec!["Corrupted entry header".to_string()],
                );
            }
        };

        let entry_name = file.name().to_string();

        // 3a. Path traversal prevention inside archive entry names
        if file.enclosed_name().is_none() || entry_name.contains("..") || entry_name.starts_with('/') || entry_name.starts_with('\\') || entry_name.contains('\0') {
            threats.push(format!("Entry '{}' contains illegal path traversal sequences.", entry_name));
        }

        // 3b. Accumulate uncompressed size & calculate compression ratio
        let uncompressed = file.size() as usize;
        let compressed = file.compressed_size() as usize;

        total_uncompressed_bytes = match total_uncompressed_bytes.checked_add(uncompressed) {
            Some(sum) => sum,
            None => {
                return ValidationReport::failure(
                    "ZIP_BOMB_OVERFLOW",
                    "Cumulative uncompressed archive size causes integer overflow.",
                    sha256,
                    byte_size,
                    original_filename.to_string(),
                    sanitized_filename.to_string(),
                    vec!["Decompression size integer overflow".to_string()],
                );
            }
        };

        // Check single entry ratio if compressed size > 0
        if compressed > 0 && uncompressed > 1024 * 1024 {
            let entry_ratio = (uncompressed as f64) / (compressed as f64);
            if entry_ratio > config.max_compression_ratio {
                return ValidationReport::failure(
                    "ZIP_BOMB_DETECTED",
                    format!(
                        "Entry '{}' exhibits abnormal compression ratio ({:.1}:1 > {:.1}:1).",
                        entry_name, entry_ratio, config.max_compression_ratio
                    ),
                    sha256,
                    byte_size,
                    original_filename.to_string(),
                    sanitized_filename.to_string(),
                    vec!["High compression ratio indicates zip bomb".to_string()],
                );
            }
        }

        // 3d. Check for format markers
        if entry_name == "[Content_Types].xml" {
            has_content_types = true;
        }
        if entry_name.starts_with("word/") || entry_name == "word/document.xml" {
            is_docx = true;
        }
        if entry_name.starts_with("xl/") || entry_name == "xl/workbook.xml" {
            is_xlsx = true;
        }

        // 3e. Check for macros / embedded executable files (.bin, .vba, .exe)
        if entry_name.ends_with(".bin") || entry_name.contains("vbaProject") {
            warnings.push(format!("Archive contains embedded binary or macro component: '{}'", entry_name));
        }
    }

    if !threats.is_empty() {
        return ValidationReport::failure(
            "MALICIOUS_ZIP_PATH",
            format!("Archive contains path traversal threats: {}", threats.join("; ")),
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            threats,
        );
    }

    // 4. Cumulative uncompressed size ceiling
    if total_uncompressed_bytes > config.max_decompressed_bytes {
        return ValidationReport::failure(
            "DECOMPRESSION_SIZE_EXCEEDED",
            format!(
                "Total uncompressed size ({} MB) exceeds maximum allowed limit ({} MB).",
                total_uncompressed_bytes / (1024 * 1024),
                config.max_decompressed_bytes / (1024 * 1024)
            ),
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec!["Decompression resource exhaustion attack".to_string()],
        );
    }

    // 5. Total overall compression ratio
    let overall_ratio = (total_uncompressed_bytes as f64) / (byte_size.max(1) as f64);
    if overall_ratio > config.max_compression_ratio && total_uncompressed_bytes > 2 * 1024 * 1024 {
        return ValidationReport::failure(
            "ZIP_BOMB_DETECTED",
            format!(
                "Overall archive compression ratio ({:.1}:1) exceeds safety ceiling ({:.1}:1).",
                overall_ratio, config.max_compression_ratio
            ),
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec!["Decompression explosion detected".to_string()],
        );
    }

    // 6. Verify required format structure
    let file_type = if is_docx && has_content_types {
        FileType::Docx
    } else if is_xlsx && has_content_types {
        FileType::Xlsx
    } else if has_content_types {
        // Fallback check based on filename extension
        if original_filename.to_lowercase().ends_with(".xlsx") {
            FileType::Xlsx
        } else {
            FileType::Docx
        }
    } else {
        return ValidationReport::failure(
            "INVALID_OPENXML_PACKAGE",
            "Archive is a valid ZIP but lacks required OpenXML package files ([Content_Types].xml, word/ or xl/).",
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec!["Unsupported generic ZIP archive".to_string()],
        );
    };

    let metadata = ValidationMetadata {
        zip_entry_count: Some(entry_count),
        total_uncompressed_bytes: Some(total_uncompressed_bytes),
        compression_ratio: Some(round_ratio(overall_ratio)),
        ..Default::default()
    };

    ValidationReport::success(
        file_type,
        sha256,
        byte_size,
        original_filename.to_string(),
        sanitized_filename.to_string(),
        warnings,
        metadata,
    )
}

fn round_ratio(r: f64) -> f64 {
    (r * 100.0).round() / 100.0
}
