//! Memory-safe filename sanitizer.
//! Prevents path traversal, control character injection, and reserved device name abuse.

use std::path::Path;

const WINDOWS_RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

const MAX_FILENAME_LEN: usize = 255;

/// Sanitizes an untrusted filename, stripping directory traversal patterns,
/// control characters, reserved names, and bounding length.
pub fn sanitize_filename(raw: &str) -> String {
    if raw.is_empty() {
        return "document_upload".to_string();
    }

    // 1. Replace Windows path separators with Unix style
    let normalized = raw.replace('\\', "/");

    // 2. Extract strictly the file basename (strips any path components /../ etc)
    let basename = Path::new(&normalized)
        .file_name()
        .and_then(|os_str| os_str.to_str())
        .unwrap_or(raw);

    // 3. Filter out control characters, null bytes, and dangerous characters
    let mut clean: String = basename
        .chars()
        .filter(|c| !c.is_control() && *c != '\0' && *c != '/' && *c != '\\')
        .collect();

    // 4. Strip leading dots, spaces, or dashes (prevents hidden unix files or cmd flags)
    clean = clean
        .trim_start_matches(|c: char| c == '.' || c.is_whitespace() || c == '-')
        .to_string();

    // 5. If cleaned name is empty, fallback
    if clean.is_empty() {
        return "document_upload".to_string();
    }

    // 6. Check for Windows reserved names (e.g. CON.pdf, AUX.txt)
    let stem = clean
        .split('.')
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    if WINDOWS_RESERVED.contains(&stem.as_str()) {
        clean = format!("safe_{}", clean);
    }

    // 7. Clamp to maximum filename length while preserving extension if possible
    if clean.len() > MAX_FILENAME_LEN {
        if let Some(dot_idx) = clean.rfind('.') {
            let ext = &clean[dot_idx..];
            if ext.len() < 16 {
                let keep_len = MAX_FILENAME_LEN - ext.len();
                clean = format!("{}{}", &clean[..keep_len], ext);
            } else {
                clean.truncate(MAX_FILENAME_LEN);
            }
        } else {
            clean.truncate(MAX_FILENAME_LEN);
        }
    }

    clean
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_traversal_stripped() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_filename("..\\..\\windows\\system32\\calc.exe"), "calc.exe");
        assert_eq!(sanitize_filename("/var/log/syslog.pdf"), "syslog.pdf");
    }

    #[test]
    fn test_control_characters_removed() {
        assert_eq!(sanitize_filename("report\0null.pdf"), "reportnull.pdf");
        assert_eq!(sanitize_filename("line\nbreak.txt"), "linebreak.txt");
    }

    #[test]
    fn test_leading_dots_stripped() {
        assert_eq!(sanitize_filename("...hidden.pdf"), "hidden.pdf");
        assert_eq!(sanitize_filename(".bashrc"), "bashrc");
    }

    #[test]
    fn test_windows_reserved() {
        assert_eq!(sanitize_filename("CON.pdf"), "safe_CON.pdf");
        assert_eq!(sanitize_filename("nul.txt"), "safe_nul.txt");
    }

    #[test]
    fn test_empty_fallback() {
        assert_eq!(sanitize_filename(""), "document_upload");
        assert_eq!(sanitize_filename("   "), "document_upload");
        assert_eq!(sanitize_filename("..."), "document_upload");
    }
}
