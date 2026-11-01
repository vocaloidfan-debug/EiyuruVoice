(() => {
'use strict';
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d'), roll = $('roll');
const KEYW = 56, RULER = 32, ROWH = 35, MIN = 12, MAX = 108;
const PINK = '#ff3d8b';
let bpm = 120, beatW = 120, snapDiv = 8, snapOn = true, tool = 'select';
let notes = [], sel = null, drag = null, lastTap = {n: null, t: 0}, lastLyric = 'a';
let sx = 0, sy = (MAX - 77) * ROWH, pos = 0, W = 0, H = 0;
let undoS = [], redoS = [];
const setT = (id, s) => { const e = $(id); e.dataset.k = s; e.textContent = T(s); };
const COL = ['#ff3d8b', '#2fa4e7', '#d99500', '#1fb386', '#a855f7'];
let tracks = [{name: 'Track 1', mute: false}], cur = 0, projName = T('Adsız proje'), vb = null, baseNote = 60;
let ac, master, inst = null, playing = false, srcs = [], t0 = 0, startBeat = 0, endBeat = 0;

// ---------- Yardımcılar ----------
const step = () => 4 / snapDiv;
const bx = b => KEYW + b * beatW - sx;
const beatAt = x => (x - KEYW + sx) / beatW;
const py = p => (MAX - p) * ROWH - sy + RULER;
const pitchAt = y => Math.max(MIN, Math.min(MAX, MAX - Math.floor((y - RULER + sy) / ROWH)));
const q = (v, fl) => snapOn ? (fl ? Math.floor(v / step() + 1e-6) : Math.round(v / step())) * step() : v;
const isBlack = p => [1, 3, 6, 8, 10].includes(p % 12);
const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const pname = p => NAMES[p % 12] + (Math.floor(p / 12) - 1);
const fmt = s => Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');
const clampView = () => {
  sx = Math.max(0, sx);
  sy = Math.max(0, Math.min((MAX - MIN + 1) * ROWH - (H - RULER), sy));
};
function toast(msg) {
  const t = $('toast'); t.textContent = T(msg); t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, 2400);
}
function save() {
  try { localStorage.setItem('webvocal', JSON.stringify(proj())); } catch (e) {}
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem('webvocal'));
    if (d && Array.isArray(d.notes)) { applyProj(d); return; }
  } catch (e) {}
  const mk = (start, dur, lyric) => ({start, dur, pitch: 60, lyric});
  notes = [mk(0, .5, 'e'), mk(.5, .5, 'ri'), mk(1.5, .5, 'be'), mk(2, .5, 'a'), mk(2.5, .5, 'a'), mk(3, .5, 'a'), mk(3.5, .5, 'a')];
}

// ---------- Geri al / yinele ----------
const pushUndo = () => { undoS.push(snap()); if (undoS.length > 100) undoS.shift(); redoS = []; };
function undo() { if (!undoS.length) return; redoS.push(snap()); restore(undoS.pop()); }
function redo() { if (!redoS.length) return; undoS.push(snap()); restore(redoS.pop()); }

// ---------- Ses sentezi (formant tabanlı) ----------
const F = {a: [850, 1220, 2810], e: [610, 2330, 2990], 'ı': [430, 1500, 2700], i: [310, 2790, 3310],
           o: [500, 950, 2700], 'ö': [450, 1750, 2500], u: [370, 950, 2670], 'ü': [320, 1800, 2400]};
const vowel = l => { const m = PH.toRomaji(l).toLowerCase().match(/[aeıioöuü](?=[^aeıioöuü]*$)/); return m ? m[0] : 'a'; };
function ensureAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    master = ac.createGain(); master.gain.value = 1.6;
    master.connect(comp); comp.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}
