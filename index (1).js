// Web Audio Context başlatma (Tarayıcı güvenlik önlemleri nedeniyle ilk tıklamada aktif olur
let audioCtx;

// Ses Bankası (Voicebank) Simülasyonu
// Gerçek projede 'a.wav', 'ba.wav' dosyalarını sunucudan çekeriz (fetch)
async function loadSample(syllable) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Test amaçlı: Eğer gerçek wav dosyanız yoksa tarayıcı beyaz gürültü / temel sinüs dalgası üretir
    // Gerçek ses eklemek için buraya fetch("samples/" + syllable + ".wav") yazılmalıdır.
    const bufferSize = audioCtx.sampleRate * 1.0; // 1 saniyelik boş ses alanı
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Basit bir insan sesi dalgası simülasyonu (Formant benzeri testere dişi dalga)
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * 220 * (i / audioCtx.sampleRate)) * 0.5;
    }
    return buffer;
}

// Nota Butonlarına Basıldığında Sesi Tetikleme
document.querySelectorAll('.key').forEach(button => {
    button.addEventListener('click', async () => {
        const targetFreq = parseFloat(button.getAttribute('data-freq'));
        const selectedSyllable = document.getElementById('syllable').value;
        
        // 1. İlgili hecenin ses kaydını yükle
        const sampleBuffer = await loadSample(selectedSyllable);
        
        // 2. Ses kaynağını oluştur
        const source = audioCtx.createBufferSource();
        source.buffer = sampleBuffer;
        
        // 3. UTAU Mantığı: Perdeyi Ayarla (PlaybackRate hesaplama)
        // Orijinal sesimiz 220Hz (A3). Hedef frekansa ulaşmak için hızı oranlıyoruz
        const baseFreq = 220.0;
        source.playbackRate.value = targetFreq / baseFreq;
        
        // 4. Hoparlöre bağla ve çal
        source.connect(audioCtx.destination);
        source.start(0);
    });
});
