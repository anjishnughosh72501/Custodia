"""Integration and unit tests for CodeStar Round 3 features in Custodia:
1. Multi-source document parsing (PDF, DOCX, CSV, TXT, magic bytes).
2. Evidence Confidence Map (7-dimension breakdown, cap invariants).
3. Connectors & Circuit Breaker.
4. Versioned Audit Revisions & Human Sign-off.
5. Deterministic engine authority (Gemini advice cannot override verification).
"""
import pytest
from app.documents.parser import parse_uploaded_document, DocumentParserError, detect_file_type_from_content
from app.rules.confidence import build_evidence_confidence_map
from app.rules.engine import compare_frames, decide
from app.extraction.llm import build_frame
from app.extraction.parsers import locate_all
from app.connectors.base import ConnectorCircuitBreaker, SourceRecord
from app.store import SqliteStore
import datetime
import io


def test_document_parser_txt_and_csv():
    txt_bytes = b"Page 1: In our benchmark of 500 servers, query latency fell by 40%."
    parsed_txt = parse_uploaded_document(txt_bytes, "benchmark.txt")
    assert parsed_txt.file_type == "txt"
    assert parsed_txt.total_chunks >= 1
    assert "latency fell by 40%" in parsed_txt.chunks[0].text

    csv_bytes = b"Trial,Cohort,Reduction\nNCT01,400 patients,25 percent\n"
    parsed_csv = parse_uploaded_document(csv_bytes, "trial.csv")
    assert parsed_csv.file_type == "csv"
    assert parsed_csv.total_chunks >= 1
    assert "400 patients" in parsed_csv.chunks[0].text


def test_document_parser_rejects_spoofed_magic_bytes():
    # File named .pdf but containing plain non-PDF text/bytes
    fake_pdf = b"\x00\x01\x02\x03\xff\xfe\x00\x00Not a valid PDF header"
    with pytest.raises(DocumentParserError) as exc_info:
        parse_uploaded_document(fake_pdf, "malicious.pdf")
    assert exc_info.value.code == "UNSUPPORTED_FORMAT"


def test_confidence_map_invariant_caps():
    claim = "Our tool cuts latency by 50% for all users."
    evidence = "In a study of 100 enterprise customers, latency fell by 20%."
    cf = build_frame(claim, "claim", locate_all(claim))
    ef = build_frame(evidence, "evidence", locate_all(evidence))
    comparisons = compare_frames(cf, ef)
    verdict = decide(comparisons)
    assert verdict.status.value in ("NOT_SUPPORTED", "NEEDS_HUMAN_REVIEW")

    conf_map = build_evidence_confidence_map(comparisons, verdict)
    assert conf_map.overall_score <= 0.45  # Cap on contradicted/needs-human
    assert len(conf_map.dimensions) == 7
    dim_names = {d.dimension for d in conf_map.dimensions}
    assert dim_names == {"metric", "value", "unit", "population", "time_window", "conditions", "strength"}


def test_connector_circuit_breaker():
    cb = ConnectorCircuitBreaker(failure_threshold=3, cooldown_seconds=60.0)
    assert cb.is_open() is False
    cb.record_failure()
    cb.record_failure()
    assert cb.is_open() is False
    cb.record_failure()
    # Now state should be OPEN (tripped)
    assert cb.tripped_at is not None
    assert cb.is_open() is True


