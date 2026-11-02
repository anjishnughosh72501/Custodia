"""Secure multi-format document parser with magic-byte validation, page/cell provenance, and passage retrieval."""
from __future__ import annotations

import csv
import datetime
import hashlib
import io
import logging
import os
import re
import uuid
import zipfile
from typing import Optional

from pydantic import BaseModel, Field

from .gateway_client import GatewayClientError, gateway_client

log = logging.getLogger("custodia.documents")

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB per file
MAX_TOTAL_BYTES = 25 * 1024 * 1024  # 25 MB max total upload


class DocumentChunk(BaseModel):
    """Atomic evidence passage preserving exact source provenance."""
    chunk_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    document_id: str
    filename: str
    sha256: str = ""
    file_type: str  # pdf | docx | xlsx | csv | txt
    page_number: Optional[int] = None
    paragraph_index: Optional[int] = None
    section_name: Optional[str] = None
    cell_reference: Optional[str] = None
    line_number: Optional[int] = None
    extracted_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    text: str
    relevance_score: float = 0.0

    @property
    def provenance_citation(self) -> str:
        parts = [self.filename]
        if self.sha256:
            parts.append(f"hash:{self.sha256[:8]}")
        if self.page_number is not None:
            parts.append(f"p. {self.page_number}")
        if self.paragraph_index is not None:
            parts.append(f"para {self.paragraph_index}")
        if self.section_name:
            parts.append(f"section: {self.section_name}")
        if self.cell_reference:
            parts.append(f"cell: {self.cell_reference}")
        if self.line_number is not None:
            parts.append(f"line {self.line_number}")
        return " | ".join(parts)


class ParsedDocument(BaseModel):
    document_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    filename: str
    sanitized_filename: str = ""
    sha256: str = ""
    file_type: str
    byte_size: int
    total_chunks: int
    chunks: list[DocumentChunk]
    full_text_preview: str
    warnings: list[str] = []
    gateway_verified: bool = False


