// Standalone origin/authentication and actual SQLite persistence; no network/model.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { request as nodeRequest } from 'node:http';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createStandalone, passwordHash, checkStorage } from '../server/app.mjs';
import { SQLiteD1 } from '../server/sqlite-d1.mjs';
import { createWorker } from '../sites/worker.mjs';

const root = mkdtempSync(join(tmpdir(), 'paper4qi-server-test-'));
const path = join(root, 'library.sqlite');
const assets = {};
const add = (path, value) => { const bytes = Buffer.from(JSON.stringify(value)); assets[path] = { type: 'application/json', sha256: createHash('sha256').update(bytes).digest('hex'), body: gzipSync(bytes).toString('base64') }; };
const paper = { id: 'tqe:10.1234/test', source: 'tqe', source_id: '10.1234/test', doi: '10.1234/test', arxiv: null, year: 2026, title: 'Quantum compiler', authors: [], abstract: 'Quantum software', zh: '待补充', category: 'ARCH', tags: [], venue: 'TQE', pages: null, cited_by: null, front_matter: false };
add('/data/papers.json', { generated: '2026-11-14T00:00:00Z', papers: [paper] });
add('/data/workspace.json', { papers: [], articles: {}, analyses: {}, venues: [{id:'tqe',name:'TQE',kind:'journal',issn:'2689-1808',enabled:true,keywords:[]}] });
add('/data/id-redirects.json', { redirects: [] });
let db = new SQLiteD1(path, resolve('drizzle'));
const origin = 'https://api.example.test', frontend = 'https://xiaoshecode.github.io';
let instant = Date.now();
const env = { PAPER4QI_PUBLIC_ORIGIN: origin, PAPER4QI_FRONTEND_ORIGIN: frontend, PAPER4QI_OWNER_PASSWORD_HASH: passwordHash('synthetic-test-password') };
let app = createStandalone({worker:createWorker(assets),db,env,now:()=>instant});
const request = (route, {method='GET',body,token,spoof=false,requestOrigin=frontend}={}) => app.fetch(new Request(origin+route,{method,headers:{Origin:requestOrigin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(spoof?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
try {
  const content = {title:'Reviewed quantum compiler',zh:'审核说明',category:'ARCH',tags:[],body:'Public research'};
  const input = {id:paper.id,expected_revision:0,summary:'Reviewed',content};
  assert.equal((await request('/api/article',{method:'PUT',body:input,spoof:true})).status,403,'Incoming trusted-identity headers do not grant writes');
  const anonymousMcp=await app.fetch(new Request(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}));assert.equal(anonymousMcp.status,200,'Read-only MCP clients need no browser Origin');
  assert.equal((await request('/api/auth/login',{method:'POST',body:{password:'synthetic-test-password'},requestOrigin:'https://attacker.example'})).status,403);
  assert.equal((await request('/api/auth/login',{method:'POST',body:{password:'wrong'}})).status,401);
  const login = await request('/api/auth/login',{method:'POST',body:{password:'synthetic-test-password'}});
  assert.equal(login.status,200);assert.equal(login.headers.get('Access-Control-Allow-Origin'),frontend);
  assert.match(login.headers.get('Set-Cookie'),/HttpOnly/);assert.match(login.headers.get('Set-Cookie'),/Secure/);assert.match(login.headers.get('Set-Cookie'),/SameSite=Strict/);
  const signed = await login.json();assert.match(signed.token,/^[a-f0-9]{64}$/);
  assert(!JSON.stringify(db.database.prepare('SELECT * FROM standalone_sessions').all()).includes(signed.token),'Session token is only stored as a hash');
  const status = await (await request('/api/status',{token:signed.token})).json();assert.equal(status.can_edit,true);assert.equal(status.auth_mode,'password');assert(!('editor_id' in status));
  assert.equal((await request('/api/article',{method:'PUT',body:input,token:signed.token})).status,200);
  const publicArticle = await(await request('/api/article?id='+encodeURIComponent(paper.id))).json();assert.equal(publicArticle.article.history.length,1);assert.equal(publicArticle.article.body,'Public research');assert(!JSON.stringify(publicArticle).includes(signed.token));
  const stale = await request('/api/article',{method:'PUT',body:input,token:signed.token});assert.equal(stale.status,409);
  const createdChat=await(await request('/api/chats',{method:'POST',body:{title:'Standalone SSE smoke'},token:signed.token})).json();
  assert.equal(createdChat.chat.revision,0);
  assert.equal((await request('/api/auth/logout',{method:'POST',body:{},token:signed.token})).status,200);
  assert.equal((await request('/api/article',{method:'PUT',body:{...input,expected_revision:1},token:signed.token})).status,403);
  const next = await(await request('/api/auth/login',{method:'POST',body:{password:'synthetic-test-password'}})).json();
  db.close();db = new SQLiteD1(path,resolve('drizzle'));app=createStandalone({worker:createWorker(assets),db,env,now:()=>instant});
  assert.equal((await(await request('/api/auth/session',{token:next.token})).json()).authenticated,true,'Sessions survive a process restart');
  assert.equal((await(await request('/api/article?id='+encodeURIComponent(paper.id))).json()).article.revision,1,'Immutable Wiki history persists');
  instant+=86400001;
  assert.equal((await(await request('/api/auth/session',{token:next.token})).json()).authenticated,false);
  const preflight=await app.fetch(new Request(origin+'/api/chat',{method:'OPTIONS',headers:{Origin:frontend,'Access-Control-Request-Headers':'authorization,content-type','Access-Control-Request-Method':'POST'}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),frontend);
  const streaming = createStandalone({db,env,worker:{async fetch(request,_env,context){context.waitUntil(Promise.resolve());return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('event: text\ndata: {"delta":"公开研究"}\n\n'));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});}}});
  const sse=await streaming.fetch(new Request(origin+'/api/mock-stream',{method:'POST',headers:{Origin:frontend,'Content-Type':'application/json'},body:'{}'}),{waitUntil(){}});
  assert.equal(sse.headers.get('Content-Type'),'text/event-stream');assert.equal(sse.headers.get('Access-Control-Allow-Origin'),frontend);assert((await sse.text()).includes('公开研究'));
  const failingWorker = createStandalone({db,env,worker:{async fetch(){throw new Error('synthetic-private-driver-detail');}}});
  const readableFailure = await failingWorker.fetch(new Request(origin+'/api/papers',{headers:{Origin:frontend}}));
  assert.equal(readableFailure.status,503);assert.equal(readableFailure.headers.get('Access-Control-Allow-Origin'),frontend);
  assert.equal(readableFailure.headers.get('Cache-Control'),'no-store');assert(!(await readableFailure.text()).includes('synthetic-private-driver-detail'));
  const sessionFailure = createStandalone({env,db:{prepare(){throw new Error('synthetic-private-session-detail');}},worker:createWorker(assets)});
  const sessionError = await sessionFailure.fetch(new Request(origin+'/api/auth/session',{headers:{Origin:frontend,Authorization:'Bearer '+next.token}}));
  assert.equal(sessionError.status,503);assert.equal(sessionError.headers.get('Access-Control-Allow-Origin'),frontend);assert(!(await sessionError.text()).includes('synthetic-private-session-detail'));
  const deniedFailure = await failingWorker.fetch(new Request(origin+'/api/papers',{headers:{Origin:'https://attacker.example'}}));
  assert.equal(deniedFailure.status,403);assert.equal(deniedFailure.headers.get('Access-Control-Allow-Origin'),null,'Invalid origins never receive readable error credentials');
  for(let attempt=0;attempt<12;attempt++) {
    const blocked=await request('/api/auth/login',{method:'POST',body:{password:'wrong'}});
    if(attempt>=10) assert.equal(blocked.status,429,'Login attempts are bounded persistently');
  }
  console.log('PASS: real SQLite migrations/history and restart persistence, spoof rejection, exact CORS, scrypt login, hashed expiring/revoked sessions and cross-device revision conflicts.');
} finally {db.close();rmSync(root,{recursive:true,force:true});}

// Read-only storage gates: an absent database stays absent, a mismatched token
// stops before directory inspection, and no request can write to the cloud.
const storageRoot = mkdtempSync(join(tmpdir(), 'paper4qi-storage-test-'));
try {
  const storageDbPath = join(storageRoot, 'library.sqlite'), objectRoot = join(storageRoot, 'objects');
  const storageEnv = { PAPER4QI_DB_PATH: storageDbPath, PAPER4QI_LOCAL_STORAGE_ROOT: objectRoot };
  const missing = await checkStorage(storageEnv, {fetchImpl() { throw new Error('Network must not run with missing settings'); }});
  assert.equal(missing.ready, false); assert.equal(missing.migration_ready, false);
  assert(!existsSync(storageDbPath)); assert(!existsSync(objectRoot));
  assert(missing.blockers.includes('seafile_base_url_missing'));
  symlinkSync(resolve('server'),join(storageRoot,'linked-server'),'dir');
  const viaSymlink = spawnSync(process.execPath,[join(storageRoot,'linked-server','app.mjs'),'--storage-check'],{
    env:{...process.env,...storageEnv,SEAFILE_BASE_URL:'',SEAFILE_LIBRARY_ID:'',SEAFILE_REPO_TOKEN:''},encoding:'utf8'});
  assert.equal(viaSymlink.status,1,'A release symlink must execute the server entry point rather than silently exiting');
  assert.equal(JSON.parse(viaSymlink.stdout).mode,'read-only');assert(!existsSync(storageDbPath));
  const library = '12345678-1234-1234-1234-123456789abc', secret = 'synthetic-private-seafile-token';
  const cloudEnv = { ...storageEnv, SEAFILE_BASE_URL: 'https://cloud.example.invalid', SEAFILE_LIBRARY_ID: library, SEAFILE_REPO_TOKEN: secret };
  const calls = [];
  async function cloud(url, options) {
    calls.push(url); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer ' + secret);
    return new Response(JSON.stringify(url.includes('/repo-info/') ? {repo_id: library, encrypted: false} : {dirent_list: []}));
  }
  const empty = await checkStorage(cloudEnv, {fetchImpl:cloud});
  assert.equal(empty.ready, true); assert.equal(empty.migration_ready, false);
  assert(!JSON.stringify(empty).includes(secret)); assert(!existsSync(storageDbPath));
  assert(calls.at(-1).includes('path=%2Fpaper4qi'));
  let attempts = 0;
  const mismatch = await checkStorage(cloudEnv, {fetchImpl:async()=>{attempts++; return new Response(JSON.stringify({repo_id:'wrong-library'}));}});
  assert.equal(attempts,1); assert.equal(mismatch.ready,false); assert.equal(mismatch.seafile.directory_verified,false);
  assert.equal((await checkStorage({...cloudEnv,SEAFILE_BASE_URL:'http://cloud.example.invalid'},{fetchImpl:cloud})).ready,false);
  assert.equal((await checkStorage({...cloudEnv,SEAFILE_DIRECTORY:'/teaching'},{fetchImpl:cloud})).ready,false);
  const storageDb = new SQLiteD1(storageDbPath,resolve('drizzle'));storageDb.close();
  mkdirSync(objectRoot);writeFileSync(join(objectRoot,'synthetic.pdf'),Buffer.from('synthetic attachment bytes'));
  const inventoried = await checkStorage(cloudEnv,{fetchImpl:cloud});
  assert.equal(inventoried.database.integrity,true);assert.equal(inventoried.database.foreign_keys,true);
  assert.equal(inventoried.local_objects.count,1);assert.equal(inventoried.local_objects.hashes_calculated,1);
  assert.equal(inventoried.ready,false);assert(inventoried.blockers.includes('local_objects_require_catalog_and_backup'));
  assert(!JSON.stringify(inventoried).includes('synthetic.pdf'));
  symlinkSync(storageDbPath,join(objectRoot,'hidden-database'));
  const symlink = await checkStorage(cloudEnv,{fetchImpl:cloud});assert.equal(symlink.ready,false);assert(symlink.blockers.includes('local_storage_inspection_failed'));
  const mixed = await checkStorage({...cloudEnv,PAPER4QI_LOCAL_STORAGE_ROOT:storageRoot},{fetchImpl:cloud});
  assert(mixed.blockers.includes('sqlite_inside_object_storage'));
  const existingCloud = await checkStorage(cloudEnv,{fetchImpl:async(url)=>new Response(JSON.stringify(url.includes('/repo-info/')?{repo_id:library}:{dirent_list:[{name:'private-name.pdf',type:'file',size:18}]}))});
  assert.equal(existingCloud.seafile.direct_file_count,1);assert.equal(existingCloud.seafile.direct_file_bytes,18);
  assert(!JSON.stringify(existingCloud).includes('private-name'));assert(existingCloud.blockers.includes('seafile_existing_objects_require_reconciliation'));
  console.log('PASS: read-only disk/SQLite/object hash inspection, exact Seafile library and directory checks, GET-only/no redirects, no secret/name output, and migration blockers.');
} finally {rmSync(storageRoot,{recursive:true,force:true});}

// Real TCP bridge: Caddy supplies the configured Host after stripping its path
// prefix. An in-process Response test alone cannot validate these HTTP details.
if (process.argv.includes('--http')) {
  const bridgeRoot = mkdtempSync(join(tmpdir(), 'paper4qi-http-test-'));
  const bridgeDb = new SQLiteD1(join(bridgeRoot, 'library.sqlite'), resolve('drizzle'));
  const bridge = createStandalone({db:bridgeDb,env,worker:{async fetch(request, runtime, context) {
    if (new URL(request.url).pathname === '/api/mock-stream') {
      context.waitUntil(Promise.resolve());
      return new Response(new ReadableStream({start(controller) {
        controller.enqueue(new TextEncoder().encode('event: text\ndata: {"delta":"真实 HTTP 测试"}\n\n'));
        controller.close();
      }}), {headers:{'Content-Type':'text/event-stream; charset=utf-8'}});
    }
    return createWorker(assets).fetch(request,runtime,context);
  }}});
  await new Promise((resolveListen,reject) => {bridge.server.once('error',reject);bridge.server.listen(0,'127.0.0.1',resolveListen);});
  const port=bridge.server.address().port;
  const http = (path, {method='GET',body,headers={}}={}) => new Promise((resolveResponse,reject) => {
    const encoded=body === undefined ? null : Buffer.from(JSON.stringify(body));
    const outgoing=nodeRequest({hostname:'127.0.0.1',port,path,method,headers:{Host:new URL(origin).host,Origin:frontend,...(encoded?{'Content-Type':'application/json','Content-Length':encoded.length}:{}),...headers}}, incoming => {
      const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.once('error',reject);
      incoming.once('end',()=>resolveResponse({status:incoming.statusCode,headers:incoming.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    outgoing.once('error',reject);outgoing.end(encoded);
  });
  try {
    const anonymous=await http('/api/status');assert.equal(anonymous.status,200);assert.equal(JSON.parse(anonymous.body).can_edit,false);assert.equal(anonymous.headers['access-control-allow-origin'],frontend);
    const login=await http('/api/auth/login',{method:'POST',body:{password:'synthetic-test-password'}});assert.equal(login.status,200);
    const token=JSON.parse(login.body).token;
    const signed=await http('/api/status',{headers:{Authorization:'Bearer '+token}});assert.equal(JSON.parse(signed.body).can_edit,true);
    const spoofed=await http('/api/article',{method:'PUT',body:{id:paper.id,expected_revision:0,summary:'Review',content:{title:paper.title,zh:'说明',category:'ARCH',tags:[],body:'Body'}},headers:{'oai-authenticated-user-id':'owner'}});assert.equal(spoofed.status,403);
    const stream=await http('/api/mock-stream',{method:'POST',body:{}});assert.equal(stream.status,200);assert.match(stream.headers['content-type'],/text\/event-stream/);assert(stream.body.includes('真实 HTTP 测试'));
    const invalidHost=await http('/api/status',{headers:{Host:'attacker.example'}});assert.equal(invalidHost.status,403);
    console.log('PASS: real loopback HTTP bridge preserves exact CORS, Host validation, login identity, spoof rejection and UTF-8 SSE.');
  } finally {await bridge.close();bridgeDb.close();rmSync(bridgeRoot,{recursive:true,force:true});}
}
