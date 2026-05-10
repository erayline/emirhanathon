# PlanFlow

> Tarayıcıda yaşayan, davranışını izleyen ve ertelediğinde nazikçe seni uyaran pikselart bir kişisel planlama asistanı.

**Hackathon:** PlanFlow AI Challenge — İSTÜN AI Stüdyo Kulübü
**Seçilen Problem:** Problem 3 — Sürekli Ertelenen Görevler

---

## ✨ Özellikler

PlanFlow, tarayıcının içinde yaşayan ve sekiz çekirdek özellikten oluşan bir Chrome extension'dır:

- 🐡 **Side Panel Avatar** — Yandaki panelde idle/talking animasyonu olan pikselart bir avatar
- 👀 **Lokal Davranış Takibi** — Aktif sekme, geçirilen süre ve saat dilimleri tamamen cihazda kaydedilir
- 🎯 **Click-through Overlay Müdahale** — Distraction sitelerinde avatar ekrana iner, tıklamayı engellemeden konuşur
- 📅 **Haftalık Takvim** — El yazımı CSS Grid, 7 sütun, drag-friendly
- 🗣️ **Doğal Dille Takvim Editleme** — "Her pazartesi 14:00-17:00 fizik lab" → AI olay olarak yerleştirir
- 📋 **Toplu Ders Programı Yapıştırma** — Üniversite tablosu yapıştır, AI 14 etkinliği tek seferde yerleştirir
- 💬 **Bağlamsal Sohbet** — Side panel chat, davranış verisini gören AI ile
- ⏰ **Erteleme Tespiti** — Görev saatinde distraction sitesindeysen avatar müdahale eder
- 📊 **Haftalık Davranış Raporu** — AI yorumlu heatmap, "salı sabah üretkensin, perşembe öğleden sonra dağılıyorsun"

---

## 🏗️ Teknoloji Yığını

| Katman | Tercih |
|--------|--------|
| Extension framework | WXT (Vite tabanlı) |
| Dil | TypeScript (strict) |
| UI | React 18 + Tailwind CSS 3 |
| State | Zustand + `chrome.storage.local` |
| AI | Gemini 2.5 Flash via `@google/genai` |
| Takvim | El yazımı CSS Grid |

---

## 🚀 Kurulum

### Gereksinimler

- Node.js ≥ 18
- Google AI Studio API anahtarı (ücretsiz tier yeterli) — https://aistudio.google.com/apikey adresinden alabilirsin

### Adımlar

```bash
# 1. Repo'yu klonla
git clone <repo-url>
cd planflow

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını aç ve API anahtarını yapıştır:
# WXT_GEMINI_API_KEY=your_key_here
```

---

## 🛠️ Çalıştırma

### Geliştirme modu (hot reload)

```bash
npm run dev
```

WXT otomatik olarak Chrome'u açar ve extension'ı yükler. Kod değişiklikleri canlı yansır.

### Production build

```bash
npm run build
```

Çıktı: `.output/chrome-mv3/` klasöründe unpacked extension.

### Chrome'a manuel yükleme

1. `chrome://extensions` adresine git
2. Sağ üstte **Geliştirici modu**'nu aç
3. **Paketlenmemiş öğe yükle** butonuna tıkla
4. `.output/chrome-mv3/` klasörünü seç
5. Araç çubuğundaki PlanFlow ikonuna tıkla → side panel açılır
6. Side panel'daki dashboard linkine tıkla → tam ekran takvim açılır

---

## 🔐 Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `WXT_GEMINI_API_KEY` | ✅ | Google Gemini API anahtarı |

> **Not:** WXT için `WXT_` prefix'i zorunludur — bu sayede değer runtime'da `import.meta.env` üzerinden okunabilir.

---

## 🎬 Demo Senaryoları

5 dakikalık demo videosu bu sırayla çekildi:

