#!/usr/bin/env node
/**
 * build_report_html.mjs — 把项目里的中文调研 Markdown 报告渲染成可离线阅读的单文件 HTML。
 *
 * 用法：
 *   node tools/build_report_html.mjs <input.md> <output.html> ["页面标题"]
 *
 * 特性：侧栏目录（H2/H3，滚动联动）、全文搜索高亮（上一个/下一个）、
 *       宽表格横向滚动、★ 重点行高亮、打印友好、顶部阅读进度条。
 * 无第三方依赖：本文件自带所需的最小 Markdown 解析（覆盖本项目报告的语法子集）。
 */
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------- 参数 ---------------------------------- */
const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error('用法: node tools/build_report_html.mjs <input.md> <output.html> ["页面标题"]');
  process.exit(1);
}
const IN = path.resolve(argv[0]);
const OUT = path.resolve(argv[1]);
const TITLE_OVERRIDE = argv[2] || '';

if (!fs.existsSync(IN)) {
  console.error(`找不到输入文件: ${IN}`);
  process.exit(1);
}
const md = fs.readFileSync(IN, 'utf8');

/* ------------------------------ 行内元素渲染 ------------------------------ */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 渲染行内 Markdown。允许一层嵌套：链接文字内部可再含粗体与行内代码。
 * 先抽出 code 与链接占位，转义剩余文本，再回填，避免转义破坏生成的标签。
 */
function inline(src, allowLinks = true) {
  const codes = [];
  const links = [];
  let s = String(src);

  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0001${codes.push(c) - 1}\u0001`);
  if (allowLinks) {
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `\u0002${links.push({ t, u }) - 1}\u0002`);
  }

  s = esc(s);

  // 粗体 -> <strong>
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 回填行内代码
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${esc(codes[+i])}</code>`);

  // 回填链接（链接文字递归渲染，但禁止再解析链接）
  s = s.replace(/\u0002(\d+)\u0002/g, (_, i) => {
    const { t, u } = links[+i];
    return `<a href="${esc(u)}" target="_blank" rel="noopener">${inline(t, false)}</a>`;
  });

  return s;
}

/* -------------------------------- 块级解析 -------------------------------- */
const RE_HR = /^-{3,}\s*$/;
const RE_H = /^(#{1,6})\s+(.*)$/;
const RE_QUOTE = /^>\s?/;
const RE_UL = /^[-*]\s+/;
const RE_OL = /^\d+\.\s+/;
const RE_TABLE = /^\s*\|/;
const RE_STARTS_BLOCK = /^(#{1,6}\s|>|\||[-*]\s|\d+\.\s|-{3,}\s*$)/;

function parseBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (RE_HR.test(line) && !RE_STARTS_BLOCK.test(line.replace(RE_HR, '\u0000'))) {
      // 单独成行的 --- 视为分隔线（本报告所有标题都用 #，不存在 setext 标题）
      blocks.push({ type: 'hr' }); i++; continue;
    }

    const h = RE_H.exec(line);
    if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2].trim() }); i++; continue; }

    if (RE_TABLE.test(line)) {
      const rows = [];
      while (i < lines.length && RE_TABLE.test(lines[i])) { rows.push(lines[i]); i++; }
      blocks.push({ type: 'table', rows });
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const buf = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) { buf.push(lines[i].replace(RE_QUOTE, '')); i++; }
      blocks.push({ type: 'quote', lines: buf });
      continue;
    }

    if (RE_UL.test(line)) {
      const items = [];
      while (i < lines.length && RE_UL.test(lines[i])) { items.push(lines[i].replace(RE_UL, '')); i++; }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (RE_OL.test(line)) {
      const items = [];
      while (i < lines.length && RE_OL.test(lines[i])) { items.push(lines[i].replace(RE_OL, '')); i++; }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 段落：累积到空行或下一个块起始
    const buf = [];
    while (i < lines.length && lines[i].trim() && !RE_STARTS_BLOCK.test(lines[i])) { buf.push(lines[i].trim()); i++; }
    if (buf.length) blocks.push({ type: 'p', text: buf.join(' ') });
    else i++; // 保险：避免死循环
  }
  return blocks;
}

/* --------------------------------- 表格 ---------------------------------- */
function splitRow(line) {
  let s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++; continue; }
    if (s[k] === '|') { cells.push(cur); cur = ''; continue; }
    cur += s[k];
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const RE_SEP_CELL = /^:?-{2,}:?$/;

