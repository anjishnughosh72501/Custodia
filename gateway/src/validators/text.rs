//! Plain text and CSV document validation with formula injection detection.

use crate::models::{FileType, ValidationMetadata, ValidationReport};
use crate::signatures::{compute_sha256, is_likely_csv};

const MAX_LINE_LENGTH: usize = 1024 * 1024; // 1 MB max single line

/// Validates plain text or CSV file, detects encoding, null bytes, and formula injections.
pub fn validate_text_document(
    data: &[u8],
    original_filename: &str,
    sanitized_filename: &str,
) -> ValidationReport {
    let sha256 = compute_sha256(data);
    let byte_size = data.len();

    // 1. Check for null bytes (binary disguised as text)
    if data.contains(&0) {
        return ValidationReport::failure(
            "BINARY_DATA_IN_TEXT",
            "File contains null bytes (0x00); binary files cannot be processed as text/csv.",
            sha256,
            byte_size,
            original_filename.to_string(),
            sanitized_filename.to_string(),
            vec!["Disguised binary content".to_string()],
        );
    }

    // 2. Validate UTF-8 encoding
    let text = match std::str::from_utf8(data) {
        Ok(t) => t,
        Err(e) => {
            return ValidationReport::failure(
                "INVALID_UTF8_ENCODING",
                format!("Text document contains invalid UTF-8 byte sequences: {}", e),
                sha256,
                byte_size,
                original_filename.to_string(),
                sanitized_filename.to_string(),
                vec!["Encoding violation".to_string()],
            );
        }
    };

    let mut warnings = Vec::new();
    let mut contains_formulas = false;
    let mut line_count = 0;

    // 3. Scan lines for excessive length and CSV formula injection
    for (idx, line) in text.lines().enumerate() {
        line_count += 1;

        if line.len() > MAX_LINE_LENGTH {
            return ValidationReport::failure(
                "EXCESSIVE_LINE_LENGTH",
                format!("Line {} exceeds maximum allowed length of 1 MB.", idx + 1),
                sha256,
                byte_size,
                original_filename.to_string(),
                sanitized_filename.to_string(),
                vec!["Buffer overflow hazard in text parser".to_string()],
            );
        }

        // CSV Formula Injection detection (DDE / Excel formula execution)
        let trimmed = line.trim();
        for cell in trimmed.split(&[',', '\t', ';'][..]) {
            let c_trim = cell.trim();
            if c_trim.starts_with('=')
                || c_trim.starts_with('+')
                || c_trim.starts_with('@')
                || (c_trim.starts_with('-') && c_trim.len() > 1 && !c_trim.chars().nth(1).map_or(false, |c| c.is_ascii_digit()))
            {
                contains_formulas = true;
                if c_trim.contains("cmd") || c_trim.contains("powershell") || c_trim.contains("EXEC") || c_trim.contains("SYSTEM") {
                    warnings.push(format!(
                        "Potentially dangerous DDE command execution string detected in line {}: '{}'",
                        idx + 1,
                        &c_trim[..c_trim.len().min(40)]
                    ));
                }
            }
        }
    }

    if contains_formulas {
        warnings.push("Document contains cells starting with spreadsheet formula characters (=, +, -, @). Treated strictly as literal text.".to_string());
    }

    let is_csv = is_likely_csv(data) || original_filename.to_lowercase().ends_with(".csv");
    let file_type = if is_csv { FileType::Csv } else { FileType::Txt };

    let metadata = ValidationMetadata {
        contains_formulas: Some(contains_formulas),
        line_count: Some(line_count),
        encoding: Some("UTF-8".to_string()),
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