class DocumentParserError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def detect_file_type_from_content(data: bytes, filename: str) -> str:
    """Validate file type using magic numbers (content signatures) rather than trusting extensions alone."""
    if len(data) == 0:
        raise DocumentParserError("EMPTY_FILE", f"File '{filename}' is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise DocumentParserError("FILE_TOO_LARGE", f"File '{filename}' exceeds 10 MB limit.")

    # PDF magic signature: starts with %PDF-
    if data.startswith(b"%PDF-"):
        return "pdf"

    # ZIP-based formats (DOCX and XLSX)
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = zf.namelist()
                if any(n.startswith("word/") for n in names) or "word/document.xml" in names:
                    return "docx"
                if any(n.startswith("xl/") for n in names) or "xl/workbook.xml" in names:
                    return "xlsx"
        except zipfile.BadZipFile:
            raise DocumentParserError("CORRUPT_ARCHIVE", f"File '{filename}' contains invalid or corrupted ZIP data.")

    # Check for text / csv
    try:
        sample = data[:4096].decode("utf-8")
        # Check if CSV-like
        lines = [line for line in sample.splitlines() if line.strip()]
        if len(lines) >= 2 and ("," in lines[0] or "\t" in lines[0] or ";" in lines[0]):
            ext = os.path.splitext(filename)[1].lower()
            if ext in (".csv", ".tsv"):
                return "csv"
        return "txt"
    except UnicodeDecodeError:
        pass

    raise DocumentParserError("UNSUPPORTED_FORMAT", f"File '{filename}' format is not recognized or not supported.")


def parse_pdf(data: bytes, filename: str, doc_id: str, sha256: str) -> list[DocumentChunk]:
    import pypdf
    chunks: list[DocumentChunk] = []
    total_extracted_chars = 0
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        reader = pypdf.PdfReader(io.BytesIO(data))
        total_pages = len(reader.pages)

        for page_idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            total_extracted_chars += len(text.strip())

            # Split into reasonable paragraph chunks
            paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
            for p_idx, p_text in enumerate(paragraphs, start=1):
                if len(p_text) >= 15:
                    chunks.append(
                        DocumentChunk(
                            document_id=doc_id,
                            filename=filename,
                            sha256=sha256,
                            file_type="pdf",
                            page_number=page_idx,
                            paragraph_index=p_idx,
                            extracted_at=now_iso,
                            text=p_text,
                        )
                    )

        # Detect scanned/empty PDF requiring OCR
        if total_pages > 0 and total_extracted_chars < 15:
            raise DocumentParserError(
                "SCANNED_PDF_OCR_REQUIRED",
                f"PDF '{filename}' ({total_pages} page{'s' if total_pages > 1 else ''}) appears to contain scanned images with no selectable text layer. OCR text extraction is required before verification.",
            )

    except DocumentParserError:
        raise
    except Exception as ex:
        raise DocumentParserError("PDF_PARSE_FAILED", f"Could not parse PDF '{filename}': {ex}")

    return chunks


def parse_docx(data: bytes, filename: str, doc_id: str, sha256: str) -> list[DocumentChunk]:
    import docx
    chunks: list[DocumentChunk] = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        doc = docx.Document(io.BytesIO(data))
        current_section = "General"
        for p_idx, para in enumerate(doc.paragraphs, start=1):
            text = para.text.strip()
            if not text:
                continue
            if para.style and para.style.name.startswith("Heading"):
                current_section = text
                continue
            if len(text) >= 15:
                chunks.append(
                    DocumentChunk(
                        document_id=doc_id,
                        filename=filename,
                        sha256=sha256,
                        file_type="docx",
                        section_name=current_section,
                        paragraph_index=p_idx,
                        extracted_at=now_iso,
                        text=text,
                    )
                )
    except Exception as ex:
        raise DocumentParserError("DOCX_PARSE_FAILED", f"Could not parse DOCX '{filename}': {ex}")
    return chunks


def parse_xlsx(data: bytes, filename: str, doc_id: str, sha256: str) -> list[DocumentChunk]:
    import openpyxl
    chunks: list[DocumentChunk] = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            headers: list[str] = []
            for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
                if not any(row):
                    continue
                row_vals = [str(v).strip() if v is not None else "" for v in row]
                if row_idx == 1:
                    headers = row_vals
                    continue
                # Construct table row summary
                row_text_parts = []
                for col_idx, val in enumerate(row_vals):
                    if not val:
                        continue
                    header_label = headers[col_idx] if col_idx < len(headers) and headers[col_idx] else f"Col {col_idx+1}"
                    row_text_parts.append(f"{header_label}: {val}")
                if row_text_parts:
                    cell_ref = f"{sheet_name}!R{row_idx}"
                    chunks.append(
                        DocumentChunk(
                            document_id=doc_id,
                            filename=filename,
                            sha256=sha256,
                            file_type="xlsx",
                            section_name=sheet_name,
                            cell_reference=cell_ref,
                            extracted_at=now_iso,
                            text=" | ".join(row_text_parts),
                        )
                    )
    except Exception as ex:
        raise DocumentParserError("XLSX_PARSE_FAILED", f"Could not parse spreadsheet '{filename}': {ex}")
    return chunks


def parse_csv(data: bytes, filename: str, doc_id: str, sha256: str) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        content = data.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(content))
        headers = []
        for row_idx, row in enumerate(reader, start=1):
            if not row or not any(row):
                continue
            if row_idx == 1:
                headers = [h.strip() for h in row]
                continue
            parts = []
            for col_idx, val in enumerate(row):
                val_clean = val.strip()
                if not val_clean:
                    continue
                h_name = headers[col_idx] if col_idx < len(headers) and headers[col_idx] else f"Col {col_idx+1}"
                parts.append(f"{h_name}: {val_clean}")
            if parts:
                chunks.append(
                    DocumentChunk(
                        document_id=doc_id,
                        filename=filename,
                        sha256=sha256,
                        file_type="csv",
                        cell_reference=f"Row {row_idx}",
                        extracted_at=now_iso,
                        text=" | ".join(parts),
                    )
                )
    except Exception as ex:
        raise DocumentParserError("CSV_PARSE_FAILED", f"Could not parse CSV '{filename}': {ex}")
    return chunks


