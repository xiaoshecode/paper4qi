// Read-only MCP service. Asset bytes and their checksums come from the same build.
// Sites authenticates requests before forwarding them to this Worker.
export function createWorker(assets) {
  let corpusPromise;
  const decoder = new TextDecoder();
  async function bytes(path) {
    const asset = assets[path];
    if (!asset) throw new Error(`Unknown asset: ${path}`);
    const compressed = Uint8Array.from(atob(asset.body), c => c.charCodeAt(0));
    return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  async function jsonAsset(path) { return JSON.parse(decoder.decode(await bytes(path))); }
  function corpus() { return corpusPromise ??= jsonAsset('/data/papers.json').then(data => data.papers); }
  const tool = (name, description, properties, required = []) => ({ name, description, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, inputSchema: { type: 'object', properties, required, additionalProperties: false } });
  const TOOLS = [
    tool('search_papers', 'Search the paper4qi snapshot. Space-separated terms use AND across title, authors, abstract, Chinese notes, DOI and tags. Excludes front matter by default. QCE26 means program records, not verified publication. Returns stable IDs, citation links and pagination.', {
      query: { type: 'string', maxLength: 300 }, source: { type: 'string', enum: ['qce', 'qce26', 'tqe'] },
      year: { type: 'integer', minimum: 2000, maximum: 2100 }, category: { type: 'string' },
      subtopic: { type: 'string', maxLength: 100, description: 'Exact topic key from get_research_map; applies transparent keyword associations, not manual paper review.' },
      include_front_matter: { type: 'boolean', default: false }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }, offset: { type: 'integer', minimum: 0, default: 0 }
    }),
    tool('get_paper', 'Read a full record by its exact stable id. Includes abstract, source links and evidence limitations. Resolves retired QCE26 program IDs through the build redirect map.', { id: { type: 'string', minLength: 1, maxLength: 300 } }, ['id']),
    tool('get_library_overview', 'Get the corpus manifest, freshness, available files, provenance and quality report. Build date is not source verification date.', {}),
    tool('get_research_statistics', 'Read year/category statistics and current snapshot totals. Excludes front matter; includes program records as separately identified by the totals.', {}),
    tool('get_research_map', 'List research domains and subtopics, or read one subtopic with primary sources, questions, editorial research hypotheses and associated corpus IDs. Keyword associations are unreviewed leads.', { topic: { type: 'string', maxLength: 100 } }),
    tool('read_research_guide', 'Read OpenQASM research notes, the agent usage guide, the CS4Q bibliography or venue reference data. These are dated editorial guides; verify scientific claims and current submission details against primary sources.', { guide: { type: 'string', enum: ['openqasm', 'agents', 'cs4q', 'venues'] } }, ['guide'])
  ];
  const sources = { qce: 'proceedings_metadata', qce26: 'program_entry', tqe: 'journal_metadata' };
  const evidence = 'Chinese notes and category labels are secondary annotations. Cite the original DOI/arXiv work; a program entry is not proof of publication. Missing abstracts/citation counts are not zero or negative evidence.';
  function links(p) {
    return { doi: p.doi ? `https://doi.org/${p.doi}` : null, arxiv: p.arxiv ? `https://arxiv.org/abs/${p.arxiv}` : null };
  }
  function validate(name, args) {
    const definition = TOOLS.find(t => t.name === name);
    if (!definition) throw new Error(`Unknown tool: ${name}`);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('arguments must be an object');
    for (const key of Object.keys(args)) if (!(key in definition.inputSchema.properties)) throw new Error(`Unknown argument: ${key}`);
    for (const key of definition.inputSchema.required) if (!(key in args)) throw new Error(`Missing argument: ${key}`);
    for (const [key, value] of Object.entries(args)) {
      const rule = definition.inputSchema.properties[key];
      if (rule.type === 'integer' ? !Number.isInteger(value) : typeof value !== rule.type) throw new Error(`Invalid ${key} type`);
      if (rule.enum && !rule.enum.includes(value)) throw new Error(`Invalid ${key}`);
      if (rule.minimum != null && value < rule.minimum || rule.maximum != null && value > rule.maximum) throw new Error(`Invalid ${key} range`);
      if (rule.maxLength != null && value.length > rule.maxLength || rule.minLength != null && value.length < rule.minLength) throw new Error(`Invalid ${key} length`);
    }
  }
  async function call(name, args) {
    validate(name, args);
    if (name === 'get_library_overview') return { manifest: await jsonAsset('/data/manifest.json'), quality: await jsonAsset('/data/quality.json'), evidence_note: evidence };
    if (name === 'get_research_statistics') return { statistics: await jsonAsset('/data/stats.json'), evidence_note: evidence };
    if (name === 'get_research_map') {
      const map = await jsonAsset('/data/research-map.json');
      if (args.topic) {
        const topic = map.topics.find(t => t.key === args.topic);
        if (!topic) throw new Error('Unknown topic; call get_research_map without arguments first');
        return { generated: map.generated, method: map.method, limitations: map.limitations, topic };
      }
      return { generated: map.generated, counts: map.counts, domains: map.domains, method: map.method, limitations: map.limitations,
        topics: map.topics.map(({ matched_papers, sources, ...topic }) => ({ ...topic, source_count: sources.length })) };
    }
    if (name === 'read_research_guide') {
      if (args.guide === 'cs4q' || args.guide === 'venues') {
        const payload = await jsonAsset('/data/guides.json');
        return { guide: args.guide, generated: payload.generated, limitations: payload.limitations, data: payload.guides[args.guide], evidence_note: evidence };
      }
      const path = args.guide === 'openqasm' ? '/guides/openqasm.md' : '/guides/agents.md';
      return { guide: args.guide, text: decoder.decode(await bytes(path)), evidence_note: evidence };
    }
    const papers = await corpus();
    if (name === 'get_paper') {
      let id = args.id;
      let p = papers.find(p => p.id === id);
      if (!p && assets['/data/id-redirects.json']) {
        const redirects = await jsonAsset('/data/id-redirects.json');
        const mapping = redirects.redirects ?? redirects;
        const target = Array.isArray(mapping) ? mapping.find(row => row.old_id === id)?.new_id : mapping[id];
        id = typeof target === 'string' ? target : target?.id ?? target?.to;
        p = papers.find(p => p.id === id);
      }
      if (!p) throw new Error(`Record not found: ${args.id}`);
      return { requested_id: args.id, paper: p, record_kind: sources[p.source], links: links(p), evidence_note: evidence };
    }
    if (args.category && !papers.some(p => p.category === args.category)) throw new Error('Unknown category; get_library_overview lists the taxonomy');
    let topicIds;
    if (args.subtopic) {
      const map = await jsonAsset('/data/research-map.json');
      const topic = map.topics.find(t => t.key === args.subtopic);
      if (!topic) throw new Error('Unknown subtopic; call get_research_map to list available keys');
      topicIds = new Set(topic.matched_papers.map(p => p.id));
    }
    const terms = (args.query ?? '').normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = papers.filter(p => (!topicIds || topicIds.has(p.id)) && (args.include_front_matter || !p.front_matter) && (!args.source || p.source === args.source) && (!args.year || p.year === args.year) && (!args.category || p.category === args.category) && terms.every(term => [p.title, ...(p.authors ?? []), p.abstract, p.zh, p.doi, p.arxiv, p.venue, ...(p.tags ?? [])].join(' ').normalize('NFKC').toLowerCase().includes(term)));
    matches.sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
    const offset = args.offset ?? 0, limit = args.limit ?? 20;
    return { total: matches.length, offset, limit, next_offset: offset + limit < matches.length ? offset + limit : null, results: matches.slice(offset, offset + limit).map(p => ({ id: p.id, title: p.title, year: p.year, source: p.source, record_kind: sources[p.source], category: p.category, authors: p.authors, has_abstract: !!p.abstract, front_matter: p.front_matter, links: links(p) })), evidence_note: evidence };
  }
  const response = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
  async function rpc(request) {
    if (request.method !== 'POST') return response({ error: 'Use JSON-RPC POST /mcp' }, 405, { Allow: 'POST' });
    if (Number(request.headers.get('content-length')) > 65536) return response({ error: 'Request too large' }, 413);
    const raw = await request.text();
    if (raw.length > 65536) return response({ error: 'Request too large' }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return response({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
    if (!input || input.jsonrpc !== '2.0' || typeof input.method !== 'string' || Array.isArray(input)) return response({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }, 400);
    if (input.id === undefined) return new Response(null, { status: 202 });
    const ok = result => response({ jsonrpc: '2.0', id: input.id, result });
    if (input.method === 'server/discover') return ok({ supportedVersions: ['2026-07-28'], capabilities: { tools: {} } });
    if (input.method === 'initialize') return ok({ protocolVersion: ['2025-03-26', '2025-06-18', '2026-07-28'].includes(input.params?.protocolVersion) ? input.params.protocolVersion : '2026-07-28', capabilities: { tools: {} }, serverInfo: { name: 'paper4qi-library', version: '1.0.0' }, instructions: evidence });
    if (input.method === 'ping') return ok({});
    if (input.method === 'tools/list') return ok({ tools: TOOLS });
    if (input.method === 'tools/call') {
      try { const result = await call(input.params?.name, input.params?.arguments ?? {}); return ok({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false }); }
      catch (error) { return ok({ content: [{ type: 'text', text: error.message }], isError: true }); }
    }
    return response({ jsonrpc: '2.0', id: input.id, error: { code: -32601, message: 'Method not found' } });
  }
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === '/mcp' || url.pathname === '/mcp/') return rpc(request);
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { return new Response('Bad path', { status: 400 }); }
      if (path === '/paper4qi' || path.startsWith('/paper4qi/')) {
        const target = new URL(url);
        target.pathname = path.slice('/paper4qi'.length) || '/';
        return Response.redirect(target.href, 308);
      }
      if (!assets[path] && assets[`${path}/index.html`]) {
        const target = new URL(url);
        target.pathname = `${path}/`;
        return Response.redirect(target.href, 308);
      }
      if (path.endsWith('/')) path += 'index.html';
      const asset = assets[path];
      if (!asset) return new Response('Not found', { status: 404 });
      const headers = { 'Content-Type': asset.type, 'Cache-Control': 'private, max-age=0, must-revalidate', 'ETag': `"${asset.sha256}"`, 'X-Content-Type-Options': 'nosniff' };
      if (request.headers.get('If-None-Match') === headers.ETag) return new Response(null, { status: 304, headers });
      return new Response(request.method === 'HEAD' ? null : await bytes(path), { headers });
    }
  };
}
