'use strict'
const http = require('node:http')
const { handleInternal } = require('./internal-api')

const PAGE = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Minecraft Vote Server</title>
<style>
:root{color-scheme:light;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
*{box-sizing:border-box}body{max-width:760px;margin:9vh auto;padding:0 22px;color:#101010;background:#fafafa}
header{border-bottom:3px solid #111;padding-bottom:24px}h1{font-size:clamp(2rem,6vw,3.5rem);line-height:1.05;margin:8px 0}
small{color:#666}h2{font-size:1.3rem}section{padding:28px 0;border-bottom:1px solid #bbb}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}.tile{border:2px solid #111;padding:16px}
.number{font-size:2rem;font-weight:800}.bar{height:14px;display:flex;background:#e0e0e0;margin-top:20px}
#yesbar{background:#111;width:0}#nobar{background:#888;width:0}
code{background:#eee;padding:3px 6px}@media(max-width:500px){.grid{grid-template-columns:1fr 1fr}.number{font-size:1.5rem}}
</style></head><body>
<header><small>MINECRAFT / GŁOSOWANIE</small><h1>Minecraft Vote Server</h1><p id="question">Ładowanie głosowania...</p></header>
<section><h2>Wyniki głosowania</h2><div class="grid">
<div class="tile"><small>TAK</small><div class="number" id="yes">0</div></div>
<div class="tile"><small>NIE</small><div class="number" id="no">0</div></div>
<div class="tile"><small>RAZEM</small><div class="number" id="total">0</div></div></div>
<div class="bar"><div id="yesbar"></div><div id="nobar"></div></div></section>
<section><h2>Podpisy apelu</h2><p>Zapisane lokalnie: <strong id="signatures">0</strong></p>
<p>Zsynchronizowane z WWW: <strong id="synced">0</strong></p><p>Oczekujące: <strong id="pending">0</strong></p></section>
<footer><p><small>API: <code>GET /api/results</code> | Odświeżanie co 10 sekund.</small></p><small id="status">Łączenie...</small></footer>
<script>
const set=(id,v)=>document.getElementById(id).textContent=v;
async function refresh(){
 try{
 const res=await fetch('/api/results',{cache:'no-store'});if(!res.ok)throw Error(res.status);
 const d=await res.json();set('question',d.ballot.question);set('yes',d.votes.yes);set('no',d.votes.no);
 set('total',d.votes.total);set('signatures',d.appeal.total);set('synced',d.appeal.synced);
 set('pending',d.appeal.pending);
 const a=d.votes.total?d.votes.yes/d.votes.total*100:0;
 document.getElementById('yesbar').style.width=a+'%';
 document.getElementById('nobar').style.width=(d.votes.total?100-a:0)+'%';
 set('status','Aktualizacja: '+new Date().toLocaleTimeString('pl-PL'));
 }catch(err){set('status','Błąd odczytu wyników: '+err.message)}
}
refresh();setInterval(refresh,10000);
</script></body></html>`

function createHttpServer(store, ballot, { host = '127.0.0.1', port = 3000, bridgeToken = '', onSigned = null } = {}) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname.startsWith('/internal/')) return void handleInternal(req, res, pathname, { token: bridgeToken, store, ballot, onSigned })
    if (req.method === 'GET' && pathname === '/api/results') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      return res.end(JSON.stringify(store.results(ballot)))
    }
    if (req.method === 'GET' && pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      return res.end(JSON.stringify({ ok: true, service: 'minecraft-vote-server' }))
    }
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'", 'x-content-type-options': 'nosniff' })
      return res.end(PAGE)
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })
  return {
    server,
    start: () => new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => { server.off('error', reject); resolve(server.address()) })
    }),
    close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  }
}
module.exports = { createHttpServer }
