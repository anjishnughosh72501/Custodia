"""Visual Brand Intelligence Service: Color palette analysis, logo consistency, and visual compliance."""
from __future__ import annotations

import logging
import math
import re
from typing import Optional

from app.brand.models import BrandAsset, BrandProfile, EnforcementLevel, RuleCategory
from app.preflight.models import PreflightFinding

log = logging.getLogger("custodia.visual")


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    """Convert hex string (e.g. '#00F0FF' or '00F0FF') to (R, G, B)."""
    clean = hex_str.strip().lstrip("#")
    if len(clean) == 3:
        clean = "".join(c * 2 for c in clean)
    if len(clean) != 6:
        return (0, 0, 0)
    try:
        return (int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))
    except ValueError:
        return (0, 0, 0)


def color_distance_euclidean(c1: tuple[int, int, int], c2: tuple[int, int, int]) -> float:
    """Calculates normalized Euclidean RGB color distance (0.0 exact to 1.0 maximum deviation)."""
    dr = (c1[0] - c2[0]) / 255.0
    dg = (c1[1] - c2[1]) / 255.0
    db = (c1[2] - c2[2]) / 255.0
    return math.sqrt(dr * dr + dg * dg + db * db) / math.sqrt(3.0)


def analyze_creative_visuals(
    image_filenames: list[str],
    detected_hex_colors: list[str],
    brand_profile: BrandProfile,
    brand_assets: list[BrandAsset],
) -> tuple[list[PreflightFinding], dict]:
    """Evaluates creative imagery against brand visual guidelines, logo variants, and color palettes."""
    findings: list[PreflightFinding] = []
    summary_data = {
        "images_evaluated": len(image_filenames),
        "palette_compliance_pct": 100,
        "logo_verified": False,
        "accessibility_notes": [],
    }

    if not image_filenames and not detected_hex_colors:
        return findings, summary_data

    approved_palette = [hex_to_rgb(c) for c in brand_profile.primary_colors if c]

    # 1. Color Palette Consistency Check
    if detected_hex_colors and approved_palette:
        deviant_colors: list[str] = []
        for hex_col in detected_hex_colors:
            rgb = hex_to_rgb(hex_col)
            min_dist = min(color_distance_euclidean(rgb, app_rgb) for app_rgb in approved_palette)
            # If distance exceeds 0.28 (significant visual departure)
            if min_dist > 0.28:
                deviant_colors.append(hex_col)

        if deviant_colors:
            findings.append(
                PreflightFinding(
                    title="Off-Brand Color Palette Detected",
                    category=RuleCategory.VISUAL,
                    severity=EnforcementLevel.WARNING,
                    confidence=0.88,
                    affected_content=f"Colors: {', '.join(deviant_colors[:4])}",
                    explanation=f"Creative incorporates colors {deviant_colors[:3]} that deviate significantly from official brand palette ({', '.join(brand_profile.primary_colors)}).",
                    suggested_correction=f"Align creative background and accents with brand primaries: {', '.join(brand_profile.primary_colors[:2])}",
                )
            )
            summary_data["palette_compliance_pct"] = max(40, 100 - len(deviant_colors) * 20)

    # 2. Approved Logo Usage Inspection
    logo_assets = [a for a in brand_assets if str(a.asset_type).upper() == "LOGO"]
    has_logo_filename = any("logo" in fn.lower() for fn in image_filenames)

    if image_filenames and not has_logo_filename and logo_assets:
        findings.append(
            PreflightFinding(
                title="Missing Verified Brand Logo Asset",
                category=RuleCategory.VISUAL,
                severity=EnforcementLevel.WARNING,
                confidence=0.85,
                affected_content=f"Files: {', '.join(image_filenames)}",
                explanation="Campaign imagery submitted without authorized primary logo mark. Brand guidelines require official lockup on promotional creative.",
                suggested_correction=f"Include approved brand asset: '{logo_assets[0].name}'",
            )
        )
    else:
        summary_data["logo_verified"] = True

    # 3. Accessibility & Contrast Heuristic
    for fn in image_filenames:
        if fn.lower().endswith((".jpg", ".jpeg", ".png")):
            summary_data["accessibility_notes"].append(
                f"Ensure alt-text and WCAG AA contrast (4.5:1) are verified before social publication for '{fn}'."
            )

    return findings, summary_data
