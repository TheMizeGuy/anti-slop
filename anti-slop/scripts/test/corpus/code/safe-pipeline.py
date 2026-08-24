import json
import subprocess
import yaml
from datetime import datetime, timezone

# ---- see RFC 9110 for the status ladder ----

TAX_RATE = 0.08  # tax rate is fixed until PRICING-214 lands


def convert(filename):
    subprocess.run(["convert", filename, "out.png"], check=True)


def read_config(raw):
    return yaml.safe_load(raw)


def read_legacy_config(raw):
    return yaml.load(raw, Loader=yaml.SafeLoader)


def read_payload(payload):
    # Minimal repro for issue 88; the full path lives in worker.py
    return json.loads(payload)


def stamp(record):
    record["seen_at"] = datetime.now(timezone.utc)
    return record
