// The hidden test button works only when TEST_CHEATS=1, and gives exactly what it says.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = 8611, DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'kt-cheat-'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const srv = spawn('node', ['server/index.js'], { env: { ...process.env, PORT, DATA_DIR: DATA, TEST_CHEATS: '1', REG_LIMIT: '100' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/info`)).ok) break; } catch (e) {} await sleep(100); }
const acc = await (await fetch(`http://127.0.0.1:${PORT}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Tester"}' })).json();
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/hub`); const inbox = []; let rid = 1;
ws.onmessage = (e) => inbox.push(JSON.parse(e.data)); await new Promise(r => ws.onopen = r);
ws.send(JSON.stringify({ t: 'auth', id: acc.id, secret: acc.secret }));
const wait = async (p) => { for (let i = 0; i < 200; i++) { const m = inbox.find(p); if (m) return m; await sleep(20); } return null; };
const hello = await wait(m => m.t === 'hello');
const op = async (o) => { const r = rid++; ws.send(JSON.stringify({ t: 'eco', rid: r, ...o })); return wait(m => m.rid === r); };
ok(hello.wallet.cheats === true, 'the client is told the test button is available');
const before = hello.wallet.gems;
const m = await op({ op: 'cheat' });
ok(m.t === 'ok' && m.state.gems === before + 10000, `+10,000 gems (${before} → ${m.t === 'ok' ? m.state.gems : '?'})`);
ok(m.t === 'ok' && m.state.parts >= 5000, 'and parts for upgrading');
ok(/TEST_CHEATS is ON/.test(log), 'the server log warns that test mode is on');
ws.close(); srv.kill(); fs.rmSync(DATA, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : '\nCHEAT BUTTON OK');
process.exit(fails ? 1 : 0);
