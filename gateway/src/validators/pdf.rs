//! Memory-safe PDF document structure validator.

use crate::models::{FileType, ValidationMetadata, ValidationReport};
use crate::signatures::compute_sha256;

const PDF_TRAILER_EOF: &[u8] = b"%%EOF";

/// Validates PDF structure, header, trailer EOF, and scans for active content risks.
pub fn validate_pdf(
    data: &[u8],
    original_filename: &str,
    sanitized_filename: &str,
) -> ValidationReport {
    let sha256 = compute_sha256(data);
    let byte_size = data.len();

    if byte_size < 32 {
        return ValidationReport::failure(
            "TRUNCATED_PDF",
            "PDF file is too small to contain valid structural markers.",
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec!["Truncated file payload".to_string()],
        );
    }

    // 1. Verify Header (%PDF-1.x or %PDF-2.x)
    let header_window = &data[..data.len().min(1024)];
    let header_pos = match header_window.windows(5).position(|w| w == b"%PDF-") {
        Some(pos) => pos,
        None => {
            return ValidationReport::failure(
                "INVALID_PDF_HEADER",
                "Missing standard %PDF- header within initial 1KB.",
                sha256,
                byte_size,
                original_filename.to_string(),
                sanitized_filename.to_string(),
                vec!["Missing PDF signature".to_string()],
            );
        }
    };

    // Extract PDF version if present (e.g. 1.7)
    let version = if header_pos + 8 <= data.len() {
        std::str::from_utf8(&data[header_pos + 5..header_pos + 8])
            .ok()
            .map(|s| s.trim().to_string())
    } else {
        None
    };

    // 2. Check for trailer EOF marker in trailing 4096 bytes
    let trailer_start = data.len().saturating_sub(4096);
    let trailer_window = &data[trailer_start..];
    let has_eof = trailer_window
        .windows(PDF_TRAILER_EOF.len())
        .any(|w| w == PDF_TRAILER_EOF);

    let mut warnings = Vec::new();
    let mut threats = Vec::new();

    if !has_eof {
        warnings.push("PDF lacks standard %%EOF trailer marker; document may be truncated or non-linear.".to_string());
    }

    // 3. Scan for executable active content strings (/Launch, /JavaScript, /JS)
    // Note: We flag as warning/threat rather than silently ignoring
    let text_sample = String::from_utf8_lossy(data);
    if text_sample.contains("/Launch") {
        threats.push("PDF contains /Launch action which could execute external programs.".to_string());
    }
    if text_sample.contains("/JavaScript") || text_sample.contains("/JS") {
        warnings.push("PDF contains embedded JavaScript streams.".to_string());
    }
    if text_sample.contains("/EmbeddedFiles") {
        warnings.push("PDF contains embedded secondary file attachments.".to_string());
    }

    let metadata = ValidationMetadata {
        has_pdf_eof: Some(has_eof),
        pdf_version: version,
        ..Default::default()
    };

    if !threats.is_empty() {
        return ValidationReport::failure(
            "SUSPICIOUS_PDF_ACTIONS",
            format!("PDF rejected due to dangerous content: {}", threats.join("; ")),
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            threats,
        );
    }

    ValidationReport::success(
        FileType::Pdf,
        sha256,
        byte_size,
        original_filename.to_string(),
        sanitized_filename.to_string(),
        warnings,
        metadata,
    )
}
