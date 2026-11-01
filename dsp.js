// EiyuruVoice DSP: perde eğrisi, f0 tahmini ve formant korumalı perde kaydırma (sabit periyotlu PSOLA)
window.DSP = (() => {
// Notanın perde eğrisi (pitch + vibrato) -> t(sn) => yarım ton farkı. Yoksa null.
function semiFn(n, dur) {
  const pb = n.pb && n.pb.length ? n.pb : null, v = n.vib && n.vib.dep > 0 && n.vib.len > 0 && n.vib.per > 0 ? n.vib : null;
  if (!pb && !v) return null;
  const pbAt = u => {
    if (u <= pb[0][0]) return pb[0][1];
    for (let i = 1; i < pb.length; i++) if (u <= pb[i][0]) { const a = pb[i - 1], b = pb[i]; return a[1] + (b[1] - a[1]) * (u - a[0]) / ((b[0] - a[0]) || 1); }
    return pb[pb.length - 1][1];
  };
  return tt => {
    let s = pb ? pbAt(tt / dur) : 0;
    if (v) {
      const L = dur * v.len / 100, u = tt - (dur - L);
      if (u >= 0) {
        const ei = L * v.in / 100, eo = L * v.out / 100; let e = 1;
        if (ei > 0 && u < ei) e = u / ei;
        if (eo > 0 && u > L - eo) e = Math.min(e, (L - u) / eo);
        s += e * v.dep / 100 * Math.sin(2 * Math.PI * u / (v.per / 1000));
      }
    }
    return s;
  };
}
// Örneğin kendi f0 değerini (otokorelasyon) ve bir perde işaretini bulur. Bulamazsa null.
function pitchInfo(s) {
  if (s.pi !== undefined) return s.pi;
  s.pi = null;
  const b = s.buf, sr = b.sampleRate, x = b.getChannelData(0);
  const st = Math.floor((s.off + s.con) * sr), en = Math.min(x.length, Math.floor(s.end * sr));
  const lmin = Math.floor(sr / 900), lmax = Math.floor(sr / 70), a = st + Math.floor((en - st) * .3), W = Math.min(2048, en - a - lmax - 2);
  if (W < 512) return null;
  let e0 = 0; for (let i = 0; i < W; i++) e0 += x[a + i] * x[a + i];
  if (e0 < 1e-6) return null;
  const r = new Float64Array(lmax + 2); let best = 0, bl = 0;
  for (let l = lmin; l <= lmax; l++) {
    let c = 0, e1 = 0; for (let i = 0; i < W; i++) { const y = x[a + i + l]; c += x[a + i] * y; e1 += y * y; }
    r[l] = c / Math.sqrt(e0 * e1 + 1e-12); if (r[l] > best) { best = r[l]; bl = l; }
  }
  if (best < .5) return null;
  for (let l = lmin + 1; l < lmax; l++) if (r[l] > .92 * best && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { bl = l; break; }
  let T0 = bl; const d = r[bl - 1] - 2 * r[bl] + r[bl + 1];
  if (d < 0) { const o = .5 * (r[bl - 1] - r[bl + 1]) / d; if (Math.abs(o) < 1) T0 += o; }
  let pm = a, mx = 0; for (let i = a; i < a + Math.ceil(T0); i++) if (Math.abs(x[i]) > mx) { mx = Math.abs(x[i]); pm = i; }
  return s.pi = {T0, pm, f0: sr / T0};
}
// Notayı üretir: ünsüz bölümü aynen, ünlü bölümü PSOLA ile hedef perdeye kaydırılır.
// Hız ve formantlar korunur, bu yüzden 1 tonluk değişim sesi inceltip kalınlaştırmaz.
function psola(s, n, dur, A) {
  const b = s.buf, sr = b.sampleRate, x = b.getChannelData(0), T0 = A.T0, pm = A.pm;
  const preS = Math.round(s.pre * sr), conS = Math.max(0, Math.round(s.con * sr)), offS = Math.round(s.off * sr);
  const y = new Float32Array(Math.max(Math.ceil((s.pre + dur + .08) * sr), conS + 2));
  for (let i = 0; i < conS && offS + i < x.length && i < y.length; i++) y[i] = x[offS + i];
  const stS = offS + conS, enS = Math.min(x.length, Math.floor(s.end * sr)), ls = stS + Math.floor((enS - stS) * .4);
  const loopLen = Math.max(T0, Math.floor((enS - ls) / T0) * T0), G = Math.round(2 * T0), H = Math.round(T0), w = new Float32Array(G);
  for (let i = 0; i < G; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (G - 1));
  const sf = semiFn(n, dur), fn = 440 * 2 ** ((n.pitch - 69) / 12);
  for (let p = conS; p - H < y.length;) {
    let sp = stS + (p - conS);
    if (sp >= ls + loopLen) sp = ls + ((sp - ls) % loopLen);
    const c = Math.round(pm + Math.round((sp - pm) / T0) * T0), tn = Math.max(0, Math.min(dur, (p - preS) / sr));
    const T = sr / (fn * 2 ** ((sf ? sf(tn) : 0) / 12)), g = T / T0, pr = Math.round(p);
    for (let i = 0; i < G; i++) { const xi = c - H + i, yi = pr - H + i; if (xi >= 0 && xi < x.length && yi >= 0 && yi < y.length) y[yi] += x[xi] * w[i] * g; }
    p += T;
  }
  return y;
}
return {semiFn, pitchInfo, psola};
})();