def parse_txt(data: bytes, filename: str, doc_id: str, sha256: str) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        content = data.decode("utf-8", errors="replace")
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
        for p_idx, text in enumerate(paragraphs, start=1):
            if len(text) >= 15:
                chunks.append(
                    DocumentChunk(
                        document_id=doc_id,
                        filename=filename,
                        sha256=sha256,
                        file_type="txt",
                        paragraph_index=p_idx,
                        extracted_at=now_iso,
                        text=text,
                    )
                )
    except Exception as ex:
        raise DocumentParserError("TXT_PARSE_FAILED", f"Could not parse text file '{filename}': {ex}")
    return chunks


def parse_uploaded_document(data: bytes, filename: str) -> ParsedDocument:
    """Validate and parse an uploaded document into chunked evidence passages.

    Coordinates pre-parser validation with Rust gateway if active, then dispatches to format extractors.
    """
    doc_id = uuid.uuid4().hex
    sha256 = compute_sha256(data)
    sanitized_name = filename
    warnings: list[str] = []
    gateway_verified = False

    # 1. Attempt pre-parser validation via Rust Secure Document Gateway
    try:
        report = gateway_client.validate_document(data, filename)
        sanitized_name = report.get("sanitized_filename", filename)
        warnings.extend(report.get("warnings", []))
        gateway_verified = True
    except GatewayClientError as gw_err:
        if gw_err.code in ("GATEWAY_UNAVAILABLE", "GATEWAY_TIMEOUT"):
            # Fallback to strict Python-based magic-byte validation
            log.info("Gateway offline (%s); using Python signature engine", gw_err.code)
            warnings.append(f"Document validated using Python fallback ({gw_err.code}).")
        else:
            # Rejection from Rust gateway (malformed, zip bomb, mismatch, path traversal, oversized)
            raise DocumentParserError(gw_err.code, str(gw_err))

    # 2. Identify and parse document content
    file_type = detect_file_type_from_content(data, sanitized_name)

    if file_type == "pdf":
        chunks = parse_pdf(data, sanitized_name, doc_id, sha256)
    elif file_type == "docx":
        chunks = parse_docx(data, sanitized_name, doc_id, sha256)
    elif file_type == "xlsx":
        chunks = parse_xlsx(data, sanitized_name, doc_id, sha256)
    elif file_type == "csv":
        chunks = parse_csv(data, sanitized_name, doc_id, sha256)
    else:
        chunks = parse_txt(data, sanitized_name, doc_id, sha256)

    if not chunks:
        raise DocumentParserError("NO_TEXT_EXTRACTED", f"No readable text passages could be extracted from '{sanitized_name}'.")

    preview = "\n\n".join(c.text for c in chunks[:3])
    return ParsedDocument(
        document_id=doc_id,
        filename=filename,
        sanitized_filename=sanitized_name,
        sha256=sha256,
        file_type=file_type,
        byte_size=len(data),
        total_chunks=len(chunks),
        chunks=chunks,
        full_text_preview=preview[:500],
        warnings=warnings,
        gateway_verified=gateway_verified,
    )


def rank_relevant_passages(chunks: list[DocumentChunk], claim_text: str, top_k: int = 5) -> list[DocumentChunk]:
    """Rank extracted document passages by relevance to the draft claim."""
    claim_words = set(re.findall(r"\b[A-Za-z0-9]{3,}\b", claim_text.lower()))
    if not claim_words:
        return chunks[:top_k]

    scored: list[tuple[float, DocumentChunk]] = []
    for c in chunks:
        passage_lower = c.text.lower()
        matches = sum(1 for w in claim_words if w in passage_lower)
        # Extra weight if exact numbers or percentages in claim match the passage
        numbers = re.findall(r"\b\d+(?:\.\d+)?%?\b", claim_text)
        num_matches = sum(2 for n in numbers if n in passage_lower)
        score = (matches + num_matches) / max(1, len(claim_words))
        c_copy = c.model_copy()
        c_copy.relevance_score = round(score, 3)
        scored.append((score, c_copy))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]
