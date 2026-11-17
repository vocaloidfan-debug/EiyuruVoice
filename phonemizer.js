// EiyuruVoice fonemizör: kana <-> romaji (Hepburn)
window.PH = (() => {
const P = 'a あ i い u う e え o お ka か ki き ku く ke け ko こ sa さ shi し su す se せ so そ ta た chi ち tsu つ te て to と na な ni に nu ぬ ne ね no の ha は hi ひ fu ふ he へ ho ほ ma ま mi み mu む me め mo も ya や yu ゆ yo よ ra ら ri り ru る re れ ro ろ wa わ wo を n ん ga が gi ぎ gu ぐ ge げ go ご za ざ ji じ zu ず ze ぜ zo ぞ da だ di ぢ du づ de で do ど ba ば bi び bu ぶ be べ bo ぼ pa ぱ pi ぴ pu ぷ pe ぺ po ぽ'.split(' ');
const fwd = new Map(), rev = new Map();
const add = (r, k) => { fwd.set(r, k); if (!rev.has(k)) rev.set(k, r); };
for (let i = 0; i < P.length; i += 2) add(P[i], P[i + 1]);
[['ky', 'き'], ['gy', 'ぎ'], ['ny', 'に'], ['hy', 'ひ'], ['my', 'み'], ['ry', 'り'], ['by', 'び'], ['py', 'ぴ'], ['sh', 'し'], ['ch', 'ち'], ['j', 'じ']]
  .forEach(([c, k]) => ['ゃ', 'ゅ', 'ょ'].forEach((s, i) => add(c + 'auo'[i], k + s)));
Object.entries({si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ'}).forEach(([r, k]) => fwd.set(r, k));
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// Kana -> romaji (kanji desteklenmez, olduğu gibi kalır)
function toRomaji(s) {
  s = toHira(s); let out = '', i = 0, dbl = false;
  while (i < s.length) {
    if (s[i] === 'っ') { dbl = true; i++; continue; }
    if (s[i] === 'ー') { const m = out.match(/[aiueo]$/); out += m ? m[0] : ''; i++; continue; }
    let k = s[i], len = 1;
    if ('ゃゅょ'.includes(s[i + 1] || '#')) { k = s.slice(i, i + 2); len = 2; }
    let r = rev.get(k); if (r === undefined) { r = rev.get(s[i]); len = 1; }
    if (r === undefined) r = s[i];
    if (dbl && /^[^aiueo]/.test(r)) r = (r.startsWith('ch') ? 't' : r[0]) + r;
    dbl = false; out += r; i += len;
  }
  return out;
}
// Romaji -> hiragana / katakana
function toKana(s, kata) {
  const L = s.toLowerCase(); let out = '', i = 0;
  while (i < L.length) {
    const c = L[i];
    if (c === "'") { i++; continue; }
    if ((c === L[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(c)) || L.startsWith('tch', i)) { out += 'っ'; i++; continue; }
    let hit = false;
    for (let n = 3; n > 0 && !hit; n--) { const k = fwd.get(L.slice(i, i + n)); if (k) { out += k; i += n; hit = true; } }
    if (!hit) { out += s[i]; i++; }
  }
  return kata ? toKata(out) : out;
}
return {toRomaji, toKana, toKata, toHira};
})();
