// EiyuruVoice arayüz dilleri: tr, en, ja, ar (anahtar = Türkçe metin)
(() => {
const LANGS = ['tr', 'en', 'ja', 'ar'];
const D = [
['Menü','Menu','メニュー','القائمة'],['Oynat','Play','再生','تشغيل'],['Geri al','Undo','元に戻す','تراجع'],['Yinele','Redo','やり直す','إعادة'],
['Proje adı','Project name','プロジェクト名','اسم المشروع'],['Seç','Select','選択','تحديد'],['Nota ekle','Add note','ノート追加','إضافة نوتة'],
['Pitch çiz','Draw pitch','ピッチ描画','رسم النغمة'],['Nota sil','Delete note','ノート削除','حذف نوتة'],['Izgaraya yapış','Snap to grid','グリッドにスナップ','محاذاة للشبكة'],
['Track ekle','Add track','トラック追加','إضافة مسار'],['Sustur','Mute','ミュート','كتم'],['Track sil','Delete track','トラック削除','حذف المسار'],
['Projeyi kaydet','Save project','プロジェクトを保存','حفظ المشروع'],['Projeyi aç','Open project','プロジェクトを開く','فتح مشروع'],
['UST / USTX içe aktar','Import UST / USTX','UST / USTX を読み込む','استيراد UST / USTX'],
['UST dışa aktar (seçili track)','Export UST (selected track)','UST を書き出す（選択トラック）','تصدير UST (المسار المحدد)'],
['USTX dışa aktar','Export USTX','USTX を書き出す','تصدير USTX'],['WAV dışa aktar','Export WAV','WAV を書き出す','تصدير WAV'],
['Seçili notaya vibrato','Vibrato for selected note','選択ノートにビブラート','اهتزاز للنوتة المحددة'],

['Ses bankası yok: yerleşik sentezleyici','No voicebank: built-in synth','音源なし：内蔵シンセ','لا يوجد بنك أصوات: المُصنِّع المدمج'],
['Banka kayıt perdesi','Voicebank base pitch','音源の基準音程','نغمة تسجيل البنك'],
['Enstrümantal müzik içe aktar','Import Instrumental Music','インスト音源を読み込む','استيراد موسيقى مصاحبة'],
['Dosyada tempo değişimi var; ilk tempo kullanıldı','The file has tempo changes; the first tempo was used','ファイルにテンポ変化があります。最初のテンポを使用しました','يحتوي الملف على تغيّرات في السرعة؛ استُخدمت السرعة الأولى'],
['Enstrümantalı kaldır','Remove instrumental','インストを削除','إزالة الموسيقى المصاحبة'],
['Enstrümantal yüklenmedi','No instrumental loaded','インスト未読み込み','لم يتم تحميل موسيقى مصاحبة'],
["Seçili notanın pitch'ini sıfırla",'Reset pitch of selected note','選択ノートのピッチをリセット','إعادة ضبط نغمة النوتة المحددة'],
['Bu trackin notalarını sil','Delete notes of this track','このトラックのノートを削除','حذف نوتات هذا المسار'],
['Söz: Japonca → Romaji','Lyrics: Japanese → Romaji','歌詞：かな → ローマ字','الكلمات: يابانية ← روماجي'],
['Söz: Romaji → Hiragana','Lyrics: Romaji → Hiragana','歌詞：ローマ字 → ひらがな','الكلمات: روماجي ← هيراغانا'],
['Söz: Romaji → Katakana','Lyrics: Romaji → Katakana','歌詞：ローマ字 → カタカナ','الكلمات: روماجي ← كاتاكانا'],
['Dil','Language','言語','اللغة'],['Adsız proje','Untitled project','無題のプロジェクト','مشروع بلا اسم'],
['Ses dosyası okunamadı','Could not read audio file','音声ファイルを読み込めません','تعذّرت قراءة ملف الصوت'],
['Enstrümantal yüklendi','Instrumental loaded','インストを読み込みました','تم تحميل الموسيقى المصاحبة'],
['Söz (hece):','Lyric (syllable):','歌詞（音節）：','الكلمة (مقطع):'],['Tempo (BPM):','Tempo (BPM):','テンポ (BPM):','السرعة (BPM):'],
['Bu trackin notaları silinsin mi?',"Delete this track's notes?",'このトラックのノートを削除しますか？','هل تريد حذف نوتات هذا المسار؟'],
['Track adı:','Track name:','トラック名：','اسم المسار:'],['Son track silinemez','The last track cannot be deleted','最後のトラックは削除できません','لا يمكن حذف المسار الأخير'],
[' ve notaları silinsin mi?',' and its notes will be deleted. Continue?',' とそのノートを削除しますか？',' ونوتاته سيتم حذفها. متابعة؟'],
['Proje kaydedildi','Project saved','プロジェクトを保存しました','تم حفظ المشروع'],
['Ses bankasının kayıt perdesi (MIDI numarası, Do4 = 60):','Voicebank recording pitch (MIDI number, C4 = 60):','音源の録音音程（MIDI番号、ド4 = 60）：','نغمة تسجيل البنك (رقم MIDI، دو4 = 60):'],
['Ses bankası okunuyor, bekle…','Reading voicebank, please wait…','音源を読み込み中です…','جارٍ قراءة بنك الأصوات…'],
['kullanılabilir wav bulunamadı','no usable wav found','使えるwavがありません','لم يتم العثور على ملفات wav صالحة'],
[' örnek yüklendi',' samples loaded',' 個のサンプルを読み込みました',' عينة تم تحميلها'],
['nota bulunamadı','no notes found','ノートが見つかりません','لم يتم العثور على نوتات'],
[' nota içe aktarıldı',' notes imported',' ノートを読み込みました',' نوتة تم استيرادها'],
['Proje açıldı','Project opened','プロジェクトを開きました','تم فتح المشروع'],['Dosya okunamadı','Could not read file','ファイルを読み込めません','تعذّرت قراءة الملف'],
['aktarıldı','exported','書き出しました','تم التصدير'],['Önce bir nota seç','Select a note first','先にノートを選択してください','حدد نوتة أولاً'],
['Vibrato: uzunluk %, periyot ms, derinlik cent, in %, out %\n(Kaldırmak için 0 yaz)','Vibrato: length %, period ms, depth cents, in %, out %\n(Enter 0 to remove)','ビブラート：長さ%、周期ms、深さcent、イン%、アウト%\n（削除は0）','الاهتزاز: الطول %، الدورة ms، العمق سنت، دخول %، خروج %\n(اكتب 0 للإزالة)'],
['Dışa aktarılacak bir şey yok','Nothing to export','書き出す内容がありません','لا يوجد ما يمكن تصديره'],
['WAV hazırlanıyor…','Preparing WAV…','WAVを作成中…','جارٍ تجهيز WAV…'],['WAV kaydedildi','WAV saved','WAVを保存しました','تم حفظ WAV'],
['WAV oluşturulamadı','Could not create WAV','WAVを作成できません','تعذّر إنشاء WAV'],
['geçerli bir zip değil','not a valid zip','有効なzipではありません','ملف zip غير صالح'],
[' söz güncellendi',' lyrics updated',' 件の歌詞を更新しました',' كلمة تم تحديثها'],
['Başa al','Back to start','先頭へ戻る','العودة إلى البداية'],['Yeni proje','New project','新規プロジェクト','مشروع جديد'],
['Yeni proje oluşturulsun mu? Kaydedilmemiş değişiklikler silinecek.','Create a new project? Unsaved changes will be lost.','新規プロジェクトを作成しますか？保存していない変更は失われます。','هل تريد إنشاء مشروع جديد؟ ستُفقد التغييرات غير المحفوظة.'],
['Yeni proje oluşturuldu','New project created','新規プロジェクトを作成しました','تم إنشاء مشروع جديد'],
['Ses bankası yükle (zip / rar / dosyalar)','Load voicebank (zip / rar / files)','音源を読み込む（zip / rar / ファイル）','تحميل بنك الأصوات (zip / rar / ملفات)'],
['Ses bankası klasörü seç','Choose voicebank folder','音源フォルダを選択','اختيار مجلد بنك الأصوات'],
['Enstrümantal ayarları (ses, vokal azaltma, kaydırma)','Instrumental settings (volume, vocal reduction, offset)','インスト設定（音量・ボーカル低減・ずらし）','إعدادات الموسيقى المصاحبة (المستوى، تقليل الغناء، الإزاحة)'],
['Enstrümantal ayarları: ses seviyesi %, vokal azaltma %, kaydırma ms\n(Örnek: 70,100,0 — vokal azaltma orijinal şarkıdaki sesi bastırır)','Instrumental settings: volume %, vocal reduction %, offset ms\n(Example: 70,100,0 — vocal reduction suppresses the singer in the original song)','インスト設定：音量%、ボーカル低減%、ずらしms\n（例：70,100,0 — ボーカル低減は元の曲の歌声を抑えます）','إعدادات الموسيقى المصاحبة: المستوى %، تقليل الغناء %، الإزاحة ms\n(مثال: 70,100,0 — تقليل الغناء يخفض صوت المغني في الأغنية الأصلية)'],
['Vokal azaltılamadı: dosya mono','Could not reduce vocals: the file is mono','ボーカルを低減できません：モノラルのファイルです','تعذّر تقليل الغناء: الملف أحادي القناة'],
['Önce enstrümantal yükle','Load an instrumental first','先にインストを読み込んでください','حمّل الموسيقى المصاحبة أولاً'],
['Enstrümantal ayarlandı','Instrumental settings applied','インスト設定を適用しました','تم تطبيق إعدادات الموسيقى المصاحبة'],
['rar/7z için lib/libarchive.js gerekli','rar/7z needs lib/libarchive.js','rar/7z には lib/libarchive.js が必要です','يتطلب rar/7z الملف lib/libarchive.js'],
['EVPF içe aktar','Import EVPF','EVPF を読み込む','استيراد EVPF'],['EVPF dışa aktar','Export EVPF','EVPF を書き出す','تصدير EVPF'],
['EVPF dışa aktarıldı','EVPF exported','EVPF を書き出しました','تم تصدير EVPF'],['EVPF içe aktarıldı','EVPF imported','EVPF を読み込みました','تم استيراد EVPF'],
['Bu proje şu ses bankasıyla kaydedildi','This project was saved with the voicebank','このプロジェクトは次の音源で保存されました','حُفظ هذا المشروع مع بنك الأصوات'],
['Geçerli bir EVPF dosyası değil','Not a valid EVPF file','有効な EVPF ファイルではありません','ليس ملف EVPF صالحًا'],
['Doğal ifade (glide, vibrato, titreşim)','Natural expression (glide, vibrato, drift)','自然な表現（グライド、ビブラート、ゆらぎ）','تعبير طبيعي (انزلاق، اهتزاز، تذبذب)'],
['Doğal ifade açık','Natural expression on','自然な表現：オン','التعبير الطبيعي: مفعّل'],['Doğal ifade kapalı','Natural expression off','自然な表現：オフ','التعبير الطبيعي: متوقف'],
['Şarkıcı (seçili track)','Singer (selected track)','歌手（選択トラック）','المغني (المسار المحدد)'],['Varsayılan (son yüklenen)','Default (last loaded)','既定（最後に読み込んだもの）','الافتراضي (الأحدث تحميلًا)'],['Yerleşik sentezleyici','Built-in synthesizer','内蔵シンセサイザー','المُصنِّع المدمج'],
];
const long = [...D].sort((a, b) => b[0].length - a[0].length);
let lang = 'tr';
const NN = {
  tr: ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'],
  en: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  ja: ['ド', 'ド#', 'レ', 'レ#', 'ミ', 'ファ', 'ファ#', 'ソ', 'ソ#', 'ラ', 'ラ#', 'シ'],
  ar: ['دو', 'دو#', 'ري', 'ري#', 'مي', 'فا', 'فا#', 'صول', 'صول#', 'لا', 'لا#', 'سي']};
window.noteNames = () => NN[lang];
window.T = s => {
  if (lang === 'tr' || typeof s !== 'string') return s;
  const li = LANGS.indexOf(lang), ex = D.find(r => r[0] === s); if (ex) return ex[li];
  let o = s; long.forEach(r => { if (r[0].length >= 8 && o.includes(r[0])) o = o.split(r[0]).join(r[li]); });
  return o;
};
const _p = window.prompt.bind(window), _c = window.confirm.bind(window);
window.prompt = (m, d) => _p(T(m), d); window.confirm = m => _c(T(m));
window.setLang = l => {
  lang = LANGS.includes(l) ? l : 'tr';
  try { localStorage.setItem('ev-lang', lang); } catch (e) {}
  document.documentElement.lang = lang; $m.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('#menu button, #menu p, #menu span').forEach(e => { if (!e.dataset.k) e.dataset.k = e.textContent; });
  document.querySelectorAll('[data-k]').forEach(e => e.textContent = T(e.dataset.k));
  document.querySelectorAll('[aria-label]').forEach(e => { if (!e.dataset.ak) e.dataset.ak = e.getAttribute('aria-label'); e.setAttribute('aria-label', T(e.dataset.ak)); });
  document.getElementById('lang').value = lang;
  document.dispatchEvent(new Event('langchange'));
};
const $m = document.getElementById('menu');
document.getElementById('lang').onchange = e => setLang(e.target.value);
let saved = null; try { saved = localStorage.getItem('ev-lang'); } catch (e) {}
setLang(saved || (navigator.language || 'tr').slice(0, 2));
})();
