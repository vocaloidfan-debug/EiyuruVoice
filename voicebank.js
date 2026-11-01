// EiyuruVoice: zip okuyucu, oto.ini ve UST/USTX ayrıştırıcıları
window.EV = (() => {
const td = (b, enc) => new TextDecoder(enc).decode(b);
function decode(b) {
  try { return new TextDecoder('utf-8', {fatal: true}).decode(b).replace(/^\uFEFF/, ''); }
  catch (e) { return td(b, 'shift_jis'); }
}
async function inflate(raw) {
  const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function readZip(ab) {
  const v = new DataView(ab), u = new Uint8Array(ab), out = [];
  let e = u.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('geçerli bir zip değil');
  let n = v.getUint16(e + 10, true), p = v.getUint32(e + 16, true);
  while (n-- > 0 && v.getUint32(p, true) === 0x02014b50) {
    const flag = v.getUint16(p + 8, true), meth = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const nb = u.subarray(p + 46, p + 46 + nl);
    const name = (flag & 0x800 ? td(nb, 'utf-8') : decode(nb)).replace(/\\/g, '/');
    p += 46 + nl + el + cl;
    if (name.endsWith('/')) continue;
    out.push({name, get: async () => {
      const s = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), d = u.subarray(s, s + cs);
      return meth === 0 ? d : inflate(d);
    }});
  }
  return out;
}
// Ses bankası: alias -> {buf, off, con, end, pre} (saniye)
async function loadBank(ab, dec) {
  const files = readZip(ab), byPath = new Map(), bank = new Map();
  files.forEach(f => byPath.set(f.name.toLowerCase(), f));
  const base = n => n.replace(/\.[^.]+$/, '');
  for (const f of files.filter(f => /(^|\/)oto\.ini$/i.test(f.name))) {
    const dir = f.name.slice(0, f.name.length - 7);
    decode(await f.get()).split(/\r?\n/).forEach(l => {
      const m = l.match(/^([^=]+)=(.*)$/); if (!m) return;
      const c = m[2].split(','), file = m[1].trim(), path = (dir + file).toLowerCase();
      const alias = (c[0] || base(file)).trim().toLowerCase();
      if (!byPath.has(path) || bank.has(alias)) return;
      bank.set(alias, {path, off: +c[1] / 1000 || 0, con: +c[2] / 1000 || 0, cut: +c[3] || 0, pre: +c[4] / 1000 || 0});
    });
  }
  if (!bank.size) files.filter(f => /\.wav$/i.test(f.name)).forEach(f =>
    bank.set(base(f.name.split('/').pop()).toLowerCase(), {path: f.name.toLowerCase(), off: 0, con: 0, cut: 0, pre: 0}));
  const bufs = new Map();
  for (const path of new Set([...bank.values()].map(e => e.path))) {
    try { bufs.set(path, await dec((await byPath.get(path).get()).slice().buffer)); } catch (e) {}
  }
  for (const [a, e] of bank) {
    const b = bufs.get(e.path); if (!b) { bank.delete(a); continue; }
    e.buf = b;
    e.end = e.cut < 0 ? Math.min(b.duration, e.off - e.cut / 1000) : e.cut > 0 ? Math.max(e.off + .05, b.duration - e.cut / 1000) : b.duration;
  }
  return bank;
}
const track1 = () => [{name: 'Track 1', mute: false}];
const r1 = x => Math.round(x * 10) / 10;
const flat = a => a.every(p => !p[1]);
// Noktalar arasını yumuşatır (io = kosinüs, l = doğrusal)
function dens(pts, shp) {
  const out = [];
  pts.forEach((p, i) => {
    out.push(p); const q = pts[i + 1];
    if (q && shp[i] !== 'l') for (let k = 1; k < 6; k++) {
      const u = k / 6, e = (1 - Math.cos(Math.PI * u)) / 2;
      out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * e]);
    }
  });
  return out;
}
// UST pitch (PBS/PBW/PBY/PBM) -> [[nota süresine oran, yarım ton]]
function ustPitch(c, len, bpm) {
  if (!c.pbw) return;
  const ps = (c.pbs || '0').split(';'), x0 = parseFloat(ps[0]) || 0, y0 = parseFloat(ps[1]) || 0;
  const w = c.pbw.split(',').map(Number), y = (c.pby || '').split(',').map(v => parseFloat(v) || 0), m = (c.pbm || '').split(',');
  const pts = [[x0, y0]]; let x = x0;
  w.forEach((d, i) => { x += d || 0; pts.push([x, y[i] || 0]); });
  if (flat(pts)) return;
  const sh = pts.map((_, i) => (m[i] || '') === '' || m[i] === 's' ? 'io' : 'l'), dm = len / 480 * 60000 / bpm;
  return dens(pts, sh).map(([a, b]) => [a / dm, b / 10]).sort((a, b) => a[0] - b[0]);
}
function parseUST(t) {
  let bpm = 120, name = '', cur = null, tick = 0, sect = ''; const notes = [];
  const flush = () => {
    if (!cur) return; const len = cur.len || 480;
    if (!/^r$/i.test(cur.lyric || '')) {
      const n = {start: tick / 480, dur: len / 480, pitch: cur.num || 60, lyric: cur.lyric || 'a', tr: 0};
      const pb = ustPitch(cur, len, bpm); if (pb) n.pb = pb;
      if (cur.vbr) { const v = cur.vbr.split(',').map(Number); if (v[0] > 0 && v[2] > 0) n.vib = {len: v[0], per: v[1] || 175, dep: v[2], in: v[3] || 0, out: v[4] || 0}; }
      notes.push(n);
    }
    tick += len; cur = null;
  };
  for (const raw of t.split(/\r?\n/)) {
    const l = raw.trim(); let m;
    if ((m = l.match(/^\[#(\w+)\]/))) { flush(); sect = m[1]; if (/^\d+$/.test(sect)) cur = {}; continue; }
    if (!(m = l.match(/^(\w+)=(.*)$/))) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (sect === 'SETTING') { if (k === 'tempo') bpm = parseFloat(v) || 120; if (k === 'projectname') name = v; }
    else if (cur) { if (k === 'length') cur.len = +v; else if (k === 'lyric') cur.lyric = v; else if (k === 'notenum') cur.num = +v; else if (['pbs', 'pbw', 'pby', 'pbm', 'vbr'].includes(k)) cur[k] = v; }
  }
  flush();
  return {name: name || 'UST', bpm: Math.round(bpm), tracks: track1(), notes};
}
function parseUSTX(t) {
  let name = '', bpm = 0, trk = 0, pp = 0, n = null, sub = ''; const notes = [], tn = [];
  const unq = s => s.trim().replace(/^['"]|['"]$/g, '');
  const push = () => {
    if (n && n.tone !== undefined) notes.push({start: (pp + n.position) / 480, dur: n.duration / 480, pitch: n.tone, lyric: n.lyric || 'a', tr: trk, _p: n.p, _v: n.v});
    n = null; sub = '';
  };
  for (const raw of t.split(/\r?\n/)) {
    let m;
    if ((m = raw.match(/^name:\s*(.*)$/))) name = unq(m[1]);
    else if (!bpm && (m = raw.match(/^\s*-?\s*bpm:\s*([\d.]+)/))) bpm = parseFloat(m[1]);
    else if ((m = raw.match(/^\s*track_name:\s*(.*)$/))) tn.push(unq(m[1]));
    else if (/^- duration:/.test(raw)) push();
    else if ((m = raw.match(/^\s{2}track_no:\s*(\d+)/))) { push(); trk = +m[1]; }
    else if ((m = raw.match(/^\s{2}position:\s*(\d+)/))) pp = +m[1];
    else if ((m = raw.match(/^\s*-\s*position:\s*(\d+)/))) { push(); n = {position: +m[1], p: [], v: null}; }
    else if (n && /^\s+pitch:\s*$/.test(raw)) sub = 'p';
    else if (n && /^\s+vibrato:\s*$/.test(raw)) { sub = 'v'; n.v = {}; }
    else if (n && sub === 'p' && (m = raw.match(/^\s*-\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)(?:,\s*shape:\s*(\w+))?/))) n.p.push([+m[1], +m[2], m[3] || 'io']);
    else if (n && sub === 'v' && (m = raw.match(/^\s{6,}(length|period|depth|in|out):\s*(-?[\d.]+)/))) n.v[m[1]] = +m[2];
    else if (n && (m = raw.match(/^\s{4,}(duration|tone|lyric):\s*(.*)$/))) { sub = ''; n[m[1]] = m[1] === 'lyric' ? unq(m[2]) : +m[2]; }
  }
  push();
  bpm = bpm || 120; const last = {};
  notes.forEach(o => {
    const dm = o.dur * 60 / bpm * 1000;
    if (o._p && o._p.length && !flat(o._p)) o.pb = dens(o._p.map(p => [p[0], p[1]]), o._p.map(p => p[2] === 'l' ? 'l' : 'io')).map(([a, b]) => [a / dm, b / 10]).sort((a, b) => a[0] - b[0]);
    const v = o._v; if (v && v.length > 0 && v.depth > 0) o.vib = {len: v.length, per: v.period || 175, dep: v.depth, in: v.in || 0, out: v.out || 0};
    if (/^\+/.test(o.lyric)) o.lyric = last[o.tr] || 'a'; else last[o.tr] = o.lyric;
    delete o._p; delete o._v;
  });
  const cnt = Math.max(tn.length, ...notes.map(x => x.tr + 1), 1);
  return {name: name || 'USTX', bpm: Math.round(bpm),
    tracks: Array.from({length: cnt}, (_, i) => ({name: tn[i] || 'Track ' + (i + 1), mute: false})), notes};
}
// UST dışa aktarma: tek track (UST çok track desteklemez). Boşluklar R notasıdır.
function toUST(p, tr) {
  const sb = 60000 / p.bpm, i0 = {i: 0};
  const L = ['[#VERSION]', 'UST Version1.2', 'Charset=UTF-8', '[#SETTING]', 'Tempo=' + p.bpm + '.00', 'Tracks=1', 'ProjectName=' + p.name, 'VoiceDir=', 'OutFile=', 'CacheDir=', 'Tool1=wavtool.exe', 'Tool2=resampler.exe', 'Mode2=True'];
  const add = o => L.push('[#' + String(i0.i++).padStart(4, '0') + ']', ...o);
  const ns = p.notes.filter(n => (n.tr || 0) === tr).sort((a, b) => a.start - b.start);
  let cur = 0;
  ns.forEach((n, k) => {
    const st = Math.round(n.start * 480), nx = ns[k + 1] ? Math.round(ns[k + 1].start * 480) : Infinity;
    if (st > cur) add(['Length=' + (st - cur), 'Lyric=R', 'NoteNum=60', 'PreUtterance=']);
    const len = Math.max(1, Math.min(Math.round(n.dur * 480), nx - st)), o = ['Length=' + len, 'Lyric=' + n.lyric, 'NoteNum=' + n.pitch, 'PreUtterance=', 'Intensity=100', 'Modulation=0'];
    const pts = (n.pb || []).map(([t, s]) => [t * n.dur * sb, s]);
    if (pts.length) {
      const w = [], y = [];
      for (let j = 1; j < pts.length; j++) { w.push(r1(pts[j][0] - pts[j - 1][0])); y.push(r1(pts[j][1] * 10)); }
      o.push('PBS=' + r1(pts[0][0]) + ';' + r1(pts[0][1] * 10), 'PBW=' + w.join(','), 'PBY=' + y.join(','), 'PBM=' + ','.repeat(Math.max(0, w.length - 1)));
    }
    if (n.vib) o.push('VBR=' + [n.vib.len, n.vib.per, n.vib.dep, n.vib.in, n.vib.out, 0, 0, 0].join(','));
    add(o); cur = st + len;
  });
  L.push('[#TRACKEND]'); return L.join('\r\n') + '\r\n';
}
function toUSTX(p) {
  const q = s => JSON.stringify(String(s)), sb = 60000 / p.bpm;
  const L = ['name: ' + q(p.name), "comment: ''", 'output_dir: Vocal', 'cache_dir: UCache', 'ustx_version: 0.6', 'resolution: 480', 'bpm: ' + p.bpm, 'beat_per_bar: 4', 'beat_unit: 4', 'key: 0', 'tracks:'];
  p.tracks.forEach(t => L.push("- singer: ''", '  phonemizer: OpenUtau.Core.DefaultPhonemizer', '  renderer_settings:', '    renderer: CLASSIC', '  track_name: ' + q(t.name), '  track_color: Blue', '  mute: ' + !!t.mute, '  solo: false', '  volume: 0', '  pan: 0', '  voice_color_names: []'));
  L.push('voice_parts:');
  p.tracks.forEach((t, i) => {
    const ns = p.notes.filter(n => (n.tr || 0) === i).sort((a, b) => a.start - b.start); if (!ns.length) return;
    L.push('- duration: ' + Math.max(...ns.map(n => Math.round((n.start + n.dur) * 480))), '  name: ' + q(t.name), "  comment: ''", '  track_no: ' + i, '  position: 0', '  notes:');
    ns.forEach(n => {
      const dm = n.dur * sb, v = n.vib;
      L.push('  - position: ' + Math.round(n.start * 480), '    duration: ' + Math.max(1, Math.round(n.dur * 480)), '    tone: ' + n.pitch, '    lyric: ' + q(n.lyric), '    pitch:', '      data:');
      (n.pb && n.pb.length ? n.pb.map(([u, s]) => [u * dm, s * 10]) : [[-25, 0], [25, 0]]).forEach(([x, y]) => L.push('      - {x: ' + r1(x) + ', y: ' + r1(y) + ', shape: io}'));
      L.push('      snap_first: false', '    vibrato:', '      length: ' + (v ? v.len : 0), '      period: ' + (v ? v.per : 175), '      depth: ' + (v ? v.dep : 25), '      in: ' + (v ? v.in : 10), '      out: ' + (v ? v.out : 10), '      shift: 0', '      drift: 0', '      vol_link: 0', '    phoneme_expressions: []', '    phoneme_overrides: []');
    });
  });
  L.push('wave_parts: []'); return L.join('\n') + '\n';
}
return {decode, readZip, loadBank, parseUST, parseUSTX, toUST, toUSTX};
})();
