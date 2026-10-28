"""Build the agent discovery layer without changing the existing Paper format.

All resource URLs in manifest.json resolve relative to that manifest. This keeps
the same files usable under GitHub Pages' /paper4qi/ and a root-hosted mirror.
"""
import hashlib
import json
from collections import Counter
from pathlib import Path

from lib_taxonomy import CAT_NAMES, CAT_ORDER
from build_research_data import build_research_map

SCHEMA_VERSION = "1.0.0"


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def paper_schema():
    nullable_text = {"type": ["string", "null"]}
    properties = {
        "id": {"type": "string", "minLength": 1, "description": "Stable local record ID; qce26 IDs can be superseded by a DOI record."},
        "source": {"enum": ["qce", "qce26", "tqe"]},
        "source_id": {"type": "string"},
        "year": {"type": "integer", "description": "Dataset year; TQE uses its normalized volume year."},
        "title": {"type": "string", "minLength": 1},
        "authors": {"type": "array", "items": {"type": "string"}},
        "doi": {**nullable_text, "description": "DOI identifier without https://doi.org/; null means unavailable."},
        "arxiv": {**nullable_text, "description": "arXiv identifier; QCE26 matches were made by title and require verification."},
        "abstract": {**nullable_text, "description": "English abstract when available, not the paper's full text."},
        "zh": {"type": "string", "description": "Editorial/AI-assisted Chinese note or schedule label; not primary evidence. 待补充 marks a placeholder."},
        "category": {"enum": CAT_ORDER},
        "tags": {"type": "array", "items": {"type": "string"}},
        "venue": {"type": "string"},
        "pages": nullable_text,
        "cited_by": {"type": ["integer", "null"], "minimum": 0, "description": "OpenAlex citation-count snapshot for TQE. Null is unknown, not zero."},
        "front_matter": {"type": "boolean", "description": "Exclude true values for research-paper counts."},
        "track": nullable_text,
        "session": nullable_text,
        "day": nullable_text,
        "time": nullable_text,
        "best": {"type": ["integer", "null"], "description": "Imported program award rank/label. Verify the official program before making award claims."},
    }
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "paper4qi Paper record", "schema_version": SCHEMA_VERSION,
        "type": "object", "properties": properties,
        "required": list(properties)[:16], "additionalProperties": True,
    }


def coverage(rows):
    research = [p for p in rows if not p["front_matter"]]
    return {
        "records": len(rows), "research_records": len(research),
        "front_matter": len(rows) - len(research),
        "research_with_abstract": sum(bool(p.get("abstract")) for p in research),
        "research_with_doi": sum(bool(p.get("doi")) for p in research),
        "research_with_arxiv": sum(bool(p.get("arxiv")) for p in research),
        "research_with_citation_count": sum(p.get("cited_by") is not None for p in research),
        "research_missing_chinese_note": sum(not p.get("zh") or "待补充" in p["zh"] for p in research),
        "research_with_schedule_note": sum(p.get("zh", "").startswith("QCE26 官方日程") for p in research),
    }