function renderTable(rows) {
  const parsed = rows.map(splitRow);
  let head = null;
  let body = parsed;

  if (parsed.length >= 2 && parsed[1].every((c) => RE_SEP_CELL.test(c) || c === '')) {
    head = parsed[0];
    body = parsed.slice(2);
  }

  // 只有 ★★（最直接对标）才整行强调；单星 ★ 数量太多，仅用彩色字形区分，避免全表高亮失去信号
  const rowClass = (cells) => (cells.join(' ').includes('★★') ? ' class="s2"' : '');

  // 单元格开头若为 ★/★★，拆成带色标记 + 正文
  const cell = (c) => {
    const m = /^(★+)\s*/.exec(c);
    if (!m) return inline(c);
    const cls = m[1].length >= 2 ? 'st2' : 'st1';
    return `<span class="${cls}" title="${m[1].length >= 2 ? '最直接对标' : '相关'}">${m[1]}</span>${inline(c.slice(m[0].length))}`;
  };

  const thead = head
    ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
    : '';

  const tbody = `<tbody>${body
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => `<tr${rowClass(r)}>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;

  return `<div class="tw"><table>${thead}${tbody}</table></div>`;
}

/* -------------------------------- 渲染主体 -------------------------------- */
const blocks = parseBlocks(md);

// 开头：H1 作标题 + 紧随其后的引用块作摘要，抽到 hero 区
let start = 0;
let h1 = TITLE_OVERRIDE;
if (blocks[0] && blocks[0].type === 'h' && blocks[0].level === 1) {
  if (!h1) h1 = blocks[0].text;
  start = 1;
}
let heroQuote = null;
if (blocks[start] && blocks[start].type === 'quote') { heroQuote = blocks[start].lines; start++; }
while (blocks[start] && blocks[start].type === 'hr') start++;

const toc = [];
let hIdx = 0;
const bodyHtml = blocks
  .slice(start)
  .map((b) => {
    switch (b.type) {
      case 'h': {
        const id = `h-${++hIdx}`;
        if (b.level === 2 || b.level === 3) {
          toc.push({ id, level: b.level, text: b.text.replace(/\*\*/g, '') });
        }
        return `<h${b.level} id="${id}"><a class="anchor" href="#${id}" aria-label="链接到本节">#</a>${inline(b.text)}</h${b.level}>`;
      }
      case 'hr':
        return '<hr>';
      case 'table':
        return renderTable(b.rows);
      case 'quote': {
        // 引用块内按空行分段；段内保留作者换行（本报告的引用行均为独立字段，如 **调研日期**：…）
        const paras = [];
        let cur = [];
        for (const l of b.lines) {
          if (!l.trim()) { if (cur.length) { paras.push(cur); cur = []; } }
          else cur.push(l.trim());
        }
        if (cur.length) paras.push(cur);
        return `<blockquote>${paras
          .map((p) => `<p>${p.map((l) => inline(l)).join('<br>')}</p>`)
          .join('')}</blockquote>`;
      }
      case 'ul':
        return `<ul>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`;
      case 'ol':
        return `<ol>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`;
      case 'p':
        return `<p>${inline(b.text)}</p>`;
      default:
        return '';
    }
  })
  .join('\n');

/* ------------------------------- 目录与统计 ------------------------------- */
const tocHtml = toc
  .map((t) => {
    if (t.level === 2) return `<a class="lv2" href="#${t.id}">${esc(t.text)}</a>`;
    return `<a class="lv3" href="#${t.id}">${esc(t.text)}</a>`;
  })
  .join('\n');

