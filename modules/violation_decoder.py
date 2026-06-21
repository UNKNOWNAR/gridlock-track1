import json
import re
import pandas as pd


# ── Legacy offence code map (kept for backward compat) ──────────────────────
CODE_MAP = {
    112: "Wrong Parking",
    113: "No Parking",
    104: "Dangerous Driving",
    107: "Obstruction",
    105: "Speeding",
    177: "General Violation",
}

# ── Parking violation severity classification ────────────────────────────────
# CRITICAL: directly block carriageway / intersection / hazardous
CRITICAL_VIOLATIONS = {
    "DOUBLE PARKING",
    "PARKING IN A MAIN ROAD",
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS",
    "AGAINST ONE WAY/NO ENTRY",
}

# HIGH: block pedestrian / near sensitive infrastructure
HIGH_VIOLATIONS = {
    "WRONG PARKING",
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC",
    "PARKING NEAR ROAD CROSSING",
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE",
}

# MODERATE: nuisance / footpath / technical violations
MODERATE_VIOLATIONS = {
    "NO PARKING",
    "PARKING ON FOOTPATH",
    "H T V PROHIBITED",
    "PARKING OTHER THAN BUS STOP",
}

# All parking types (for is_parking_violation flag)
ALL_PARKING_VIOLATIONS = CRITICAL_VIOLATIONS | HIGH_VIOLATIONS | MODERATE_VIOLATIONS

SEVERITY_SCORES = {"CRITICAL": 3, "HIGH": 2, "MODERATE": 1, "OTHER": 0}


def _extract_codes(raw):
    """Extract integer offence codes from JSON-like string."""
    if pd.isna(raw):
        return []
    return [int(x) for x in re.findall(r"\d+", str(raw))]


def _parse_violation_types(raw):
    """Parse JSON array string like '[\"WRONG PARKING\",\"NO PARKING\"]' into a list."""
    if pd.isna(raw):
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(v).strip().upper() for v in parsed]
    except (json.JSONDecodeError, TypeError):
        pass
    # fallback: naive regex extraction of quoted strings
    return [m.strip().upper() for m in re.findall(r'"([^"]+)"', str(raw))]


def _get_parking_category(violation_types: list) -> str:
    """Classify the worst parking category present in a violation."""
    for vt in violation_types:
        if vt in CRITICAL_VIOLATIONS:
            return "CRITICAL"
    for vt in violation_types:
        if vt in HIGH_VIOLATIONS:
            return "HIGH"
    for vt in violation_types:
        if vt in MODERATE_VIOLATIONS:
            return "MODERATE"
    return "OTHER"


def decode_violations(df: pd.DataFrame) -> pd.DataFrame:
    # ── Legacy fields ────────────────────────────────────────────────────────
    df["violation_codes"] = df["offence_code"].apply(_extract_codes)
    df["primary_violation"] = df["violation_codes"].apply(
        lambda codes: CODE_MAP.get(codes[0], "Other") if codes else "Unknown"
    )
    df["violation_count_per_record"] = df["violation_codes"].apply(len)

    # ── New: parsed violation sub-types ─────────────────────────────────────
    df["violation_types_list"] = df["violation_type"].apply(_parse_violation_types)

    # Is this a parking-related violation?
    df["is_parking_violation"] = df["violation_types_list"].apply(
        lambda types: any(t in ALL_PARKING_VIOLATIONS for t in types)
    )

    # Most severe parking category in this record
    df["parking_category"] = df["violation_types_list"].apply(_get_parking_category)

    # Integer severity score: CRITICAL=3, HIGH=2, MODERATE=1, OTHER=0
    df["congestion_severity"] = df["parking_category"].map(SEVERITY_SCORES)

    # Comma-joined violation sub-types for display
    df["violation_subtypes"] = df["violation_types_list"].apply(
        lambda types: ", ".join(types) if types else "Unknown"
    )

    return df
