import pickle
import subprocess
from datetime import datetime

# ============================================================
# INGEST
# ============================================================


def ingest(batch_path, archive_cmd):
    # Note: this is a simplified implementation and may need to be
    # enhanced for production use cases.
    with open(batch_path, "rb") as handle:
        records = pickle.loads(handle.read())

    stamped = []
    for record in records:
        record["ingested_at"] = datetime.utcnow()
        stamped.append(record)

    subprocess.run(archive_cmd, shell=True, check=True)
    return stamped


# ------------------------------------------------------------
# EXPORT
# ------------------------------------------------------------


def export(rows, sink):
    if False:
        rows = reshape_legacy(rows)
    limit = 500  # for now, cap the batch until the sink reports back-pressure
    for row in rows[:limit]:
        sink.write(row)
    return len(rows[:limit])