def build_agent_exports(out_dir, source_dir, papers, generated):
    out = Path(out_dir)
    source = Path(source_dir)
    ids = [p["id"] for p in papers]
    if len(ids) != len(set(ids)):
        raise ValueError("Agent corpus contains duplicate record IDs")
    # Match the same order as qce.json followed by tqe.json; no ID rewriting.
    corpus = {"schema_version": SCHEMA_VERSION, "source": "combined", "generated": generated,
              "count": len(papers), "papers": papers}
    write_json(out / "papers.json", corpus)
    write_json(out / "paper.schema.json", paper_schema())
    categories = [{"key": key, "label_zh": CAT_NAMES[key]} for key in CAT_ORDER]
    write_json(out / "categories.json", {"schema_version": SCHEMA_VERSION, "categories": categories})

    state_path = source / ".update_state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    freshness = {
        "build_generated_at": generated,
        "updater_last_completed_run": {"qce": state.get("last_qce_run"), "tqe": state.get("last_tqe_run")},
        "source_records_last_verified_at": None,
        "explanation": "Build time is not a source refresh time. Updater run dates are recorded pipeline runs, not per-record verification or guarantees that every upstream request succeeded. QCE26 program data and curated guides are not refreshed by these dates. Unknown verification dates are null.",
    }
    research = [p for p in papers if not p["front_matter"]]
    quality = {
        "schema_version": SCHEMA_VERSION, "generated": generated,
        "overall": coverage(papers),
        "by_source": {name: coverage([p for p in papers if p["source"] == name]) for name in ("qce", "qce26", "tqe")},
        "research_by_year": dict(sorted(Counter(str(p["year"]) for p in research).items())),
        "research_by_category": {key: sum(p["category"] == key for p in research) for key in CAT_ORDER},
        "freshness": freshness,
        "limitations": [
            "The corpus covers selected IEEE QCE and TQE records; it is not an exhaustive quantum-computing literature search.",
            "source=qce26 means an imported program entry, not evidence that a DOI or final proceedings paper exists. Matched arXiv records can be a different version.",
            "Chinese notes and automated categories are discovery aids; verify scientific claims against the original paper.",
            "Null abstract, DOI, arXiv or citation count means unavailable in this snapshot, not nonexistent.",
            "Coverage counts measure field presence, not scientific accuracy, completeness or independent verification.",
        ],
    }
    write_json(out / "quality.json", quality)
    replaced_path = source / "qce" / "replaced_qce26.json"
    replaced = json.loads(replaced_path.read_text(encoding="utf-8")) if replaced_path.exists() else {}
    redirects = [{"old_id": f"qce26:{key}", "new_id": f"qce:{doi.lower()}"}
                 for key, doi in sorted(replaced.items())]
    write_json(out / "id-redirects.json", {"schema_version": SCHEMA_VERSION, "redirects": redirects})
    build_research_map(out, source, papers, generated)

    asset_info = [
        ("papers", "papers.json", "Combined corpus including front matter; papers[] uses paper.schema.json."),
        ("qce", "qce.json", "QCE proceedings plus remaining QCE26 program entries."),
        ("tqe", "tqe.json", "TQE journal records including front matter."),
        ("statistics", "stats.json", "Existing statistics; totals.all excludes front matter and includes program entries."),
        ("paper_schema", "paper.schema.json", "JSON Schema for an individual papers[] record, not the entire envelope."),
        ("categories", "categories.json", "The 13 category keys and Chinese display labels."),
        ("quality", "quality.json", "Field coverage, provenance limits and freshness semantics."),
        ("id_redirects", "id-redirects.json", "Program IDs superseded by proceedings DOI records."),
        ("research_map", "research-map.json", "Curated subtopics, primary sources, research questions and transparent keyword associations to corpus IDs."),
    ]
    resources = []
    for key, filename, description in asset_info:
        raw = (out / filename).read_bytes()
        resources.append({"id": key, "url": filename, "media_type": "application/json", "bytes": len(raw),
                          "sha256": hashlib.sha256(raw).hexdigest(), "description": description})
    manifest = {
        "schema_version": SCHEMA_VERSION, "dataset": "paper4qi", "generated": generated,
        "title": "量子基础设施文献库 / Quantum Infrastructure Literature",
        "description": "Research discovery corpus for IEEE QCE and TQE, with curated research guides linked separately.",
        "canonical_site": "https://xiaoshecode.github.io/paper4qi/",
        "repository": "https://github.com/xiaoshecode/paper4qi",
        "url_resolution": "Resolve every resources[].url and guides[].url relative to this manifest URL; do not prepend the origin alone.",
        "transport": "Static JSON over HTTP GET. No authentication on GitHub Pages; hosted mirrors may require access. This is not a query API or MCP server.",
        "versioning": "1.x changes are additive. Consumers should ignore unknown fields, tolerate nulls, and follow id-redirects.json for reconciled program IDs.",
        "counts": quality["overall"], "freshness": freshness, "resources": resources,
        "sources": [
            {"id": "qce", "kind": "proceedings_metadata", "title": "IEEE QCE proceedings", "years": sorted(set(p["year"] for p in papers if p["source"] == "qce")), "source_files": "data_src/qce/", "upstream": ["IEEE Xplore", "Crossref", "OpenAlex"]},
            {"id": "qce26", "kind": "program_entry", "title": "QCE 2026 program snapshot", "years": [2026], "source_files": "data_src/qce26/", "upstream": ["Imported official technical program", "arXiv title matches"]},
            {"id": "tqe", "kind": "journal_metadata", "title": "IEEE Transactions on Quantum Engineering", "years": sorted(set(p["year"] for p in papers if p["source"] == "tqe")), "source_files": "data_src/tqe/", "upstream": ["Crossref", "OpenAlex", "Semantic Scholar", "arXiv"]},
        ],
        "guides": [
            {"id": "research_map", "url": "../research/", "kind": "curated_topic_map"},
            {"id": "curated_export", "url": "guides.json", "kind": "structured_curated_data", "description": "CS4Q entries, venue records and OpenQASM report, exported from their page sources during Astro build; independently dated curated content."},
            {"id": "agent_access", "url": "../agents/", "kind": "usage_guide"},
            {"id": "methodology", "url": "../about/", "kind": "methodology"},
            {"id": "cs4q", "url": "../cs4q/", "kind": "curated_analysis"},
            {"id": "openqasm", "url": "../openqasm/", "kind": "curated_analysis"},
            {"id": "venues", "url": "../venues/", "kind": "curated_venue_reference"},
        ],
        "recommended_workflow": ["Read quality.json and freshness before use.", "Fetch papers.json once; cache it with the resource SHA-256.", "Exclude front_matter, filter by source/year/category, then match title/abstract/tags/zh.", "Keep id, title, authors, year, source, DOI/arXiv and snapshot timestamp in evidence tables.", "Read linked original papers to support claims; distinguish program entries and preprints from proceedings."] ,
        "rights": "Repository LICENSE applies as stated there. Upstream abstracts and publication metadata retain their original rights; no blanket relicensing of third-party content is asserted.",
    }
    write_json(out / "manifest.json", manifest)
    return manifest
