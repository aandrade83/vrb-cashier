---
name: workout-chart
description: >
  Generates a monthly workout frequency bar chart as a PNG image by querying the PostgreSQL
  database directly. Use this skill whenever the user asks to visualize workout data, plot
  workout history, chart how often they worked out, see their training frequency over time,
  or export workout statistics as an image. Triggers on phrases like "chart my workouts",
  "plot workout history", "how many times did I work out", "workout frequency chart",
  "generate workout stats image", or any request to visualize lifting/training data.
---

# Workout Chart Skill

Generate a bar chart showing monthly workout frequency for the past year, saved as a PNG.

## What this skill does

1. Reads `DATABASE_URL` from the project's `.env` file
2. Queries the `workouts` table for entries in the past 12 months
3. Groups them by month
4. Plots a bar chart with matplotlib (X = month label like "Mar 2025", Y = workout count)
5. Saves the chart as `workout_chart.png` in the project root

## Steps to execute

### 1. Find the project root and .env file

The project root is the current working directory (or the nearest ancestor containing a `.env` file). Confirm it has a `DATABASE_URL` entry.

### 2. Check Python dependencies

The script needs: `psycopg2-binary`, `matplotlib`, `python-dotenv`.

If any are missing, tell the user:
```
pip install psycopg2-binary matplotlib python-dotenv
```
Then stop and ask them to install before continuing.

### 3. Run the chart script via Bash

Generate and execute this Python script inline using the Bash tool:

```bash
python - << 'PYEOF'
import os, sys
from pathlib import Path

# Load .env
try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("Missing dependency: pip install python-dotenv")

try:
    import psycopg2
except ImportError:
    sys.exit("Missing dependency: pip install psycopg2-binary")

try:
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend — works without a display
    import matplotlib.pyplot as plt
    import matplotlib.ticker as ticker
except ImportError:
    sys.exit("Missing dependency: pip install matplotlib")

from datetime import datetime, timedelta
from collections import defaultdict

# Find .env in current dir or parents
env_path = None
for p in [Path.cwd()] + list(Path.cwd().parents):
    candidate = p / ".env"
    if candidate.exists():
        env_path = candidate
        break

if not env_path:
    sys.exit("Could not find .env file")

load_dotenv(env_path)
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    sys.exit("DATABASE_URL not set in .env")

# Query workouts from the past 12 months
now = datetime.utcnow()
one_year_ago = now - timedelta(days=365)

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute(
    """
    SELECT DATE_TRUNC('month', created_at) AS month
    FROM workouts
    WHERE created_at >= %s
    ORDER BY month
    """,
    (one_year_ago,),
)
rows = cur.fetchall()
cur.close()
conn.close()

# Count per month
counts = defaultdict(int)
for (month,) in rows:
    counts[month] += 1

# Build full 12-month range (so months with 0 workouts still appear)
months = []
labels = []
for i in range(11, -1, -1):
    d = (now.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
    key = d.replace(hour=0, minute=0, second=0, microsecond=0)
    months.append(key)
    labels.append(d.strftime("%b %Y"))

values = [counts.get(m, 0) for m in months]

# Plot
fig, ax = plt.subplots(figsize=(12, 6))
bars = ax.bar(labels, values, color="#4f9cf9", edgecolor="#2b6cb0", linewidth=0.8)

ax.set_xlabel("Month", fontsize=12)
ax.set_ylabel("Number of Workouts", fontsize=12)
ax.set_title("Monthly Workout Frequency (Past 12 Months)", fontsize=14, fontweight="bold")
ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))
plt.xticks(rotation=45, ha="right")

# Annotate bars with count
for bar, val in zip(bars, values):
    if val > 0:
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.1,
            str(val),
            ha="center",
            va="bottom",
            fontsize=10,
        )

plt.tight_layout()
out_path = Path.cwd() / "workout_chart.png"
plt.savefig(out_path, dpi=150)
print(f"Chart saved to: {out_path}")
PYEOF
```

### 4. Report the result

Tell the user the chart was saved as `workout_chart.png` in the project root, and summarize the data (e.g., "You logged 3 workouts in March 2025, 5 in April…").

## Error handling

| Error | Response |
|---|---|
| `Missing dependency` exit | Tell the user to run the pip install command and retry |
| `DATABASE_URL not set` | Ask them to confirm their `.env` has `DATABASE_URL` |
| `could not connect` / auth error | Tell the user the DB connection failed and show the error |
| Empty result (0 workouts) | Still generate the chart (all-zero bars) and note no workouts were found |