function voice(n, when, dur) {
  const sm = vbFind(n.lyric); if (sm) return sampleVoice(sm, n, when, dur);
  const f = 440 * 2 ** ((n.pitch - 69) / 12), fm = F[vowel(n.lyric)], nodes = [];
  // Kadın (mezzo-soprano) sesi: yumuşak glottal kaynak, hafif nefes, parlak ton
  const re = new Float32Array(48), im = new Float32Array(48);
  for (let h = 1; h < 48; h++) im[h] = 1 / h ** 1.6;
  const o = ac.createOscillator(); o.setPeriodicWave(ac.createPeriodicWave(re, im)); o.frequency.value = f;
  bend(o.frequency, f, n.vib || dur < .45 ? n : {...n, vib: {len: 70, per: 175, dep: 22, in: 45, out: 10}}, when, dur);
  if (!ac._nb) { const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; ac._nb = nb; }
  const nz = ac.createBufferSource(), ng = ac.createGain(); nz.buffer = ac._nb; nz.loop = true; ng.gain.value = .15; nz.connect(ng);
  const env = ac.createGain(), end = when + dur;
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(.9, when + .03);
  env.gain.setValueAtTime(.9, Math.max(when + .035, end - .06));
  env.gain.linearRampToValueAtTime(0, end + .05);
  fm.forEach((fr0, i) => {
    const fr = (i === 0 ? Math.max(fr0, Math.min(f * 1.1, 1000)) : fr0) * 1.04;
    const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = [5, 7, 9][i];
    b.frequency.setValueAtTime(fr * (i ? .85 : .6), when);
    b.frequency.linearRampToValueAtTime(fr, when + .07);
    const gn = ac.createGain(); gn.gain.value = [1.8, 1.1, .55][i];
    o.connect(b); ng.connect(b); b.connect(gn); gn.connect(env);
  });
  const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3000; pk.Q.value = 1.2; pk.gain.value = 4;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = .5;
  env.connect(pk); pk.connect(lp); lp.connect(master);
  [o, nz].forEach(x => { x.start(when); x.stop(end + .15); nodes.push(x); });
  return nodes;
}
const snap = () => JSON.stringify({notes, tracks, bpm});
function restore(s) {
  const d = JSON.parse(s); notes = d.notes; tracks = d.tracks; bpm = d.bpm;
  cur = Math.min(cur, tracks.length - 1); sel = null; refreshUI(); save();
}
const proj = () => ({app: 'EiyuruVoice', v: 1, name: projName, bpm, tracks, notes});
function applyProj(d, keep) {
  notes = (d.notes || []).map(n => ({...n, tr: n.tr || 0}));
  tracks = d.tracks && d.tracks.length ? d.tracks : [{name: 'Track 1', mute: false}];
  const mt = Math.max(0, ...notes.map(n => n.tr));
  while (tracks.length <= mt) tracks.push({name: 'Track ' + (tracks.length + 1), mute: false});
  bpm = d.bpm || 120; projName = d.name || T('Adsız proje'); cur = 0; sel = null; pos = 0;
  if (!keep) { undoS = []; redoS = []; }
  refreshUI(); save();
}
function refreshUI() {
  $('bpmBtn').textContent = '♩' + bpm; $('pname').value = projName;
  $('time').textContent = fmt(pos * 60 / bpm); renderTracks(); draw();
}
function renderTracks() {
  const el = $('trkList'); el.innerHTML = '';
  tracks.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'trk' + (i === cur ? ' on' : '') + (t.mute ? ' mute' : '');
    b.style.setProperty('--c', COL[i % COL.length]); b.textContent = t.name;
    b.onclick = () => {
      if (i === cur) { const v = prompt('Track adı:', t.name); if (v && v.trim()) { t.name = v.trim(); save(); } }
      else { cur = i; sel = null; }
      renderTracks(); draw();
    };
    el.append(b);
  });
}
function bend(p, base, n, when, dur) {
  const sf = DSP.semiFn(n, dur); if (!sf) return;
  const N = Math.max(2, Math.ceil(dur / .008) + 1), arr = new Float32Array(N);
  for (let i = 0; i < N; i++) arr[i] = base * 2 ** (sf(dur * i / (N - 1)) / 12);
  p.setValueCurveAtTime(arr, when, dur);
}
function bendAt(n, x, y) {
  if (!drag.pushed) { pushUndo(); drag.pushed = true; }
  const t = Math.max(0, Math.min(1, (beatAt(x) - n.start) / n.dur));
  const s = Math.max(-12, Math.min(12, Math.round((py(n.pitch) + ROWH / 2 - y) / ROWH * 10) / 10));
  n.pb = (n.pb || []).filter(p => Math.abs(p[0] - t) > .03); n.pb.push([t, s]);
  n.pb.sort((a, b) => a[0] - b[0]); draw();
}
function drawPb(n, x, y, w) {
  if (!n.pb || !n.pb.length) return;
  g.beginPath();
  n.pb.forEach(([t, s], i) => { const X = x + t * w, Y = y + ROWH / 2 - s * ROWH; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
}
function drawVib(n, x, y, w) {
  const v = n.vib; if (!v || !(v.len > 0 && v.dep > 0 && v.per > 0)) return;
  const L = w * v.len / 100, a = Math.min(ROWH / 2 - 2, v.dep / 100 * ROWH), per = v.per / 1000 * bpm / 60 * beatW;
  g.beginPath();
  for (let X = 0; X <= L; X += 3) { const Y = y + ROWH / 2 - Math.sin(2 * Math.PI * X / per) * a; X ? g.lineTo(x + w - L + X, Y) : g.moveTo(x + w - L, Y); }
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; g.stroke();
}
const vbFind = l => { if (!vb) return; const k = l.toLowerCase(); return vb.get(k) || vb.get(l) || vb.get(PH.toKana(k)) || vb.get(PH.toRomaji(l)) || vb.get(PH.toKana(k, true)); };
function sampleVoice(s, n, when, dur) {
  const A = DSP.pitchInfo(s); if (!A) return resampled(s, n, when, dur);
  const y = DSP.psola(s, n, dur, A), buf = ac.createBuffer(1, y.length, s.buf.sampleRate);
  buf.getChannelData(0).set(y);
  const src = ac.createBufferSource(), env = ac.createGain(), end = when + dur, t0b = when - s.pre, st = Math.max(ac.currentTime, t0b);
  src.buffer = buf; env.gain.setValueAtTime(0, st); env.gain.linearRampToValueAtTime(1, st + .008);
  env.gain.setValueAtTime(1, Math.max(st + .01, end - .05)); env.gain.linearRampToValueAtTime(0, end + .04);
  src.connect(env); env.connect(master); src.start(st, Math.max(0, st - t0b)); src.stop(end + .1);
  return [src];
}
function resampled(s, n, when, dur) {
  const src = ac.createBufferSource(), env = ac.createGain(), end = when + dur, rate = 2 ** ((n.pitch - baseNote) / 12);
  src.buffer = s.buf; src.playbackRate.value = rate; bend(src.playbackRate, rate, n, when, dur);
  const st = s.off + s.con; src.loop = s.end - st > .03; src.loopStart = st + (s.end - st) * .4; src.loopEnd = s.end;
  env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(1, when + .01);
  env.gain.setValueAtTime(1, Math.max(when + .02, end - .05)); env.gain.linearRampToValueAtTime(0, end + .04);
  src.connect(env); env.connect(master);
  src.start(Math.max(ac.currentTime, when - s.pre / rate), s.off); src.stop(end + .1);
  return [src];
}
const preview = (p, l) => { ensureAudio(); voice({pitch: p, lyric: l}, ac.currentTime, .35); };

function play() {
  ensureAudio(); stopNodes();
  const sb = 60 / bpm; startBeat = pos; t0 = ac.currentTime + .06; endBeat = 0;
  notes.forEach(n => {
    const e = n.start + n.dur; endBeat = Math.max(endBeat, e);
    if (e <= startBeat || (tracks[n.tr || 0] || {}).mute) return;
    const s = Math.max(n.start, startBeat);
    srcs.push(...voice(n, t0 + (s - startBeat) * sb, (e - s) * sb));
  });
  if (inst) {
    endBeat = Math.max(endBeat, inst.duration / sb);
    const off = startBeat * sb;
    if (off < inst.duration) {
      const s = ac.createBufferSource(), gn = ac.createGain();
      s.buffer = inst; gn.gain.value = .7; s.connect(gn); gn.connect(master);
      s.start(t0, off); srcs.push(s);
    }
  }
  playing = true; $('playBtn').textContent = '❚❚'; loop();
}
function stopNodes() { srcs.forEach(s => { try { s.stop(); } catch (e) {} }); srcs = []; }
function pause() { playing = false; stopNodes(); $('playBtn').textContent = '▶'; }
function loop() {
  if (!playing) return;
  pos = startBeat + Math.max(0, ac.currentTime - t0) / (60 / bpm);
  if (pos >= endBeat + .2) { pause(); pos = 0; }
  const x = bx(pos);
  if (x > W - 40 || x < KEYW) { sx = Math.max(0, pos * beatW - 80); }
  $('time').textContent = fmt(pos * 60 / bpm);
  draw(); requestAnimationFrame(loop);
}

// ---------- Çizim ----------
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function draw() {
  g.clearRect(0, 0, W, H);
  // satırlar
  for (let p = MAX; p >= MIN; p--) {
    const y = py(p); if (y + ROWH < RULER || y > H) continue;
    g.fillStyle = isBlack(p) ? '#0f0f12' : '#17171b'; g.fillRect(KEYW, y, W - KEYW, ROWH);
    g.fillStyle = '#202026'; g.fillRect(KEYW, y + ROWH - 1, W - KEYW, 1);
  }
  // dikey çizgiler
  const st = step(), k0 = Math.floor(beatAt(KEYW) / st);
  for (let k = k0, x; (x = bx(k * st)) < W; k++) {
    const idx = k * st, m = Math.abs(idx % 4) < 1e-6, b = Math.abs(idx % 1) < 1e-6;
    g.fillStyle = m ? '#3a3a44' : b ? '#26262d' : '#1c1c22';
    g.fillRect(Math.round(x), RULER, m ? 2 : 1, H - RULER);
  }
  // notalar
  g.textBaseline = 'middle'; g.font = '700 15px "Segoe UI",Roboto,sans-serif';
  notes.forEach(n => {
    const x = bx(n.start), w = n.dur * beatW, y = py(n.pitch);
    if (x + w < KEYW || x > W || y + ROWH < RULER || y > H) return;
    const gr = g.createLinearGradient(0, y, 0, y + ROWH);
    const c = COL[(n.tr || 0) % COL.length]; gr.addColorStop(0, c); gr.addColorStop(1, c); g.globalAlpha = (n.tr || 0) === cur ? 1 : .35;
    rr(x + 1, y + 1, w - 2, ROWH - 2, 8); g.fillStyle = gr; g.fill();
    if (n === sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = '#fff'; g.fillText(n.lyric, x + 10, y + ROWH / 2 + 1, Math.max(8, w - 14)); drawPb(n, x, y, w); drawVib(n, x, y, w); g.globalAlpha = 1;
  });
  // oynatma çizgisi
  const px = bx(pos);
  if (px >= KEYW) { g.fillStyle = '#fff'; g.fillRect(px, RULER, 2, H - RULER); }
  // cetvel
  g.fillStyle = '#121216'; g.fillRect(0, 0, W, RULER);
  g.fillStyle = '#2a2a32'; g.fillRect(0, RULER - 1, W, 1);
  g.font = '700 13px "Segoe UI",Roboto,sans-serif'; g.fillStyle = '#9a9aa6';
  for (let m = Math.floor(beatAt(KEYW) / 4); bx(m * 4) < W; m++) {
    const x = bx(m * 4); if (x < KEYW) continue;
    g.fillStyle = '#2f2f38'; g.fillRect(x, 0, 2, RULER);
    g.fillStyle = '#9a9aa6'; g.fillText(m + 1, x + 8, RULER / 2);
  }
  if (inst) { g.fillStyle = '#8be9c4'; g.fillRect(KEYW, RULER - 3, W - KEYW, 2); }
  // piyano tuşları
  for (let p = MAX; p >= MIN; p--) {
    const y = py(p); if (y + ROWH < RULER || y > H) continue;
    g.fillStyle = '#e9e9ec'; g.fillRect(0, y, KEYW, ROWH);
    g.fillStyle = '#b5b5ba'; g.fillRect(0, y + ROWH - 1, KEYW, 1);
    if (isBlack(p)) { g.fillStyle = '#121214'; g.fillRect(0, y + 2, KEYW * .62, ROWH - 4); }
    else { g.fillStyle = '#3b3b42'; g.font = '700 13px "Segoe UI",Roboto,sans-serif'; g.fillText(pname(p), 8, y + ROWH / 2); }
  }
  g.fillStyle = '#121216'; g.fillRect(0, 0, KEYW, RULER);
  rr(4, 5, 46, 22, 7); g.fillStyle = PINK; g.fill();
  g.fillStyle = '#fff'; g.font = '700 13px "Segoe UI",Roboto,sans-serif'; g.fillText('♩' + bpm, 9, RULER / 2);
}
function resize() {
  const r = roll.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  W = r.width; H = r.height; cv.width = W * d; cv.height = H * d;
  g.setTransform(d, 0, 0, d, 0, 0); clampView(); draw();
}

// ---------- Etkileşim ----------
const pt = e => { const r = cv.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
const hit = (x, y) => [...notes].reverse().find(n => (n.tr || 0) === cur && x >= bx(n.start) && x <= bx(n.start + n.dur) && y >= py(n.pitch) && y <= py(n.pitch) + ROWH);
const seek = x => { pos = Math.max(0, q(beatAt(x))); if (playing) { pause(); } $('time').textContent = fmt(pos * 60 / bpm); draw(); };
function mark() { if (!drag.pushed) { pushUndo(); drag.pushed = true; } }

cv.addEventListener('pointerdown', e => {
  const {x, y} = pt(e); cv.setPointerCapture(e.pointerId); ensureAudio();
  if (y < RULER && x > KEYW) { drag = {type: 'seek'}; seek(x); return; }
  if (x < KEYW) { if (y > RULER) preview(pitchAt(y), 'a'); return; }
  const n = hit(x, y);
  if (tool === 'erase') { drag = {type: 'erase'}; if (n) { pushUndo(); notes = notes.filter(m => m !== n); save(); draw(); } return; }
  if (tool === 'pitch' && n) { sel = n; drag = {type: 'bend', n}; bendAt(n, x, y); return; }
  if (n) {
    sel = n; const now = Date.now();
    if (lastTap.n === n && now - lastTap.t < 350) {
      const v = prompt('Söz (hece):', n.lyric);
      if (v !== null && v.trim()) { pushUndo(); n.lyric = lastLyric = v.trim(); save(); }
      lastTap = {n: null, t: 0}; drag = null; draw(); return;
    }
    lastTap = {n, t: now};
    const edge = x > bx(n.start + n.dur) - 14;
    drag = {type: edge ? 'resize' : 'move', n, ox: x, oy: y, s0: n.start, d0: n.dur, p0: n.pitch};
    if (!edge) preview(n.pitch, n.lyric);
    draw(); return;
  }
  sel = null;
  if (tool === 'pencil') {
    pushUndo();
    const nn = {start: Math.max(0, q(beatAt(x), true)), dur: snapOn ? step() : .25, pitch: pitchAt(y), lyric: lastLyric, tr: cur};
    notes.push(nn); sel = nn; preview(nn.pitch, nn.lyric);
    drag = {type: 'resize', n: nn, ox: x, d0: nn.dur, pushed: true};
  } else drag = {type: 'pan', ox: x, oy: y, sx0: sx, sy0: sy};
  draw();
});
cv.addEventListener('pointermove', e => {
  if (!drag) return; const {x, y} = pt(e), d = drag;
  if (d.type === 'seek') seek(x);
  else if (d.type === 'pan') { sx = d.sx0 - (x - d.ox); sy = d.sy0 - (y - d.oy); clampView(); draw(); }
  else if (d.type === 'bend') bendAt(d.n, x, y);
  else if (d.type === 'erase') { const n = hit(x, y); if (n) { pushUndo(); notes = notes.filter(m => m !== n); draw(); } }
  else if (d.type === 'move') {
    if (Math.abs(x - d.ox) + Math.abs(y - d.oy) < 4 && !d.pushed) return;
    mark();
    d.n.start = Math.max(0, q(d.s0 + (x - d.ox) / beatW));
    const np = Math.max(MIN, Math.min(MAX, d.p0 - Math.round((y - d.oy) / ROWH)));
    if (np !== d.n.pitch) { d.n.pitch = np; preview(np, d.n.lyric); }
    draw();
  } else if (d.type === 'resize') {
    if (Math.abs(x - d.ox) < 4 && !d.pushed) return;
    mark();
    d.n.dur = Math.max(snapOn ? step() : .0625, q(d.d0 + (x - d.ox) / beatW));
    draw();
  }
});
const endDrag = () => { if (drag && drag.pushed) save(); drag = null; };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey) { beatW = Math.max(40, Math.min(300, beatW * (e.deltaY < 0 ? 1.1 : .9))); }
  else if (e.shiftKey) sx += e.deltaY; else sy += e.deltaY;
  clampView(); draw();
}, {passive: false});

// ---------- Arayüz bağlantıları ----------
$('playBtn').onclick = () => playing ? pause() : play();
$('undoBtn').onclick = undo; $('redoBtn').onclick = redo;
$('bpmBtn').onclick = () => {
  const v = parseInt(prompt('Tempo (BPM):', bpm), 10);
  if (v >= 30 && v <= 300) { pushUndo(); bpm = v; $('bpmBtn').textContent = '♩' + v; save(); draw(); }
};
document.querySelectorAll('.tool[data-tool]').forEach(b => b.onclick = () => {
  tool = b.dataset.tool;
  document.querySelectorAll('.tool[data-tool]').forEach(x => x.classList.toggle('on', x === b));
});
$('snapBtn').onclick = () => {
  const o = [4, 8, 16, 32]; snapDiv = o[(o.indexOf(snapDiv) + 1) % o.length];
  $('snapBtn').textContent = '1/' + snapDiv; draw();
};
$('magnet').onclick = () => { snapOn = !snapOn; $('magnet').classList.toggle('on', snapOn); };
$('zoomIn').onclick = () => { beatW = Math.min(300, beatW * 1.25); draw(); };
$('zoomOut').onclick = () => { beatW = Math.max(40, beatW / 1.25); clampView(); draw(); };
$('menuBtn').onclick = () => { $('menu').hidden = !$('menu').hidden; };
$('importBtn').onclick = () => $('instInput').click();
$('instInput').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    ensureAudio();
    inst = await ac.decodeAudioData(await f.arrayBuffer());
    setT('instName', f.name + ' (' + fmt(inst.duration) + ')');
    toast('Enstrümantal yüklendi'); $('menu').hidden = true; draw();
  } catch (err) { toast('Ses dosyası okunamadı'); }
  e.target.value = '';
};
$('removeInst').onclick = () => { inst = null; setT('instName', 'Enstrümantal yüklenmedi'); draw(); };
$('clearBtn').onclick = () => { if (confirm('Bu trackin notaları silinsin mi?')) { pushUndo(); notes = notes.filter(n => (n.tr || 0) !== cur); sel = null; save(); draw(); } $('menu').hidden = true; };
document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); $('playBtn').click(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { pushUndo(); notes = notes.filter(n => n !== sel); sel = null; save(); draw(); }
  else if (e.ctrlKey && e.key === 'z') undo();
  else if (e.ctrlKey && e.key === 'y') redo();
});
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(roll);