1. **Soğuk başlangıç** — Extension yüklenir, ikona tıklayınca side panel idle avatar ile açılır.
2. **Toplu yapıştırma** — Dashboard'a 14 satırlık ders programı yapıştırılır → AI tek seferde tüm etkinlikleri takvime yerleştirir.
3. **Tek komut** — "Akşam 8'den 10'a kadar rapor yaz" → pembe task block bu akşam 20:00-22:00'a düşer.
4. **Davranış takibi** — Birkaç dakikalık tarama (YouTube, GitHub, Twitter) → dashboard'da ısı haritası dolar.
5. **Müdahale (killer scene)** — Rapor görevi aktifken YouTube açılır, avatar tepeden iner, AI cümlesi söyler, "ok başlıyorum" tıklayınca dashboard görevi vurguyla açılır.
6. **Sohbet** — Side panel'da "bugün ne yapıyorum?" sorusu → AI hem görevlere hem davranışa referans veren cevap verir.
7. **Haftalık insight** — Dashboard'da AI yorumu kartı: "Bu hafta 8 saat YouTube, salı sabah üretken, perşembe öğleden sonra dağılıyorsun."

---

## 📁 Proje Yapısı

```
planflow/
├── entrypoints/
│   ├── background.ts          # Service worker: davranış takibi, alarmlar, müdahale dispatch
│   ├── content.ts             # Overlay enjeksiyonu (Shadow DOM + pointer-events)
│   ├── sidepanel/             # Avatar + chat UI
│   └── dashboard/             # Takvim + insight UI
├── src/
│   ├── lib/
│   │   ├── ai.ts              # Gemini client, function calling, system prompts
│   │   ├── storage.ts         # Typed chrome.storage.local wrapper
│   │   ├── tracking.ts        # Aktif sekme + süre matematiği
│   │   ├── intervention.ts    # Cooldown, distraction list, trigger logic
│   │   ├── calendar.ts        # Event tipleri, recurrence, "şimdi" lookup
│   │   └── insights.ts        # Haftalık agregasyon + AI yorumu
│   ├── components/            # Avatar, ChatBox, CalendarGrid, EventModal, Heatmap...
│   ├── state/                 # Zustand stores (tasks, chat, behavior)
│   └── types.ts               # Paylaşılan TS tipleri
├── public/avatar/             # idle-1/2.png, talk-1/2.png
└── wxt.config.ts              # Manifest config
```

---

## 🧩 Mimari Kararlar

- **AI çağrıları tek noktadan.** Tüm Gemini çağrıları `src/lib/ai.ts`'de; React bileşenleri SDK'yi doğrudan çağırmaz. Provider değişimi tek dosyalık iş.
- **Storage erişimleri tek noktadan.** Tüm `chrome.storage.local` erişimleri `src/lib/storage.ts`'den; tip güvenli get/set.
- **Function calling.** AI takvimi doğrudan editler (addEvent / addEvents / deleteEvent / updateEvent); raw text parse etmek yerine yapılandırılmış araç çağrıları.
- **Click-through overlay.** Shadow DOM + `pointer-events: none` kapsayıcı + avatar üzerinde `pointer-events: auto`. Host sayfanın CSS'i avatara, avatar host sayfaya dokunmaz.
- **Lokal-first veri.** Davranış verisi cihazdan dışarı çıkmaz; AI'a sadece agregeyi gönderiyoruz (ham URL ve geçmiş değil).

---

## ⚠️ Bilinen Sınırlar

- Sadece Chromium tabanlı tarayıcılar (Chrome, Edge, Brave). Firefox/Safari yok.
- Mobil yok (Chrome Android extension desteklemiyor).
- Tarayıcı dışındaki uygulamalardaki süreler takip edilmez (VS Code, Spotify desktop vb. extension'a görünmez).
- Distraction tespiti hardcoded liste tabanlı; AI ile bağlamsal tespit v2 roadmap'inde.

---

## 🗺️ Yol Haritası

Sonraki geliştirme öncelikleri (öncelik sırasına göre):

1. AI tabanlı bağlamsal distraction tespiti (kategori değil bağlam)
2. Davranışsal pattern öğrenimi (aylık/mevsimlik)
3. Obsidian / markdown not sistemleri ile iki yönlü sync
4. Google Calendar iki yönlü senkronizasyon
5. Mobil eşlik uygulaması (görev görüntüleme + bildirim)
6. Yerel LLM seçeneği (Ollama)

---

## 📜 Lisans

MIT
