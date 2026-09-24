"""Fetch all IEEE TQE (ISSN 2689-1808) records from Crossref into tqe_data/raw_crossref.json"""
import json, sys, time, urllib.request

API = "https://api.crossref.org/journals/2689-1808/works"
START_CURSOR = "*"
ROWS = 500  # max rows per request for cursor

def req(url):
    for attempt in range(4):
        try:
            r = urllib.request.Request(url, headers={"User-Agent": "TQE-index/1.0 (mailto:research@example.com)"})
            with urllib.request.urlopen(r, timeout=60) as f:
                return json.load(f)
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))

all_items = []
cursor = START_CURSOR
seen = set()
while True:
    import urllib.parse
    url = API + "?rows=%d&cursor=%s" % (ROWS, urllib.parse.quote(cursor, safe=""))
    d = req(url)
    msg = d["message"]
    items = msg["items"]
    new = [it for it in items if it["DOI"] not in seen]
    all_items.extend(new)
    for it in new:
        seen.add(it["DOI"])
    print(f"fetched batch: {len(items)} new: {len(new)} total so far: {len(all_items)} / {msg['total-results']}")
    if not items or len(all_items) >= msg["total-results"]:
        break
    cursor = msg.get("next-cursor", cursor)

with open(__file__.replace("fetch_crossref.py", "raw_crossref.json"), "w", encoding="utf-8") as f:
    json.dump(all_items, f, ensure_ascii=False)

# stats
from collections import Counter
years = Counter()
with_abs = 0
for it in all_items:
    dp = (it.get("published") or it.get("issued") or {}).get("date-parts", [[None]])
    y = dp[0][0] if dp and dp[0] else None
    years[y] += 1
    if it.get("abstract"):
        with_abs += 1
print("YEARS:", dict(sorted(years.items(), key=lambda x: (str(x[0])))))
print(f"abstract coverage: {with_abs}/{len(all_items)}")