$('addTrk').onclick = () => { pushUndo(); tracks.push({name: 'Track ' + (tracks.length + 1), mute: false}); cur = tracks.length - 1; save(); renderTracks(); draw(); };
$('muteTrk').onclick = () => { tracks[cur].mute = !tracks[cur].mute; save(); renderTracks(); };
$('delTrk').onclick = () => {
  if (tracks.length < 2) return toast('Son track silinemez');
  if (!confirm(tracks[cur].name + ' ve notaları silinsin mi?')) return;
  pushUndo(); notes = notes.filter(n => n.tr !== cur); notes.forEach(n => { if (n.tr > cur) n.tr--; });
  tracks.splice(cur, 1); cur = Math.max(0, cur - 1); sel = null; save(); renderTracks(); draw();
};
$('pname').oninput = e => { projName = e.target.value; save(); };
$('saveBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(proj())], {type: 'application/json'}));
  a.download = (projName.trim() || 'proje').replace(/[\\/:*?"<>|]/g, '_') + '.eiyuru.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  $('menu').hidden = true; toast('Proje kaydedildi');
};
let fileMode = null;
const pick = (m, acc) => { fileMode = m; $('fileIn').accept = acc; $('fileIn').click(); };
$('openBtn').onclick = () => pick('proj', '.json');
$('ustBtn').onclick = () => pick('ust', '.ust,.ustx');
$('vbBtn').onclick = () => pick('vb', '.zip');
$('baseBtn').onclick = () => {
  const v = parseInt(prompt('Ses bankasının kayıt perdesi (MIDI numarası, Do4 = 60):', baseNote), 10);
  if (v >= 24 && v <= 96) baseNote = v;
};
$('resetPb').onclick = () => { if (sel && sel.pb) { pushUndo(); delete sel.pb; save(); draw(); } $('menu').hidden = true; };
async function loadBank(f) {
  ensureAudio(); toast('Ses bankası okunuyor, bekle…');
  const bank = await EV.loadBank(await f.arrayBuffer(), b => ac.decodeAudioData(b));
  if (!bank.size) throw new Error('kullanılabilir wav bulunamadı');
  vb = bank; setT('vbName', f.name + ' · ' + bank.size + ' örnek yüklendi'); toast(bank.size + ' örnek yüklendi');
}
async function importUst(f) {
  const t = EV.decode(new Uint8Array(await f.arrayBuffer()));
  const r = /\.ustx$/i.test(f.name) ? EV.parseUSTX(t) : EV.parseUST(t);
  if (!r.notes.length) throw new Error('nota bulunamadı');
  pause(); pushUndo(); applyProj(r, true); toast(r.notes.length + ' nota içe aktarıldı');
}
$('fileIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return; $('menu').hidden = true;
  try {
    if (fileMode === 'proj') { pause(); applyProj(JSON.parse(await f.text())); toast('Proje açıldı'); }
    else if (fileMode === 'ust') await importUst(f); else await loadBank(f);
  } catch (err) { toast('Dosya okunamadı: ' + err.message); }
};
const dl = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const fname = ext => (projName.trim() || 'proje').replace(/[\\/:*?"<>|]/g, '_') + ext;
$('ustOut').onclick = () => { $('menu').hidden = true; dl(new Blob([EV.toUST(proj(), cur)], {type: 'text/plain'}), fname('.ust')); toast('UST: "' + tracks[cur].name + '" aktarıldı'); };
$('ustxOut').onclick = () => { $('menu').hidden = true; dl(new Blob([EV.toUSTX(proj())], {type: 'text/plain'}), fname('.ustx')); toast('USTX aktarıldı'); };
$('vibBtn').onclick = () => {
  $('menu').hidden = true; if (!sel) return toast('Önce bir nota seç');
  const d = sel.vib ? [sel.vib.len, sel.vib.per, sel.vib.dep, sel.vib.in, sel.vib.out].join(',') : '75,175,25,10,10';
  const v = prompt('Vibrato: uzunluk %, periyot ms, derinlik cent, in %, out %\n(Kaldırmak için 0 yaz)', d); if (v === null) return;
  pushUndo(); const a = v.split(',').map(Number);
  if (a.length < 3 || !(a[0] > 0)) delete sel.vib; else sel.vib = {len: a[0], per: a[1], dep: a[2], in: a[3] || 0, out: a[4] || 0};
  save(); draw();
};
function wavBlob(b) {
  const ch = b.numberOfChannels, n = b.length, d = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); d.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, ch, true);
  d.setUint32(24, b.sampleRate, true); d.setUint32(28, b.sampleRate * ch * 2, true); d.setUint16(32, ch * 2, true); d.setUint16(34, 16, true);
  w(36, 'data'); d.setUint32(40, n * ch * 2, true);
  const c = Array.from({length: ch}, (_, i) => b.getChannelData(i)); let o = 44;
  for (let i = 0; i < n; i++) for (let k = 0; k < ch; k++) { const v = Math.max(-1, Math.min(1, c[k][i])); d.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
  return new Blob([d], {type: 'audio/wav'});
}
async function exportWav() {
  $('menu').hidden = true; pause(); ensureAudio();
  if (!notes.length && !inst) return toast('Dışa aktarılacak bir şey yok');
  const sb = 60 / bpm, sr = 44100; let end = 0;
  notes.forEach(n => end = Math.max(end, n.start + n.dur));
  const oc = new OfflineAudioContext(2, Math.ceil((Math.max(end * sb, inst ? inst.duration : 0) + .6) * sr), sr), keep = [ac, master];
  try {
    ac = oc; const comp = oc.createDynamicsCompressor(); master = oc.createGain(); master.gain.value = 1.6; master.connect(comp); comp.connect(oc.destination);
    notes.forEach(n => { if (!(tracks[n.tr || 0] || {}).mute) voice(n, n.start * sb, n.dur * sb); });
    if (inst) { const s = oc.createBufferSource(), gn = oc.createGain(); s.buffer = inst; gn.gain.value = .7; s.connect(gn); gn.connect(master); s.start(0); }
  } finally { [ac, master] = keep; }
  toast('WAV hazırlanıyor…');
  try { dl(wavBlob(await oc.startRendering()), fname('.wav')); toast('WAV kaydedildi'); } catch (e) { toast('WAV oluşturulamadı: ' + e.message); }
}
$('wavOut').onclick = exportWav;
$('homeBtn').onclick = () => { const w = playing; pause(); pos = 0; sx = 0; $('time').textContent = fmt(0); draw(); if (w) play(); };
document.addEventListener('keydown', e => { if (e.code === 'Home' && e.target.tagName !== 'INPUT') $('homeBtn').click(); });
$('newBtn').onclick = () => {
  if (!confirm('Yeni proje oluşturulsun mu? Kaydedilmemiş değişiklikler silinecek.')) return;
  pause(); lastLyric = 'a';
  applyProj({name: T('Adsız proje'), bpm: 120, tracks: [{name: 'Track 1', mute: false}], notes: []});
  sx = 0; sy = (MAX - 77) * ROWH; clampView(); draw(); $('menu').hidden = true; toast('Yeni proje oluşturuldu');
};

const conv = fn => {
  pushUndo(); let c = 0;
  notes.forEach(n => { if ((n.tr || 0) === cur) { const v = fn(n.lyric); if (v !== n.lyric) { n.lyric = v; c++; } } });
  save(); draw(); $('menu').hidden = true; toast(c + ' söz güncellendi');
};
$('phRom').onclick = () => conv(PH.toRomaji);
$('phHira').onclick = () => conv(s => PH.toKana(s));
$('phKata').onclick = () => conv(s => PH.toKana(s, true));

load(); refreshUI(); resize();


})();
