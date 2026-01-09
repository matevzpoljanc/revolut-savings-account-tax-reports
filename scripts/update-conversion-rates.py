#!/usr/bin/env python3
"""
Fetches exchange rates from Banka Slovenije API and updates conversion-rates.json.

Usage:
    python scripts/update-conversion-rates.py [year]

Examples:
    python scripts/update-conversion-rates.py           # Fetches current year
    python scripts/update-conversion-rates.py 2025     # Fetches specific year
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

# Path to the conversion rates file (relative to project root)
CONVERSION_RATES_FILE = Path(__file__).parent.parent / "public" / "conversion-rates.json"
BSI_API_URL = "https://api.bsi.si/exchange/daily"


def fetch_rates_for_year(year: int) -> list[dict]:
    """Fetch all exchange rates for a given year from the BSI API."""
    url = f"{BSI_API_URL}?date={year}"
    print(f"Fetching rates from: {url}")

    try:
        with urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
    except URLError as e:
        print(f"Error fetching data: {e}")
        return []

    if not data.get("success"):
        print(f"API returned error: {data.get('error')}")
        return []

    return data.get("data", [])


def transform_bsi_data(bsi_data: list[dict]) -> dict[str, dict[str, float]]:
    """
    Transform BSI API data into the format used by conversion-rates.json.

    BSI format:  [{"code": "USD", "date": "2024-12-30", "value": 1.0444}, ...]
    Our format:  {"2024-12-30": {"USD": 1.0444, "GBP": 0.8295, ...}, ...}
    """
    rates_by_date: dict[str, dict[str, float]] = {}

    for entry in bsi_data:
        date = entry.get("date")
        code = entry.get("code")
        value = entry.get("value")

        if not all([date, code, value]):
            continue

        if date not in rates_by_date:
            rates_by_date[date] = {}

        rates_by_date[date][code] = value

    return rates_by_date


def load_existing_rates() -> list[dict]:
    """Load existing conversion rates from the JSON file."""
    if not CONVERSION_RATES_FILE.exists():
        print(f"Warning: {CONVERSION_RATES_FILE} not found, creating new file")
        return []

    with open(CONVERSION_RATES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def merge_rates(existing: list[dict], new_rates_by_date: dict[str, dict[str, float]]) -> list[dict]:
    """
    Merge new rates into existing rates.
    New rates overwrite existing rates for the same date.
    Result is sorted by date in descending order (newest first).
    """
    # Convert existing list to dict for easier merging
    existing_by_date = {entry["date"]: entry["rates"] for entry in existing}

    # Merge new rates (overwriting existing)
    for date, rates in new_rates_by_date.items():
        existing_by_date[date] = rates

    # Convert back to list format, sorted by date descending
    merged = [
        {"date": date, "rates": rates}
        for date, rates in sorted(existing_by_date.items(), reverse=True)
    ]

    return merged


def save_rates(rates: list[dict]) -> None:
    """Save conversion rates to the JSON file."""
    # Ensure directory exists
    CONVERSION_RATES_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(CONVERSION_RATES_FILE, "w", encoding="utf-8") as f:
        json.dump(rates, f, indent=4)

    print(f"Saved {len(rates)} rate entries to {CONVERSION_RATES_FILE}")


def main():
    # Determine which year to fetch
    if len(sys.argv) > 1:
        try:
            year = int(sys.argv[1])
        except ValueError:
            print(f"Invalid year: {sys.argv[1]}")
            sys.exit(1)
    else:
        year = datetime.now().year

    print(f"Updating conversion rates for year {year}...")

    # Fetch new rates from BSI API
    bsi_data = fetch_rates_for_year(year)
    if not bsi_data:
        print("No data fetched from API")
        sys.exit(1)

    print(f"Fetched {len(bsi_data)} currency entries from BSI API")

    # Transform to our format
    new_rates = transform_bsi_data(bsi_data)
    print(f"Transformed into {len(new_rates)} date entries")

    # Load existing rates
    existing_rates = load_existing_rates()
    print(f"Loaded {len(existing_rates)} existing date entries")

    # Merge and save
    merged_rates = merge_rates(existing_rates, new_rates)

    # Count how many new dates were added
    existing_dates = {entry["date"] for entry in existing_rates}
    new_dates = set(new_rates.keys()) - existing_dates
    updated_dates = set(new_rates.keys()) & existing_dates

    print(f"Added {len(new_dates)} new dates, updated {len(updated_dates)} existing dates")

    save_rates(merged_rates)
    print("Done!")


if __name__ == "__main__":
    main()