const nTable = blocks.filter((b) => b.type === 'table').length;
const nDoi = (md.match(/https:\/\/doi\.org\//g) || []).length;
const nArx = (md.match(/arxiv\.org\/abs\//g) || []).length;
const nStar2 = blocks.filter((b) => b.type === 'table').reduce((a, b) => {
  return a + b.rows.filter((r) => splitRow(r).join(' ').includes('★★')).length;
}, 0);
const nStar1 = blocks.filter((b) => b.type === 'table').reduce((a, b) => {
  return a + b.rows.filter((r) => { const j = splitRow(r).join(' '); return j.includes('★') && !j.includes('★★'); }).length;
}, 0);
const nH2 = toc.filter((t) => t.level === 2).length;
const nH3 = toc.filter((t) => t.level === 3).length;
const heroParas = heroQuote
  ? (() => {
      const ps = []; let cur = [];
      for (const l of heroQuote) {
        if (!l.trim()) { if (cur.length) { ps.push(cur); cur = []; } }
        else cur.push(l.trim());
      }
      if (cur.length) ps.push(cur);
      // 直接产出 HTML：每行一个字段，行内换行保留
      return ps.map((p) => p.map((l) => inline(l)).join('<br>'));
    })()
  : [];

const now = new Date().toISOString().slice(0, 10);
const safeTitle = h1 || '文献调研报告';

/* ---------------------------------- 输出 ---------------------------------- */
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(safeTitle)}</title>
<style>
:root{
  --ink:#182b36;--muted:#59717d;--bg:#f2f5f5;--line:#dce5e7;
  --blue:#16617e;--teal:#116c64;--paper:#fff;--mark:#ffe680;
  --s2:#eef7f4;--topH:58px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:calc(var(--topH) + 32px)}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Segoe UI","Microsoft YaHei","PingFang SC",system-ui,-apple-system,sans-serif;
  font-size:15.5px;line-height:1.85}
a{color:var(--blue);text-underline-offset:3px}
a:hover{color:var(--teal)}
code{background:#eef3f4;border:1px solid #dbe5e6;border-radius:4px;padding:.5px 5px;font-size:.86em;
  font-family:"Cascadia Mono",Consolas,"SF Mono",Menlo,monospace}

/* 顶部栏 */
.progress{position:fixed;top:0;left:0;height:3px;width:0;background:#2ea597;z-index:40}
.top{position:sticky;top:0;z-index:30;background:#fffffff5;border-bottom:1px solid var(--line);
  padding:10px 22px;display:flex;align-items:center;gap:14px;backdrop-filter:blur(12px);flex-wrap:wrap}
.brand{font-size:13.5px;font-weight:750;letter-spacing:.5px;white-space:nowrap}
.sbox{display:flex;align-items:center;gap:6px;flex:1;min-width:240px;max-width:620px}
.sbox input{width:100%;border:1px solid #bbcdd2;border-radius:8px;padding:8px 11px;background:#f8fbfb;
  color:var(--ink);font:inherit;font-size:13.5px;outline:none}
.sbox input:focus{border-color:#73bdb4;box-shadow:0 0 0 3px #73bdb433}
.hitinfo{font-size:12.5px;color:var(--muted);white-space:nowrap;min-width:86px}
button{border:1px solid #c5d6da;border-radius:7px;padding:7px 11px;background:#fff;color:var(--ink);
  font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
button:hover{background:#edf7f4}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #73bdb4;outline-offset:2px}

/* 布局 */
.layout{display:grid;grid-template-columns:288px minmax(0,1fr);max-width:1500px;margin:0 auto}
.sidebar{height:calc(100vh - var(--topH));position:sticky;top:var(--topH);overflow:auto;padding:22px 16px 60px 22px;
  font-size:13px;line-height:1.55;border-right:1px solid var(--line)}
.sidebar .overline{font-size:11px;color:var(--muted);letter-spacing:2px;margin-bottom:12px}
.sidebar a{text-decoration:none;display:block;border-radius:6px;padding:5px 8px;color:#355462}
.sidebar a:hover{background:#e6f1ef}
.sidebar a.lv2{font-weight:650;margin-top:7px;color:#1d4757;border-top:1px solid #e6ecec;padding-top:8px}
.sidebar a.lv3{padding-left:18px;font-size:12.5px;color:#4d6b76}
.sidebar a.active{background:#dcefeb;color:var(--teal);font-weight:700}
main{min-width:0;padding:26px 38px 100px}

/* Hero */
.hero{background:#153746;color:#f8fbfb;border-radius:16px;padding:30px 34px;margin-bottom:22px}
.hero .eyebrow{color:#92d3c9;letter-spacing:2px;font-size:11.5px;text-transform:uppercase}
.hero h1{font-size:clamp(23px,2.6vw,34px);line-height:1.35;margin:11px 0 14px;letter-spacing:-.5px}
.hero p{max-width:820px;color:#d4e5e8;font-size:14px;margin:6px 0}
.hero p strong{color:#fff}
.stats{display:flex;gap:26px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #3c6474}
.stat{color:#c3d8dd;font-size:12.5px}
.stat b{font-size:21px;margin-right:6px;font-weight:650;color:#fff}

/* 正文 */
main h2{font-size:22px;line-height:1.45;margin:42px 0 16px;padding:8px 0 10px;
  border-bottom:2px solid #bfd4d8;scroll-margin-top:calc(var(--topH) + 14px)}
main h3{font-size:17.5px;line-height:1.5;margin:30px 0 12px;color:#12505f;
  scroll-margin-top:calc(var(--topH) + 14px)}
main h4{font-size:15.5px;margin:22px 0 10px;color:#1d4757}
main h2 .anchor,main h3 .anchor{float:left;margin-left:-20px;padding-right:6px;color:#a9c6cc;
  text-decoration:none;font-weight:400;opacity:0;transition:opacity .15s}
main h2:hover .anchor,main h3:hover .anchor{opacity:1}
main p{margin:12px 0}
main ul,main ol{margin:12px 0;padding-left:24px}
main li{margin:6px 0}
main hr{border:0;border-top:1px solid var(--line);margin:34px 0}
blockquote{margin:16px 0;padding:10px 18px;background:#eef6f5;border-left:4px solid #73bdb4;
  border-radius:0 8px 8px 0;color:#26505c}
blockquote p{margin:5px 0;font-size:14.5px}

/* 表格 */
.tw{overflow-x:auto;margin:16px 0;border:1px solid var(--line);border-radius:10px;background:var(--paper)}
table{border-collapse:collapse;width:100%;font-size:13.4px;line-height:1.62}
th,td{border-bottom:1px solid #e8eef0;padding:8px 11px;text-align:left;vertical-align:top}
th{background:#eaf3f2;font-weight:700;color:#17414f;white-space:nowrap;position:relative}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:#f4fafa}
tr.s2 td{background:var(--s2)}
tr.s2:hover td{background:#e7f4f1}
tr.s2 td:first-child{box-shadow:inset 3px 0 0 #2ea597}
.st1{color:#0e7c72;font-weight:600;letter-spacing:.5px}
.st2{color:#b45309;font-weight:700;letter-spacing:.5px}
td a{word-break:break-all}

mark{background:var(--mark);color:inherit;padding:0 2px;border-radius:2px}
mark.cur{background:#ffab40;box-shadow:0 0 0 2px #ffab4066}

/* 返回顶部 */
.totop{position:fixed;right:22px;bottom:22px;z-index:25;border-radius:50%;width:44px;height:44px;
  padding:0;box-shadow:0 4px 14px #12313f2b;font-size:16px;display:none}
.totop.show{display:block}

@media (max-width:900px){
  .layout{grid-template-columns:1fr}
  .sidebar{display:none}
  main{padding:18px 16px 80px}
  .hero{padding:22px}
}
@media print{
  .top,.sidebar,.totop,.progress{display:none!important}
  .layout{display:block;max-width:none}
  main{padding:0}
  body{background:#fff;font-size:11.5pt}
  .hero{background:#fff;color:#000;border:1px solid #999}
  .hero p,.hero .eyebrow,.stat{color:#333}
  .tw{overflow:visible;border-color:#bbb}
  table{font-size:9.5pt}
  th{background:#eee}
  main h2{page-break-after:avoid}
  tr{page-break-inside:avoid}
}
</style>
</head>
<body>
<div class="progress" id="prog"></div>

<div class="top">
  <span class="brand">📚 ${esc(safeTitle)}</span>
  <div class="sbox">
    <input id="q" type="search" placeholder="全文搜索（标题 / 作者 / venue / DOI…），回车跳到下一处" autocomplete="off">
    <span class="hitinfo" id="hitinfo">—</span>
    <button id="prev" title="上一处 (Shift+Enter)">↑</button>
    <button id="next" title="下一处 (Enter)">↓</button>
    <button id="clear" title="清除搜索">✕</button>
  </div>
  <button id="print" title="打印 / 另存为 PDF">🖨 打印</button>
</div>

<div class="layout">
  <nav class="sidebar" id="toc">
    <div class="overline">目录 · CONTENTS</div>
    ${tocHtml}
  </nav>

  <main>
    <div class="hero">
      <div class="eyebrow">QUANTUM CONTROL · LITERATURE SURVEY</div>
      <h1>${inline(safeTitle)}</h1>
      ${heroParas.map((p) => `<p>${p}</p>`).join('\n      ')}
      <div class="stats">
        <div class="stat"><b>${nH2}</b>章 / <b>${nH3}</b>节</div>
        <div class="stat"><b>${nTable}</b>张表</div>
        <div class="stat"><b>${nDoi}</b>条 DOI 链接</div>
        <div class="stat"><b>${nArx}</b>条 arXiv 链接</div>
        <div class="stat"><b>${nStar2}</b>条 ★★ 对标 · <b>${nStar1}</b>条 ★ 相关</div>
      </div>
    </div>

${bodyHtml}
  </main>
</div>

<button class="totop" id="totop" title="返回顶部">↑</button>

<script>
(function(){
  var prog = document.getElementById('prog');
  var totop = document.getElementById('totop');
  var main = document.querySelector('main');
  var topbar = document.querySelector('.top');

  /* ---------- 顶栏实际高度 -> CSS 变量（供侧栏/锚点偏移使用） ---------- */
  function syncTopH(){
    document.documentElement.style.setProperty('--topH', topbar.offsetHeight + 'px');
  }
  syncTopH();
  window.addEventListener('resize', syncTopH);
  if (window.ResizeObserver) new ResizeObserver(syncTopH).observe(topbar);

  /* ---------- 阅读进度 + 返回顶部 ---------- */
  function onScroll(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    totop.classList.toggle('show', window.scrollY > 500);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll);
  onScroll();
  totop.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });

  /* ---------- 侧栏滚动联动 ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('#toc a'));
  var targets = links.map(function(a){ return document.getElementById(a.getAttribute('href').slice(1)); });
  var ticking = false;
  function spy(){
    var best = -1;
    for (var i = 0; i < targets.length; i++){
      if (targets[i] && targets[i].getBoundingClientRect().top <= 120) best = i;
    }
    links.forEach(function(a, i){ a.classList.toggle('active', i === best); });
    ticking = false;
  }
  window.addEventListener('scroll', function(){
    if (!ticking){ ticking = true; requestAnimationFrame(spy); }
  }, {passive:true});
  spy();

  /* ---------- 全文搜索：高亮 + 上下跳转 ---------- */
  var q = document.getElementById('q');
  var info = document.getElementById('hitinfo');
  var marks = [];
  var cur = -1;

  function clearMarks(){
    if (!marks.length) return;
    for (var i = 0; i < marks.length; i++){
      var m = marks[i], parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    }
    marks = [];
  }

  function hl(){
    clearMarks();
    cur = -1;
    var term = q.value.trim();
    applied = term;                     // 记录已应用的查询词
    if (term.length < 1){ info.textContent = '—'; return; }

    var needle = term.toLowerCase();
    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        if (!n.nodeValue || !n.nodeValue.toLowerCase().includes(needle)) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        while (p && p !== main){
          var tag = p.nodeName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (var k = 0; k < nodes.length; k++){
      var node = nodes[k], text = node.nodeValue, low = text.toLowerCase();
      var frag = document.createDocumentFragment();
      var pos = 0, idx;
      while ((idx = low.indexOf(needle, pos)) !== -1){
        if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
        var mk = document.createElement('mark');
        mk.className = 'hit';
        mk.textContent = text.slice(idx, idx + needle.length);
        frag.appendChild(mk);
        marks.push(mk);
        pos = idx + needle.length;
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    }

    info.textContent = marks.length ? '1 / ' + marks.length : '无匹配';
    if (marks.length){ setCur(0, false); }
  }

  function setCur(i, scroll){
    if (!marks.length) return;
    if (marks[cur]) marks[cur].classList.remove('cur');
    cur = (i + marks.length) % marks.length;
    var m = marks[cur];
    m.classList.add('cur');
    info.textContent = (cur + 1) + ' / ' + marks.length;
    if (scroll !== false){
      m.scrollIntoView({behavior:'smooth', block:'center'});
    }
  }

  var timer = null;
  var applied = null;   // 上次已高亮的查询词，避免防抖未触发时按回车跳到旧结果

  q.addEventListener('input', function(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      hl();
      if (marks.length) marks[0].scrollIntoView({behavior:'smooth', block:'center'});
    }, 220);
  });

  q.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (q.value.trim() !== applied){        // 防抖尚未触发：先按当前输入重算
      clearTimeout(timer);
      hl();
      if (marks.length) setCur(0);
      return;
    }
    if (!marks.length) return;
    setCur(cur + (e.shiftKey ? -1 : 1));
  });

  document.getElementById('next').addEventListener('click', function(){
    if (!marks.length) { hl(); if (marks.length) setCur(0); return; }
    setCur(cur + 1);
  });
  document.getElementById('prev').addEventListener('click', function(){
    if (!marks.length) { hl(); return; }
    setCur(cur - 1);
  });
  document.getElementById('clear').addEventListener('click', function(){
    q.value = ''; hl(); q.focus();
  });
  document.getElementById('print').addEventListener('click', function(){ window.print(); });

  /* 键盘快捷键：/ 聚焦搜索框，Esc 清空 */
  document.addEventListener('keydown', function(e){
    if (e.key === '/' && document.activeElement !== q){ e.preventDefault(); q.focus(); }
    if (e.key === 'Escape' && document.activeElement === q){ q.value = ''; hl(); q.blur(); }
  });
})();
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`✓ HTML 已生成: ${OUT} (${kb(Buffer.byteLength(html))})`);
console.log(`  章节 ${nH2} 章 / ${nH3} 节 ｜ 表格 ${nTable} 张 ｜ DOI ${nDoi} ｜ arXiv ${nArx} ｜ ★★ ${nStar2} / ★ ${nStar1}`);
