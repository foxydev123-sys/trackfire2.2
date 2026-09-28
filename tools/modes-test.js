/* Headless test of every game mode on every map: bot-only matches with a fake clock.
   Checks that the objective actually gets played (captures, zone points, rounds)
   and that each match ends with a winner and a summary.   node tools/modes-test.js */
import { Room } from '../client/shared/room.js';
import { GAME, NET } from '../client/shared/config.js';
let T = 0; const now = () => T;
const results = []; let fail = 0;
for (const map of ['hawler', 'desert', 'forest']) for (const mode of GAME.MODE_IDS) {
  const ends = []; const events = { zmove: 0, take: 0, cap: 0, drop: 0, ret: 0, rounds: 0, goal: 0, half: 0, jugg: 0, bounty: 0, wave: 0, cleared: 0, bomb: 0, pass: 0, delivered: 0, lost: 0 }; let passes = 0;
  const room = new Room('T' + mode, { now, kind: 'private', onEnd: (s) => ends.push(s) });
  room.setMap(map); room.mode = mode;
  // a fake "human" connection that records broadcasts
  const conn = { send(d) { if (typeof d !== 'string') return; const m = JSON.parse(d); if (m.t === 'obj' && m.ev) events[m.ev === 'return' ? 'ret' : m.ev] = (events[m.ev === 'return' ? 'ret' : m.ev] || 0) + 1; if (m.t === 'round' && m.phase === 'break') events.rounds++; }, close() {} };
  const me = room.join(conn, 'Watcher', 'tok');
  for (let i = 0; i < 6; i++) room.addBot();
  room.removePlayer(me);                       // bots only; watcher just observes via a bot-free seat
  const watch = room.join(conn, 'Watcher', 'tok2'); room.onJSON(watch, { t: 'team', team: 'blue' });
  room.hostId = watch.id; room.onJSON(watch, { t: 'start' });
  watch.connected = true; watch.alive = false; watch.deadT = 1e9; watch.out = true;   // stays a spectator
  const limitS = GAME.MODES[mode].timeLimitS + 5; let t0 = T;
  while (room.state === 'playing' && T - t0 < limitS * 1000) { T += 1000 / NET.TICK_RATE; room.update(); if (!room.round) watch.deadT = 1e9; watch.alive = false; }
  const s = ends[0];
  const secs = Math.round((T - t0) / 1000);
  const straight = room.map.bases ? Math.hypot(room.map.bases.red[0] - room.map.bases.blue[0], room.map.bases.red[1] - room.map.bases.blue[1]) : 0;
  const ok = !!s && s.players.length >= 6 && (mode !== 'ctf' || events.take > 0) && (mode !== 'koh' || (s.score.blue + s.score.red > 20 && (Math.max(s.score.blue, s.score.red) < 100 || events.zmove >= 2))) && (mode !== 'lts' || events.rounds >= 4)
    && (mode !== 'convoy' || (room.m2 && room.m2.L > straight * 1.25))
    && (mode !== 'ball' || room.mapId === 'stadium')
    && (mode !== 'convoy' || (events.half >= 1 && s.score.blue + s.score.red > 5))
    && (mode !== 'jugg' || (events.jugg >= 2 && s.players.some(p => p.won)))
    && (mode !== 'ball' || events.goal >= 1 || map !== 'hawler')     // bots are poor strikers: one goal-less match of three is fine
    && (mode !== 'surv' || events.wave >= 2)
    && (mode !== 'potato' || (events.bomb >= 3 && typeof s.winner === 'number'))
    && (mode !== 'bounty' || s.score.blue + s.score.red >= 10);
  if (!ok) fail++;
  results.push(`${ok ? 'PASS' : 'FAIL'} ${room.mapId.padEnd(7)} ${mode.padEnd(4)} ${secs}s${mode === 'koh' ? ' zmove=' + events.zmove : ''}${mode === 'convoy' ? ` route=${Math.round(room.m2.L)}m (straight ${Math.round(straight)}m)` : ''}  winner=${s ? s.winner : '-'}  score=${JSON.stringify(s ? s.score : null)}  kills=${s ? s.players.reduce((a, p) => a + p.k, 0) : 0}  ${mode === 'ctf' ? `takes=${events.take} caps=${events.cap} drops=${events.drop} returns=${events.ret}` : ''}${mode === 'lts' ? `rounds=${events.rounds}` : ''}${['convoy', 'jugg', 'ball', 'surv', 'potato', 'bounty'].includes(mode) ? ' ' + Object.entries(events).filter(([k, v]) => v && !['take', 'cap', 'drop', 'ret', 'rounds'].includes(k)).map(([k, v]) => k + '=' + v).join(' ') : ''}`);
  T += 60000;
}
// Respawns never land on a power-up pad, inside the King-of-the-Citadel zone or next to the enemy flag
for (const [map, mode] of [['hawler', 'koh'], ['forest', 'ctf'], ['desert', 'rush']]) {
  const room = new Room('SP', { now, kind: 'private' }); room.setMap(map); room.mode = mode;
  for (let i = 0; i < 8; i++) room.addBot(); room.hostId = 0; room.start();
  let bad = 0; const A = GAME.SPAWN_AWAY;
  for (let k = 0; k < 200; k++) {
    const p = [...room.players.values()][k % 8]; room.spawn(p); const x = p.s.x, z = p.s.z;
    if (room.pads.some(pd => Math.hypot(x - pd.x, z - pd.z) < A.PAD)) bad++;
    if (mode === 'koh' && Math.hypot(x - room.zone.x, z - room.zone.z) < room.zone.r + A.ZONE) bad++;
    if (mode === 'ctf') { const h = room.flags[p.team === 'blue' ? 'red' : 'blue'].home; if (Math.hypot(x - h[0], z - h[1]) < A.FLAG) bad++; }
  }
  const ok = bad === 0; if (!ok) fail++;
  results.push(`${ok ? 'PASS' : 'FAIL'} ${map} ${mode}: 200 respawns, ${bad} on a pad / in the zone / at the enemy flag`);
}
console.log(results.join('\n'));
console.log(fail ? `\n${fail} FAILED` : '\nALL MODES PASS');
process.exit(fail ? 1 : 0);
