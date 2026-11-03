//! Magic byte signature identification and extension mismatch detection.

use sha2::{Digest, Sha256};
use std::path::Path;

use crate::models::FileType;

/// Magic byte signatures
const PDF_MAGIC: &[u8] = b"%PDF-";
const ZIP_MAGIC: &[u8] = &[0x50, 0x4B, 0x03, 0x04]; // PK..
const ELF_MAGIC: &[u8] = &[0x7F, 0x45, 0x4C, 0x46]; // .ELF
const PE_MAGIC: &[u8] = &[0x4D, 0x5A]; // MZ (Windows exe/dll)
const SHELL_MAGIC: &[u8] = b"#!";

/// Computes SHA-256 fingerprint in hex
pub fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Identifies file type based on byte content signatures rather than extensions
pub fn identify_signature(data: &[u8]) -> Option<FileType> {
    if data.is_empty() {
        return None;
    }

    // 1. PDF detection (within first 1024 bytes)
    let search_window = &data[..data.len().min(1024)];
    if search_window
        .windows(PDF_MAGIC.len())
        .any(|w| w == PDF_MAGIC)
    {
        return Some(FileType::Pdf);
    }

    // 2. ZIP container detection (DOCX or XLSX)
    if data.starts_with(ZIP_MAGIC) {
        // We return Docx by default for zip containers; the zip validator
        // will verify internal manifest to distinguish Docx vs Xlsx
        return Some(FileType::Docx);
    }

    // 3. Text / CSV detection: must be valid UTF-8 and contain no null bytes
    if is_valid_text(data) {
        if is_likely_csv(data) {
            return Some(FileType::Csv);
        }
        return Some(FileType::Txt);
    }

    None
}

/// Checks if data is clean UTF-8 text without control/null bytes
pub fn is_valid_text(data: &[u8]) -> bool {
    if data.is_empty() {
        return false;
    }
    // Reject binary null bytes
    if data.contains(&0) {
        return false;
    }
    // Must be valid UTF-8
    std::str::from_utf8(data).is_ok()
}

/// Checks if text content has CSV characteristics (comma/tab delimiters in line structure)
pub fn is_likely_csv(data: &[u8]) -> bool {
    if let Ok(text) = std::str::from_utf8(&data[..data.len().min(4096)]) {
        let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
        if lines.len() >= 2 {
            let first = lines[0];
            let commas = first.matches(',').count();
            let tabs = first.matches('\t').count();
            let semicolons = first.matches(';').count();
            return commas >= 1 || tabs >= 1 || semicolons >= 1;
        }
    }
    false
}

/// Checks for suspicious executable binaries (ELF, PE, shell scripts)
pub fn is_suspicious_binary(data: &[u8]) -> Option<&'static str> {
    if data.starts_with(ELF_MAGIC) {
        return Some("Linux ELF Executable binary disguised as document");
    }
    if data.starts_with(PE_MAGIC) {
        return Some("Windows PE / DLL executable disguised as document");
    }
    if data.starts_with(SHELL_MAGIC) {
        return Some("Executable Shell script disguised as document");
    }
    None
}

/// Compares file extension against detected type to prevent disguised uploads
pub fn check_extension_mismatch(filename: &str, detected: FileType) -> Result<(), String> {
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match detected {
        FileType::Pdf => {
            if ext != "pdf" {
                return Err(format!(
                    "Extension mismatch: content is PDF but file extension is '.{}'",
                    ext
                ));
            }
        }
        FileType::Docx => {
            if ext != "docx" && ext != "xlsx" {
                return Err(format!(
                    "Extension mismatch: content is OpenXML package but file extension is '.{}'",
                    ext
                ));
            }
        }
        FileType::Xlsx => {
            if ext != "xlsx" && ext != "docx" {
                return Err(format!(
                    "Extension mismatch: content is spreadsheet but file extension is '.{}'",
                    ext
                ));
            }
        }
        FileType::Csv => {
            if ext != "csv" && ext != "tsv" && ext != "txt" {
                return Err(format!(
                    "Extension mismatch: content is CSV/tabular text but file extension is '.{}'",
                    ext
                ));
            }
        }
        FileType::Txt => {
            if ext != "txt" && ext != "md" && ext != "csv" && ext != "log" {
                return Err(format!(
                    "Extension mismatch: content is plain text but file extension is '.{}'",
                    ext
                ));
            }
        }
    }
    Ok(())
}
