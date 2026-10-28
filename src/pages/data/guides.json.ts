import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import {
  CS4Q_ENTRIES, CS4Q_COUNTS, CS4Q_GROUP_ZH, CS4Q_GROUP_EN,
  CS4Q_LAYER_ZH, CS4Q_LAYER_EN, CS4Q_PLATFORM_ZH, CS4Q_PLATFORM_EN,
} from '../../data/cs4q';
import {
  JOURNALS, CONFS, CONF_DEADLINES, FIELD_ZH, FIELD_EN,
  CCF_CHANGES, TYPE_TARGETS, TIERS, STRATEGY, VENUE_COUNTS,
} from '../../data/venues';
import openqasmMarkdown from '../../content/openqasm-research.md?raw';

// Derive from the same imports as the human-readable pages, not copied data.
export const prerender = true;
export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL;
  const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf-8'));
  const payload = {
    schema_version: '1.0.0',
    generated: manifest.generated,
    generated_semantics: 'Build timestamp shared with the literature snapshot, not a new verification of these curated sources.',
    source: 'curated_guides',
    limitations: [
      'These are editorial research aids exported from the site source; their scientific and bibliographic claims require checking against linked originals.',
      'Source review dates are dates declared in the existing source, not an independent verification performed during this export.',
      'These guides are not part of the weekly corpus updater. Venue metrics, fees, classifications and deadlines can change.',
      'Paper identifiers here are scoped to each guide and are not the QCE/TQE corpus IDs.',
    ],
    guides: {
      cs4q: {
        title: 'CS4Q 量子测控导读', kind: 'curated_bibliography',
        page_url: `${base}cs4q/`, source_file: 'src/data/cs4q.ts',
        declared_source_review_date: '2026-09-21',
        counts: CS4Q_COUNTS,
        taxonomy: {
          groups: { zh: CS4Q_GROUP_ZH, en: CS4Q_GROUP_EN },
          layers: { zh: CS4Q_LAYER_ZH, en: CS4Q_LAYER_EN },
          platforms: { zh: CS4Q_PLATFORM_ZH, en: CS4Q_PLATFORM_EN },
        },
        entries: CS4Q_ENTRIES,
      },
      venues: {
        title: '期刊会议投稿指南', kind: 'curated_venue_reference',
        page_url: `${base}venues/`, source_file: 'src/data/venues.ts',
        declared_source_review_date: '2026-10-08',
        metrics_context: { impact_factor: '2025 JCR as recorded in source', cas: '2025-03 edition as recorded in source', ccf: '2026 seventh edition as recorded in source' },
        status_semantics: 'status=open/closed is a saved snapshot, not a live deadline determination. Verify each official CFP and timezone.',
        fields: { zh: FIELD_ZH, en: FIELD_EN }, counts: VENUE_COUNTS,
        journals: JOURNALS, conferences: CONFS, conference_deadlines: CONF_DEADLINES,
        ccf_changes: CCF_CHANGES, submission_targets: TYPE_TARGETS,
        editorial_tiers: TIERS, editorial_strategy: STRATEGY,
      },
      openqasm: {
        title: 'OpenQASM 标准与应用调研', kind: 'curated_research_report',
        page_url: `${base}openqasm/`, source_file: 'src/content/openqasm-research.md',
        declared_source_review_date: '2026-10-27', language: 'zh-CN',
        content_markdown: openqasmMarkdown,
      },
    },
  };
  return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
