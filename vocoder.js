// EiyuruVoice vokoder yardımcıları: NSF-HiFiGAN (nsf_hifigan.onnx) için log10-mel hesabı ve parçalı çalıştırma.
// Model ayarları: 44100 Hz, n_fft 2048, hop 512, 128 mel (Slaney, 40-16000 Hz), log10(max(mel, 1e-5)).
window.VOC = (() => {
const SR = 44100, NF = 2048, HOP = 512, NM = 128, FMIN = 40, FMAX = 16000, NB = NF / 2 + 1;
const hz2mel = f => f < 1000 ? f * 3 / 200 : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27);
const mel2hz = m => m < 15 ? m * 200 / 3 : 1000 * Math.exp((Math.log(6.4) / 27) * (m - 15));
let B = null, win = null, cs = null, sn = null, rv = null;
function init() {
  if (B) return;
  const lo = hz2mel(FMIN), hi = hz2mel(FMAX), mf = Array.from({length: NM + 2}, (_, i) => mel2hz(lo + (hi - lo) * i / (NM + 1)));
  B = [];
  for (let i = 0; i < NM; i++) {
    const row = new Float32Array(NB), en = 2 / (mf[i + 2] - mf[i]); let a = NB, b = 0;
    for (let k = 0; k < NB; k++) {
      const f = k * SR / NF, v = Math.max(0, Math.min((f - mf[i]) / (mf[i + 1] - mf[i]), (mf[i + 2] - f) / (mf[i + 2] - mf[i + 1]))) * en;
      row[k] = v; if (v > 0) { if (k < a) a = k; b = k + 1; }
    }
    B.push({row, a, b});
  }
  win = Float64Array.from({length: NF}, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / NF));
  cs = Float64Array.from({length: NF / 2}, (_, i) => Math.cos(2 * Math.PI * i / NF)); sn = Float64Array.from({length: NF / 2}, (_, i) => -Math.sin(2 * Math.PI * i / NF));
  rv = new Uint16Array(NF); const bits = Math.log2(NF);
  for (let i = 0; i < NF; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rv[i] = r; }
}
function fft(re, im) {
  for (let i = 0; i < NF; i++) { const j = rv[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let sz = 2; sz <= NF; sz <<= 1) {
    const h = sz >> 1, st = NF / sz;
    for (let i = 0; i < NF; i += sz) for (let k = 0; k < h; k++) {
      const wr = cs[k * st], wi = sn[k * st], a = i + k, b = a + h, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}
function melFrames(x) {
  init(); const pad = (NF - HOP) >> 1, n = x.length, frames = 1 + Math.floor((n + 2 * pad - NF) / HOP);
  const out = new Float32Array(frames * NM), re = new Float64Array(NF), im = new Float64Array(NF), mag = new Float64Array(NB);
  const at = i => { if (i < 0) i = -i; if (i >= n) i = 2 * n - 2 - i; return i >= 0 && i < n ? x[i] : 0; };
  for (let f = 0; f < frames; f++) {
    const s0 = f * HOP - pad;
    for (let i = 0; i < NF; i++) { re[i] = at(s0 + i) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < NB; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k] + 1e-9);
    for (let m = 0; m < NM; m++) { const {row, a, b} = B[m]; let s = 0; for (let k = a; k < b; k++) s += row[k] * mag[k]; out[f * NM + m] = Math.log10(Math.max(s, 1e-5)); }
  }
  return {mel: out, frames};
}
// run(mel, f0, frames) -> Float32Array(frames * 512). f0fn(frame) -> Hz (0 = sessiz). Dikiş yerleri en sessiz karelerde seçilir.
async function vocode(run, x, f0fn, onProg) {
  let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  if (pk < 1e-5) return new Float32Array(x.length);
  const sc = .5 / pk, xs = new Float32Array(x.length); for (let i = 0; i < x.length; i++) xs[i] = x[i] * sc;
  const {mel, frames} = melFrames(xs), f0 = new Float32Array(frames), en = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { f0[f] = f0fn(f) || 0; let s = 0; for (let m = 0; m < NM; m++) s += mel[f * NM + m]; en[f] = s / NM; }
  const CH = 300, CTX = 8, cuts = [0];
  while (frames - cuts[cuts.length - 1] > CH * 1.3) {
    const a = cuts[cuts.length - 1] + Math.floor(CH * .7), b = cuts[cuts.length - 1] + CH; let bi = a;
    for (let f = a; f < b; f++) if (en[f] < en[bi]) bi = f;
    cuts.push(bi);
  }
  cuts.push(frames);
  const out = new Float32Array(frames * HOP);
  for (let c = 0; c + 1 < cuts.length; c++) {
    const a = cuts[c], b = cuts[c + 1], a0 = Math.max(0, a - CTX), b0 = Math.min(frames, b + CTX);
    const w = await run(mel.subarray(a0 * NM, b0 * NM), f0.subarray(a0, b0), b0 - a0);
    out.set(w.subarray((a - a0) * HOP, (b - a0) * HOP), a * HOP);
    if (onProg) onProg((c + 1) / (cuts.length - 1));
  }
  const y = new Float32Array(x.length), g = 1 / sc; for (let i = 0; i < y.length && i < out.length; i++) y[i] = out[i] * g;
  return y;
}
return {SR, HOP, NM, melFrames, vocode};
})();
