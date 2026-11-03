//! Unit and integration test suite for Custodia Secure Document Gateway.

use crate::config::GatewayConfig;
use crate::models::FileType;
use crate::sanitizer::sanitize_filename;
use crate::validators::validate_document;
use std::io::Write;
use zip::write::FileOptions;
use zip::ZipWriter;

fn build_mock_docx() -> Vec<u8> {
    let mut buf = Vec::new();
    {
        let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buf));
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        zip.start_file("[Content_Types].xml", options).unwrap();
        zip.write_all(b"<?xml version=\"1.0\"?><Types></Types>")
            .unwrap();
        zip.start_file("word/document.xml", options).unwrap();
        zip.write_all(b"<w:document><w:body><w:p><w:r><w:t>In our trial of 200 users, speed rose by 30%.</w:t></w:r></w:p></w:body></w:document>").unwrap();
        zip.finish().unwrap();
    }
    buf
}

fn build_mock_xlsx() -> Vec<u8> {
    let mut buf = Vec::new();
    {
        let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buf));
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        zip.start_file("[Content_Types].xml", options).unwrap();
        zip.write_all(b"<?xml version=\"1.0\"?><Types></Types>")
            .unwrap();
        zip.start_file("xl/workbook.xml", options).unwrap();
        zip.write_all(b"<workbook><sheets><sheet name=\"Sheet1\"/></sheets></workbook>")
            .unwrap();
        zip.finish().unwrap();
    }
    buf
}

fn build_zip_bomb_fixture() -> Vec<u8> {
    // Construct a high-ratio archive fixture with repetitive zero bytes
    let mut buf = Vec::new();
    {
        let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buf));
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("word/document.xml", options).unwrap();
        // 2 MB of repetitive zeroes deflates to a few hundred bytes (> 200:1 ratio)
        let zeros = vec![0u8; 2 * 1024 * 1024];
        zip.write_all(&zeros).unwrap();
        zip.start_file("[Content_Types].xml", options).unwrap();
        zip.write_all(b"<xml></xml>").unwrap();
        zip.finish().unwrap();
    }
    buf
}

#[test]
fn test_valid_pdf() {
    let config = GatewayConfig::default();
    let pdf_data = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<< /Root 1 0 R >>\nstartxref\n50\n%%EOF";
    let report = validate_document(pdf_data, "clinical_report.pdf", &config);
    assert!(report.valid);
    assert_eq!(report.file_type, Some(FileType::Pdf));
    assert_eq!(report.sanitized_filename, "clinical_report.pdf");
    assert_eq!(report.metadata.has_pdf_eof, Some(true));
}

#[test]
fn test_valid_docx() {
    let config = GatewayConfig::default();
    let docx_bytes = build_mock_docx();
    let report = validate_document(&docx_bytes, "study_findings.docx", &config);
    assert!(report.valid);
    assert_eq!(report.file_type, Some(FileType::Docx));
    assert_eq!(report.sanitized_filename, "study_findings.docx");
    assert!(report.metadata.zip_entry_count.unwrap() >= 2);
}

#[test]
fn test_valid_xlsx() {
    let config = GatewayConfig::default();
    let xlsx_bytes = build_mock_xlsx();
    let report = validate_document(&xlsx_bytes, "cohort_metrics.xlsx", &config);
    assert!(report.valid);
    assert_eq!(report.file_type, Some(FileType::Xlsx));
    assert_eq!(report.sanitized_filename, "cohort_metrics.xlsx");
}

#[test]
fn test_valid_csv() {
    let config = GatewayConfig::default();
    let csv_data = b"PatientID,ResponseRate,Weeks\nPT101,65%,24\nPT102,70%,24\n";
    let report = validate_document(csv_data, "trial_data.csv", &config);
    assert!(report.valid);
    assert_eq!(report.file_type, Some(FileType::Csv));
    assert_eq!(report.sanitized_filename, "trial_data.csv");
}

#[test]
fn test_valid_txt() {
    let config = GatewayConfig::default();
    let txt_data =
        b"In our controlled trial of 300 patients, primary endpoint reached 65% over 24 weeks.";
    let report = validate_document(txt_data, "summary.txt", &config);
    assert!(report.valid);
    assert_eq!(report.file_type, Some(FileType::Txt));
    assert_eq!(report.sanitized_filename, "summary.txt");
}

#[test]
fn test_rejects_empty_file() {
    let config = GatewayConfig::default();
    let report = validate_document(b"", "empty.pdf", &config);
    assert!(!report.valid);
    assert_eq!(report.error_code, Some("EMPTY_FILE".to_string()));
}

#[test]
fn test_rejects_oversized_file() {
    let config = GatewayConfig {
        max_file_bytes: 100, // artificially small 100 bytes limit
        ..Default::default()
    };
    let data = vec![b'A'; 200];
    let report = validate_document(&data, "big.txt", &config);
    assert!(!report.valid);
    assert_eq!(report.error_code, Some("FILE_TOO_LARGE".to_string()));
}

#[test]
fn test_extension_content_mismatch_disguised_executable() {
    let config = GatewayConfig::default();
    // Linux ELF header with .pdf extension
    let elf_data = b"\x7FELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00";
    let report = validate_document(elf_data, "malicious.pdf", &config);
    assert!(!report.valid);
    assert_eq!(
        report.error_code,
        Some("DISGUISED_EXECUTABLE_REJECTED".to_string())
    );
}

#[test]
fn test_extension_content_mismatch_pdf_named_docx() {
    let config = GatewayConfig::default();
    let pdf_data = b"%PDF-1.7\n1 0 obj<<>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<<>>\nstartxref\n30\n%%EOF";
    let report = validate_document(pdf_data, "disguised.docx", &config);
    assert!(!report.valid);
    assert_eq!(
        report.error_code,
        Some("EXTENSION_CONTENT_MISMATCH".to_string())
    );
}

#[test]
fn test_malformed_pdf_missing_header() {
    let config = GatewayConfig::default();
    let junk = b"This is just random non-PDF text masquerading as a document.";
    let report = validate_document(junk, "corrupt.pdf", &config);
    assert!(!report.valid);
}

#[test]
fn test_zip_bomb_detection() {
    let config = GatewayConfig::default();
    let bomb_data = build_zip_bomb_fixture();
    let report = validate_document(&bomb_data, "bomb.docx", &config);
    assert!(!report.valid);
    assert_eq!(report.error_code, Some("ZIP_BOMB_DETECTED".to_string()));
}

#[test]
fn test_path_traversal_filename_neutralized() {
    let raw = "../../var/log/../../etc/passwd.pdf";
    let clean = sanitize_filename(raw);
    assert_eq!(clean, "passwd.pdf");
}

#[test]
fn test_unicode_filename_sanitized() {
    let raw = "étude_clinique_2026.pdf";
    let clean = sanitize_filename(raw);
    assert_eq!(clean, "étude_clinique_2026.pdf");
}

#[test]
fn test_formula_injection_warning_in_csv() {
    let config = GatewayConfig::default();
    let csv_with_formula = b"Name,Score\n=cmd|' /C calc'!A0,100\nJohn,95\n";
    let report = validate_document(csv_with_formula, "export.csv", &config);
    assert!(report.valid);
    assert_eq!(report.metadata.contains_formulas, Some(true));
    assert!(report.warnings.iter().any(|w| w.contains("DDE command")));
}
