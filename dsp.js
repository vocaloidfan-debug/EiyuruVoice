// EiyuruVoice DSP: perde eğrisi, f0 tahmini ve formant korumalı perde kaydırma (sabit periyotlu PSOLA)
window.DSP = (() => {
// Notanın perde eğrisi (pitch + vibrato) -> t(sn) => yarım ton farkı. Yoksa null.
function semiFn(n, dur) {
  const pb = n.pb && n.pb.length ? n.pb : null, v = n.vib && n.vib.dep > 0 && n.vib.len > 0 && n.vib.per > 0 ? n.vib : null;
  const gl = n.gl || null, hm = n.hum || null;
  if (!pb && !v && !gl && !hm) return null;
  const pbAt = u => {
    if (u <= pb[0][0]) return pb[0][1];
    for (let i = 1; i < pb.length; i++) if (u <= pb[i][0]) { const a = pb[i - 1], b = pb[i]; return a[1] + (b[1] - a[1]) * (u - a[0]) / ((b[0] - a[0]) || 1); }
    return pb[pb.length - 1][1];
  };
  return tt => {
    let s = pb ? pbAt(tt / dur) : 0;
    if (gl) { const u = Math.min(1, tt / gl.t), e = u * u * (3 - 2 * u); s += gl.s * ((1 - e) - .07 * Math.sin(Math.PI * u)); }
    if (hm) s += (hm.a1 * Math.sin(2 * Math.PI * .8 * tt + hm.p1) + hm.a2 * Math.sin(2 * Math.PI * 2.9 * tt + hm.p2)) / 100;
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
// f0 tahmini: vokal bölgesinin üç yerinde (olmazsa tüm örnekte) otokorelasyon dener, en iyisini seçer.
function detect(s) {
  const b = s.buf, sr = b.sampleRate, x = b.getChannelData(0);
  const st = Math.floor((s.off + s.con) * sr), en = Math.min(x.length, Math.floor(s.end * sr)), lmin = Math.floor(sr / 900), lmax = Math.floor(sr / 70);
  let best = 0, bl = 0, br = null, ba = 0;
  for (const a0 of [st, Math.floor(s.off * sr)]) {
    for (const fr of [.3, .5, .7]) {
      const a = a0 + Math.floor((en - a0) * fr), W = Math.min(2048, en - a - lmax - 2);
      if (W < 512) continue;
      let e0 = 0; for (let i = 0; i < W; i++) e0 += x[a + i] * x[a + i];
      if (e0 < 1e-6) continue;
      const r = new Float64Array(lmax + 2); let bs = 0, bb = 0;
      for (let l = lmin; l <= lmax; l++) {
        let c = 0, e1 = 0; for (let i = 0; i < W; i++) { const y = x[a + i + l]; c += x[a + i] * y; e1 += y * y; }
        r[l] = c / Math.sqrt(e0 * e1 + 1e-12); if (r[l] > bs) { bs = r[l]; bb = l; }
      }
      if (bs <= best) continue;
      for (let l = lmin + 1; l < lmax; l++) if (r[l] > .92 * bs && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { bb = l; break; }
      best = bs; bl = bb; br = r; ba = a;
    }
    if (best >= .45) break;
  }
  if (best < .35) return null;
  let T0 = bl; const d = br[bl - 1] - 2 * br[bl] + br[bl + 1];
  if (d < 0) { const o = .5 * (br[bl - 1] - br[bl + 1]) / d; if (Math.abs(o) < 1) T0 += o; }
  let pm = ba, mx = 0; for (let i = ba; i < ba + Math.ceil(T0); i++) if (Math.abs(x[i]) > mx) { mx = Math.abs(x[i]); pm = i; }
  return {T0, pm, f0: sr / T0};
}
// Perde bulunamazsa kullanıcının "kayıt perdesi" değeri varsayılır: yine de PSOLA kullanılır, ses incelip kalınlaşmaz.
function pitchInfo(s, base) {
  if (s.pi === undefined) s.pi = detect(s);
  if (s.pi || !base) return s.pi;
  if (!s.pa) {
    const sr = s.buf.sampleRate, x = s.buf.getChannelData(0), T0 = sr / base, a = Math.min(x.length - 1, Math.floor((s.off + s.con) * sr));
    let pm = a, mx = 0; for (let i = a; i < Math.min(x.length, a + Math.ceil(T0)); i++) if (Math.abs(x[i]) > mx) { mx = Math.abs(x[i]); pm = i; }
    s.pa = {T0, pm, f0: base, assumed: true};
  }
  return s.pa;
}
// Uzatılacak (döngüye alınacak) bölge: ünlünün en yüksek sesli ve en kararlı kısmı (sondaki sönümlenen kuyruk değil).
function loopRegion(s, A, x, sr, stS, enS) {
  if (s.lr) return s.lr;
  const T0 = A.T0, Hb = Math.max(8, Math.round(T0)), L = Math.max(Math.round(.12 * sr), Math.round(4 * T0)); let ls, len;
  if (enS - stS <= L + Hb) { ls = Math.max(0, enS - L); len = enS - ls; }
  else {
    const nb = Math.floor((enS - stS) / Hb), r = new Float32Array(nb), wn = Math.max(2, Math.round(L / Hb)); let bi = 0, bs = -1;
    for (let i = 0; i < nb; i++) { let e = 0; for (let k = 0; k < Hb; k++) { const v = x[stS + i * Hb + k]; e += v * v; } r[i] = Math.sqrt(e / Hb); }
    for (let i = 0; i + wn <= nb; i++) {
      let m = 0, q = 0; for (let k = 0; k < wn; k++) { m += r[i + k]; q += r[i + k] * r[i + k]; } m /= wn;
      const sc = m - .6 * Math.sqrt(Math.max(0, q / wn - m * m)); if (sc > bs) { bs = sc; bi = i; }
    }
    ls = stS + bi * Hb; len = wn * Hb;
  }
  len = Math.max(2 * T0, Math.floor(len / T0) * T0);
  let e = 0, c = 0; for (let i = ls; i < ls + len && i < x.length; i++) { e += x[i] * x[i]; c++; }
  return s.lr = {ls, len, ref: Math.sqrt(e / Math.max(1, c)) + 1e-6};
}
// Notayı üretir: ünsüz bölümü aynen, ünlü bölümü PSOLA ile hedef perdeye kaydırılır (UTAU gibi: ünsüz sabit, ünlü uzatılır).
// Formantlar perdeyle hafifçe (ALPHA) izlenir, ses seviyesi uzatılan bölgede sabitlenir: konuşma değil şarkı gibi sürer.
function psola(s, n, dur, A) {
  const b = s.buf, sr = b.sampleRate, x = b.getChannelData(0), T0 = A.T0, pm = A.pm, ALPHA = .3;
  const preS = Math.round(s.pre * sr), conS = Math.max(0, Math.round(s.con * sr)), offS = Math.round(s.off * sr);
  const y = new Float32Array(Math.max(Math.ceil((s.pre + dur + .08) * sr), conS + 2));
  for (let i = 0; i < conS && offS + i < x.length && i < y.length; i++) y[i] = x[offS + i];
  const stS = offS + conS, enS = Math.min(x.length, Math.floor(s.end * sr)), lr = loopRegion(s, A, x, sr, stS, enS), ls = lr.ls, loopLen = lr.len;
  const sf = semiFn(n, dur), fn = 440 * 2 ** ((n.pitch - 69) / 12), wc = {}, H0 = Math.round(T0);
  const win = G => wc[G] || (wc[G] = Float32Array.from({length: G}, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (G - 1))));
  for (let p = conS; p - H0 < y.length;) {
    let sp = stS + (p - conS); const flat = sp >= ls;
    if (sp >= ls + loopLen) { const m = ((sp - ls) / loopLen) % 2; sp = ls + (m <= 1 ? m : 2 - m) * loopLen; }
    const c = Math.round(pm + Math.round((sp - pm) / T0) * T0), tn = Math.max(0, Math.min(dur, (p - preS) / sr));
    const fT = fn * 2 ** ((sf ? sf(tn) : 0) / 12), T = sr / fT, ph = Math.max(.85, Math.min(1.2, (fT / A.f0) ** ALPHA));
    const G = Math.max(8, Math.round(2 * T0 / ph)), H = G >> 1, w = win(G), pr = Math.round(p); let g = 2 * T / G;
    if (flat) {
      let e = 0, k = 0; for (let i = Math.max(0, c - H0); i < Math.min(x.length, c + H0); i++) { e += x[i] * x[i]; k++; }
      g *= Math.max(.6, Math.min(1.6, lr.ref / (Math.sqrt(e / Math.max(1, k)) + 1e-6)));
    }
    for (let i = 0; i < G; i++) {
      const yi = pr - H + i; if (yi < 0 || yi >= y.length) continue;
      const pos = c + (i - H) * ph, i0 = Math.floor(pos), fr = pos - i0; if (i0 < 0 || i0 + 1 >= x.length) continue;
      y[yi] += (x[i0] * (1 - fr) + x[i0 + 1] * fr) * w[i] * g;
    }
    p += T;
  }
  return y;
}
return {semiFn, pitchInfo, psola};
})();