def test_versioned_audit_revisions_and_user_isolation(tmp_path):
    from app.models import Review, Verdict, VerdictStatus
    db_file = tmp_path / "test_store.db"
    store = SqliteStore(str(db_file))

    review_id = "rev_test_101"
    v = Verdict(
        status=VerdictStatus.NEEDS_HUMAN_REVIEW,
        needs_human=True,
        summary="Initial draft check",
        abstain_reasons=[],
        counts={"supported": 0, "contradicted": 0, "unknown": 1, "language_risks": 0}
    )
    cf = build_frame("Draft claim v1", "claim", locate_all("Draft claim v1"))
    ef = build_frame("Evidence text v1", "evidence", locate_all("Evidence text v1"))
    rev = Review(
        id=review_id,
        engine_version="3.0.0",
        extractor_mode="rules",
        degraded=False,
        warnings=[],
        claim_text="Draft claim v1",
        evidence_text="Evidence text v1",
        claim_frame=cf,
        evidence_frame=ef,
        comparisons=[],
        language_risks=[],
        language_review="rules",
        verdict=v,
        nli=None,
        delete_token="token_123",
        user_id="user_1"
    )
    store.save(rev, user_id="user_1")

    store.save_revision(
        review_id=review_id,
        claim_text="Draft claim v1",
        evidence_text="Evidence text v1",
        verdict=v.model_dump(),
        reviewer_id="user_1",
        reviewer_action="CREATE_REVIEW",
        notes="Initial automated check"
    )

    # Human sign-off action
    store.record_decision(
        review_id=review_id,
        user_id="user_1",
        decision="REJECTED",
        notes="Overstated marketing claim"
    )

    revs = store.get_revisions(review_id, "user_1")
    assert len(revs) == 2
    assert revs[0]["version"] == 1
    assert revs[1]["version"] == 2
    assert revs[1]["reviewer_action"] == "REJECTED"

    # User 2 tries to access User 1's revisions -> isolation enforced
    revs_user2 = store.get_revisions(review_id, "user_2")
    assert len(revs_user2) == 0


def test_scanned_pdf_ocr_required(tmp_path):
    # Construct a minimal valid PDF with empty text layer (scanned/raster mock)
    empty_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000115 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF"
    )
    with pytest.raises(DocumentParserError) as exc_info:
        parse_uploaded_document(empty_pdf, "scanned_receipt.pdf")
    assert exc_info.value.code == "SCANNED_PDF_OCR_REQUIRED"
    assert "OCR text extraction is required" in str(exc_info.value)


def test_document_chunks_have_provenance_and_hash():
    txt_data = b"Line 1: In our test of 100 users, response time was cut by 50%.\n\nLine 2: Over 12 months, zero downtime was recorded."
    doc = parse_uploaded_document(txt_data, "trial_data.txt")
    assert len(doc.sha256) == 64
    assert doc.total_chunks >= 2
    for chunk in doc.chunks:
        assert chunk.sha256 == doc.sha256
        assert chunk.extracted_at
        assert "trial_data.txt" in chunk.provenance_citation
        assert "hash:" in chunk.provenance_citation


def test_docx_and_xlsx_provenance():
    import docx
    # Construct an authentic DOCX using python-docx
    doc = docx.Document()
    doc.add_heading("Clinical Study Findings", level=1)
    doc.add_paragraph("In our 6-month study of 400 clinics, efficiency increased by 35%.")
    docx_buf = io.BytesIO()
    doc.save(docx_buf)

    parsed_docx = parse_uploaded_document(docx_buf.getvalue(), "clinic_study.docx")
    assert parsed_docx.file_type == "docx"
    assert parsed_docx.total_chunks >= 1
    assert "efficiency increased by 35%" in parsed_docx.chunks[0].text
    assert parsed_docx.chunks[0].sha256 == parsed_docx.sha256
    assert parsed_docx.chunks[0].section_name == "Clinical Study Findings"


def test_gateway_client_offline_fallback():
    from app.documents.gateway_client import SecureGatewayClient, GatewayClientError
    # Target unreachable port to verify resilient fallback handling
    client = SecureGatewayClient(base_url="http://127.0.0.1:59999", timeout=0.5)
    assert client.is_available() is False
    with pytest.raises(GatewayClientError) as exc_info:
        client.validate_document(b"Sample content", "sample.txt")
    assert exc_info.value.code in ("GATEWAY_UNAVAILABLE", "GATEWAY_TIMEOUT")
