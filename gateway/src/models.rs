//! Data models and structured reports for Custodia Secure Document Gateway.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    Pdf,
    Docx,
    Xlsx,
    Csv,
    Txt,
}

#[allow(dead_code)]
impl FileType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileType::Pdf => "pdf",
            FileType::Docx => "docx",
            FileType::Xlsx => "xlsx",
            FileType::Csv => "csv",
            FileType::Txt => "txt",
        }
    }

    pub fn standard_mime(&self) -> &'static str {
        match self {
            FileType::Pdf => "application/pdf",
            FileType::Docx => {
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }
            FileType::Xlsx => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            FileType::Csv => "text/csv",
            FileType::Txt => "text/plain",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValidationMetadata {
    pub has_pdf_eof: Option<bool>,
    pub pdf_version: Option<String>,
    pub zip_entry_count: Option<usize>,
    pub total_uncompressed_bytes: Option<usize>,
    pub compression_ratio: Option<f64>,
    pub contains_formulas: Option<bool>,
    pub line_count: Option<usize>,
    pub encoding: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub valid: bool,
    pub file_type: Option<FileType>,
    pub mime_type: Option<String>,
    pub sha256: String,
    pub byte_size: usize,
    pub original_filename: String,
    pub sanitized_filename: String,
    pub warnings: Vec<String>,
    pub threats_detected: Vec<String>,
    pub metadata: ValidationMetadata,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub validated_at: String,
}

impl ValidationReport {
    pub fn success(
        file_type: FileType,
        sha256: String,
        byte_size: usize,
        original_filename: String,
        sanitized_filename: String,
        warnings: Vec<String>,
        metadata: ValidationMetadata,
    ) -> Self {
        Self {
            valid: true,
            mime_type: Some(file_type.standard_mime().to_string()),
            file_type: Some(file_type),
            sha256,
            byte_size,
            original_filename,
            sanitized_filename,
            warnings,
            threats_detected: Vec::new(),
            metadata,
            error_code: None,
            error_message: None,
            validated_at: chrono_now_iso(),
        }
    }

    pub fn failure(
        error_code: impl Into<String>,
        error_message: impl Into<String>,
        sha256: String,
        byte_size: usize,
        original_filename: String,
        sanitized_filename: String,
        threats_detected: Vec<String>,
    ) -> Self {
        Self {
            valid: false,
            file_type: None,
            mime_type: None,
            sha256,
            byte_size,
            original_filename,
            sanitized_filename,
            warnings: Vec::new(),
            threats_detected,
            metadata: ValidationMetadata::default(),
            error_code: Some(error_code.into()),
            error_message: Some(error_message.into()),
            validated_at: chrono_now_iso(),
        }
    }
}

fn chrono_now_iso() -> String {
    // Generate ISO 8601 string without pulling heavy datetime libraries
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}Z", duration.as_secs(), duration.subsec_millis())
}
