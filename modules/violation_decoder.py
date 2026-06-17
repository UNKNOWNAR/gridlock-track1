import re
import pandas as pd


CODE_MAP = {
    112: "Wrong Side",
    113: "No Parking",
    104: "Dangerous Driving",
    107: "Obstruction",
    105: "Speeding",
    177: "General Violation",
}


def _extract_codes(raw):
    if pd.isna(raw):
        return []
    return [int(x) for x in re.findall(r"\d+", str(raw))]


def decode_violations(df: pd.DataFrame) -> pd.DataFrame:
    df["violation_codes"] = df["offence_code"].apply(_extract_codes)
    df["primary_violation"] = df["violation_codes"].apply(
        lambda codes: CODE_MAP.get(codes[0], "Other") if codes else "Unknown"
    )
    df["violation_count_per_record"] = df["violation_codes"].apply(len)
    return df
