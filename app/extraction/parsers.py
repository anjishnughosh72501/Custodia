"""Deterministic locators and parsers for the seven dimensions. No model involved."""
from __future__ import annotations
import re
from typing import Optional

I = re.IGNORECASE
GROUPS = (r"(?:customers?|users?|businesses|business|compan(?:y|ies)|participants?|teams?|clients?|"
          r"respondents?|employees?|merchants?|developers?|students?|patients?|organi[sz]ations?|"
          r"people|firms|shops|stores)")
GENERIC = {"our", "the", "a", "an", "of", "and", "in", "for", "with", "to", "by", "on", "using",
           "plan", "tier", "median", "mean", "average", "avg", "maximum", "minimum", "typical", "overall"}

UNICODE_MAP = {
    '\u2011': '-', '\u2012': '-', '\u2013': '-', '\u2014': '-', '\u2212': '-',
    '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ',
    '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201b': "'",
    '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u201f': '"',
}


def normalize_chars(s: str) -> str:
    """Length-preserving 1:1 character normalization before parsing so offsets remain exact."""
    if not s:
        return ""
    return "".join(UNICODE_MAP.get(c, c) for c in s)


ONES = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
}
TENS = {
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
NUM_WORD_PATTERN = (
    r"(?:(?:one\s+)?hundred|"
    r"(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?|"
    r"nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten|"
    r"nine|eight|seven|six|five|four|three|two|one)"
)
NUM_RE_STR = rf"(?:\d+(?:\.\d+)?|{NUM_WORD_PATTERN})"

PCT_RE = re.compile(rf"(?<![\w.])({NUM_RE_STR})\s*(%|percentage\s+points?|percent\b|pp\b)", I)
TIMEVAL_RE = re.compile(rf"\bby\s+({NUM_RE_STR})\s*(seconds?|minutes?|hours?|days?|weeks?)\b", I)
METRIC_RE = re.compile(r"\b((?:[a-z]+[ -]){0,1}?(?:time|rate|costs?|revenue|errors?|churn|conversion|retention|"
                       r"latency|speed|sales|savings|score|downtime|tickets|spend|productivity))\b", I)
TW_RE = re.compile(rf"(?<!by )(?<![\w.])({NUM_RE_STR})[\s-]*(day|week|month|year)s?(?:[\s-]+(?:test|trial|study|pilot|period|window))?\b", I)
_NOT_A_VALUE = r"(?!\d|\s*(?:%|percent|percentage|pp\b|(?:second|minute|hour|day|week|month|year)s?\b))"
BOUNDED_RE = re.compile(rf"\b(?:of|among|across|from|for|to|by|with)\s+(((?:\d[\d,]*|{NUM_WORD_PATTERN}){_NOT_A_VALUE}\s+)?(?:[A-Za-z][\w\-]*\s+){{0,3}}?{GROUPS})\b", I)
UNIV_POP_RE = re.compile(rf"\b(?:(every|all|any|each)\s+((?:[a-z\-]+\s+){{0,2}}?{GROUPS})|(everyone|everybody))\b", I)
COND_RE = re.compile(r"\b(?:using|on|with|under|via)\s+(?:the\s+)?(?:[A-Z][\w\-]*)(?:\s+[A-Z][\w\-]*){0,2}(?:\s+(?:plan|tier|edition|version|mode))?\b")
UNIV_RE = re.compile(r"\b(every|all|always|never|everyone|everybody|any|each|guarantee[sd]?|without exception)\b", I)
SUPER_RE = re.compile(r"(?:\b(best|fastest|cheapest|leading|only|unmatched|unrivaled|world-class|top|most\s+\w+)\b|#\s*1\b|number\s+one)", I)
GENERAL_RE = re.compile(r"\b(cuts|reduces|improves|increases|lowers|boosts|saves|speeds|slashes|shortens|eliminates|ensures|delivers|drives|doubles|halves)\b", I)
PAST_RE = re.compile(r"\b(fell|dropped|decreased|reduced|increased|rose|improved|grew|declined|saved|measured|observed|saw|achieved)\b", I)
TEST_RE = re.compile(r"\b(test|trial|study|pilot|survey|experiment|measured|observed|analysis|benchmark|fell|dropped|decreased|increased|rose|grew)\b", I)
DEC_RE = re.compile(r"\b(cuts?|cutting|reduc\w*|fell|fall(?:s|en)?|drop\w*|decreas\w*|lower\w*|shorten\w*|slash\w*|declin\w*|halv\w*)\b", I)
INC_RE = re.compile(r"\b(increas\w*|rose|rise[sn]?|grew|grow\w*|boost\w*|rais\w*|gain\w*|higher|doubl\w*)\b", I)
QUANT_RE = re.compile(r"\b(up\s+to|as\s+much\s+as|as\s+many\s+as|at\s+most|at\s+least|more\s+than|less\s+than|fewer\s+than|"
                      r"over|under|exceeding|upwards\s+of|nearly|almost|approximately|around|about|roughly|~)\s*$", I)
QUANT_KIND = {"up to": "upper_bound", "as much as": "upper_bound", "as many as": "upper_bound", "at most": "upper_bound",
              "at least": "lower_bound", "more than": "lower_bound", "over": "lower_bound", "exceeding": "lower_bound",
              "upwards of": "lower_bound", "less than": "upper_bound", "fewer than": "upper_bound", "under": "upper_bound"}
NEG_DIR_RE = re.compile(r"\b(?:not|never|no|fail(?:ed|s)?\s+to|didn't|doesn't|hasn't|wasn't|isn't)\s+(?:\w+\s+){0,2}?"
                        r"(?:cuts?|cutting|reduc\w*|fell|fall(?:s|en)?|drop\w*|decreas\w*|lower\w*|shorten\w*|slash\w*|declin\w*|"
                        r"increas\w*|rose|rise[sn]?|grew|grow\w*|boost\w*|rais\w*|gain\w*|improv\w*)\b", I)
VALENCE_RE = re.compile(r"\b(improv\w*|better|worse|worsen\w*)\b", I)
GROUP_NOUNS = {"customer", "user", "business", "company", "participant", "team", "client", "respondent", "employee",
               "merchant", "developer", "student", "patient", "organization", "organisation", "people", "firm", "shop", "store"}
STAT_RE = re.compile(r"\b(median|mean|average|avg|maximum|minimum|typical)\b", I)

UNIT_ALIASES = {"%": "percent", "percent": "percent", "percentage": "percent",
                "pp": "percentage_points", "percentage point": "percentage_points", "percentage points": "percentage_points",
                "second": "seconds", "seconds": "seconds", "minute": "minutes", "minutes": "minutes",
                "hour": "hours", "hours": "hours", "day": "days", "days": "days", "week": "weeks", "weeks": "weeks"}
TIME_SECONDS = {"seconds": 1, "minutes": 60, "hours": 3600, "days": 86400, "weeks": 604800}
STAT_NORM = {"average": "mean", "avg": "mean", "mean": "mean", "median": "median", "maximum": "maximum",
             "minimum": "minimum", "typical": "typical"}
INJECTION_RE = re.compile(r"(ignore (all |any )?(previous|prior|above)|disregard .{0,30}instructions|system prompt|"
                          r"you are (now )?an? |mark (this|the) claim as (supported|approved)|always (say|answer|respond)|"
                          r"as an ai|<\s*/?\s*(system|assistant)\s*>)", I)


def singular(w: str) -> str:
    w = w.lower()
    if w.endswith("sses") or w.endswith("ss"):
        return w[:-2] if w.endswith("sses") else w
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("s") and len(w) > 3:
        return w[:-1]
    return w


def tokens(text: str) -> list[str]:
    out = []
    for t in re.split(r"[^a-zA-Z0-9]+", text):
        if not t or t.isdigit() or t.lower() in GENERIC:
            continue
        out.append(singular(t))
    return out


def norm_unit(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    return UNIT_ALIASES.get(re.sub(r"\s+", " ", s.strip().lower()))


def quantifier_before(prefix: str) -> tuple[Optional[str], Optional[str]]:
    """(kind, raw) if the number is preceded by a bound/approximation word such as 'up to' or 'at least'."""
    norm = normalize_chars(prefix)
    m = QUANT_RE.search(norm[-25:])
    if not m:
        return None, None
    raw = re.sub(r"\s+", " ", m.group(1).lower())
    return QUANT_KIND.get(raw, "approximate"), raw


def parse_num_word(s: str) -> Optional[float]:
    s = s.strip().lower()
    if s in ONES:
        return float(ONES[s])
    if s in TENS:
        return float(TENS[s])
    if s in ("hundred", "one hundred"):
        return 100.0
    parts = re.split(r"[\s-]+", s)
    if len(parts) == 2 and parts[0] in TENS and parts[1] in ONES:
        return float(TENS[parts[0]] + ONES[parts[1]])
    return None


def to_number(s: str) -> Optional[float]:
    m = re.search(r"\d[\d,]*(?:\.\d+)?", s or "")
    if m:
        return float(m.group(0).replace(",", ""))
    return parse_num_word(s or "")


# ---------------- heuristic locators: return (start, end) spans in the original text ----------------
def locate_all(text: str) -> dict:
    """Return {dimension: (start,end) | None} plus 'strength_level'. Pure regex; used as a labeled fallback extractor."""
    loc: dict = {k: None for k in ("metric", "value", "unit", "population", "time_window", "conditions", "strength")}
    norm = normalize_chars(text)
    m = PCT_RE.search(norm)
    if m:
        loc["value"] = (m.start(1), m.end(1))
        loc["unit"] = (m.start(2), m.end(2))
    else:
        m = TIMEVAL_RE.search(norm)
        if m:
            loc["value"] = (m.start(1), m.end(1))
            loc["unit"] = (m.start(2), m.end(2))
    m = METRIC_RE.search(norm)
    if m:
        loc["metric"] = (m.start(1), m.end(1))
    m = TW_RE.search(norm)
    if m:
        loc["time_window"] = (m.start(), m.end())
    m = UNIV_POP_RE.search(norm)
    if m:
        loc["population"] = (m.start(), m.end())
    else:
        m = BOUNDED_RE.search(norm)
        if m:
            loc["population"] = (m.start(1), m.end(1))
    m = COND_RE.search(norm)
    if m:
        loc["conditions"] = (m.start(), m.end())
    return loc


def strength_level(text: str, role: str) -> tuple[Optional[str], Optional[tuple[int, int]]]:
    """Deterministic strength-of-wording classifier. Returns (level, span)."""
    norm = normalize_chars(text)
    if role == "claim":
        for m in UNIV_RE.finditer(norm):
            return "universal", (m.start(), m.end())
        m = SUPER_RE.search(norm)
        if m:
            return "superlative", (m.start(), m.end())
    g = GENERAL_RE.search(norm)
    p = PAST_RE.search(norm)
    t = TEST_RE.search(norm)
    if role == "claim":
        if g and not p:
            return "generalized", (g.start(), g.end())
        if p:
            return "observed", (p.start(), p.end())
        return None, None
    if t:
        return "observed", (t.start(), t.end())
    if g:
        return "generalized", (g.start(), g.end())
    return None, None


def instruction_like(text: str) -> bool:
    norm = normalize_chars(text or "")
    return bool(INJECTION_RE.search(norm))


# ---------------- parsers: turn a verified quote into structured data ----------------
def parse_dimension(dim: str, quote: str, full_text: str, role: str, level: Optional[str] = None) -> dict:
    norm_full = normalize_chars(full_text)
    norm_quote = normalize_chars(quote)
    if dim == "metric":
        toks = tokens(quote)
        return {"tokens": toks, "canonical": " ".join(toks)}
    if dim == "value":
        num = to_number(quote)
        dec, inc = bool(DEC_RE.search(norm_full)), bool(INC_RE.search(norm_full))
        direction = "decrease" if dec and not inc else "increase" if inc and not dec else None
        negated = bool(NEG_DIR_RE.search(norm_full))
        sm = STAT_RE.search(norm_full)
        cands = {m.group(1) for m in PCT_RE.finditer(norm_full)} | {m.group(1) for m in TIMEVAL_RE.finditer(norm_full)}
        return {"number": num, "direction": direction, "negated": negated,
                "valence_only": direction is None and bool(VALENCE_RE.search(norm_full)),
                "statistic": STAT_NORM.get(sm.group(1).lower()) if sm else None,
                "statistic_raw": sm.group(1).lower() if sm else None,
                "candidates": len(cands)}
    if dim == "unit":
        return {"unit": norm_unit(quote), "unit_raw": quote.strip()}
    if dim == "population":
        um = UNIV_POP_RE.search(norm_quote)
        if um:
            return {"scope": "universal", "tokens": [], "n": None}
        has_num = bool(re.search(r"\d", norm_quote) or parse_num_word(norm_quote))
        n = to_number(quote) if has_num else None
        return {"scope": "bounded", "tokens": tokens(quote), "n": n}
    if dim == "time_window":
        m = TW_RE.search(norm_quote) or re.search(rf"({NUM_RE_STR})[\s-]*(day|week|month|year)", norm_quote, I)
        if not m:
            return {}
        n = to_number(m.group(1))
        if n is None:
            return {}
        return {"n": n, "unit": m.group(2).lower()}
    if dim == "conditions":
        m = COND_RE.search(quote)
        base = m.group(0) if m else quote
        items = [t.lower() for t in re.split(r"[^A-Za-z0-9]+", base) if t and t.lower() not in GENERIC and t.lower() not in {"using", "on", "with", "under", "via", "version", "edition", "mode"}]
        return {"items": sorted(set(items))}
    if dim == "strength":
        return {"level": level}
    return {}
