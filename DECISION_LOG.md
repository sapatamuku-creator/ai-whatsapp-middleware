# 📜 DECISION LOG & ARCHITECTURE RECORD (ADR)
**Proyek:** AI WhatsApp Assistant & Automation Middleware (Knowhere Studio)  
**Root Repository:** `D:\Google Antigrafity\AI WhatsApp Assistant & Automation Client Database`  
**Server Directory:** `D:\Google Antigrafity\AI WhatsApp Assistant & Automation Client Database\server`  
**GitHub Repository:** `https://github.com/sapatamuku-creator/ai-whatsapp-middleware.git`  
**Deployment Platform:** Vercel Serverless Function  

---

## 📌 ADR-001: Arsitektur Hirarki Pesan Vercel Middleware + Groq Multi-Agent + Headless GAS

### 1. Konteks & Latar Belakang
Sistem membutuhkan AI WhatsApp Gateway yang:
- Responsif, berkecepatan tinggi (< 1 detik).
- Bebas dari kendala timeout 30 detik pada Google Apps Script.
- Bebas dari error kuota / 503 Service Unavailable pada model AI.
- Terintegrasi penuh 100% dengan Google Workspace (Google Sheets, Drive, Invoice PDF, Calendar).

---

### 2. Keputusan Hirarki Alur Pesan (Message Flow)

```
[ WhatsApp (Customer / Admin) ]
              │
              ▼
     [ Fonnte Gateway ]
              │ (Webhook POST & GET: /webhook/wa)
              ▼
[ Vercel Middleware (Groq Multi-Agent) ]  <── Pesan diproses oleh Groq AI di Vercel
              │
              ├─► Primary Agent: openai/gpt-oss-120b (Penalaran & Tool Calling)
              ├─► Failover 1:    qwen/qwen3.8-27b (Cadangan saat rate limit)
              ├─► Fast Agent:    openai/gpt-oss-20b (Chat cepat & sapaan)
              ├─► Voice Note:    whisper-large-v3-turbo (STT Transcriber)
              │
              ▼ (Hanya saat butuh aksi Database/Drive/Invoice/Calendar)
[ Headless Google Apps Script (GAS) ]
              │ (Mengembalikan hasil data terkompresi)
              ▼
[ Groq menyusun balasan & Vercel mengirim via Fonnte API ]
```

---

### 3. Keputusan Teknis Penting yang Diterapkan

#### A. Model Registry Terpusat (`src/models.js`)
- Semua daftar model Groq dipusatkan di `src/models.js`.
- Tidak ada *hardcode* nama model di file logika (`aiService.js`, `webhookController.js`, `index.js`).
- Maintenance atau penggantian model di masa depan cukup dilakukan dengan mengedit `src/models.js` atau menimpa variabel di Vercel tanpa perlu menyentuh logic code.

#### B. Anti-Error 413 & Smart Data Compression
- Saat memanggil fungsi data besar dari spreadsheet (seperti `getAllBookings`, `getUpcomingEvents`, `getMonthlyOmset`), fungsi `sanitizeAndCompressGasResult` otomatis merampingkan baris data hanya pada field esensial (`nama`, `tanggal`, `layanan`, `paket`, `harga`, `dpTotal`, `sisa`).
- Riwayat sesi percakapan menerapkan *Rolling Window* (maksimal 6–8 pesan terakhir) untuk menjaga request payload tetap ringan dan jauh di bawah batas limit Groq.

#### C. Vercel Serverless Freeze Prevention
- Pada lingkungan serverless Vercel, pemrosesan AI dan pengiriman pesan WhatsApp via Fonnte wajib di-`await` sebelum memanggil `res.status(200).json(...)`, agar runtime Node.js tidak di-*freeze* / dibekukan oleh Vercel.
- Endpoint `/webhook/wa` mendukung metode **POST** (penerimaan data pesan) dan **GET** (verifikasi webhook dari dashboard Fonnte).

#### D. Penanganan Multimodal (Voice Note & Foto Struk)
- **Voice Note (.ogg, .mp3, .wav, .m4a, .opus)**: Otomatis diunduh dan ditranskrip menggunakan Groq Whisper (`whisper-large-v3-turbo`) sebelum diproses oleh Primary Agent.
- **Foto Bukti Transfer**: URL gambar otomatis diteruskan ke parameter `bukti_url` pada tool `generatePdfInvoice` dan `updatePayment` agar GAS otomatis menyematkan foto ke Google Drive klien dan PDF invoice resmi.

---

### 4. Daftar Environment Variables Vercel

| Key | Deskripsi | Status |
| :--- | :--- | :--- |
| **`GROQ_API_KEY`** | API Key Groq dari console.groq.com (`gsk_...`) | **Wajib** |
| **`FONNTE_API_KEY`** | Token Device WhatsApp Fonnte | **Wajib** |
| **`GAS_WEBAPP_URL`** | URL Deployment Web App Google Apps Script | **Wajib** |
| **`GAS_API_SECRET`** | Secret Token pengaman Headless GAS (`knowhere_secret_2026`) | **Wajib** |
| `ADMIN_NUMBERS` | Nomor WhatsApp Admin (dipisahkan koma) | Opsional |
| `GROQ_MODEL` | Override model utama (Default: `openai/gpt-oss-120b`) | Opsional |
| `GROQ_BACKUP_MODEL`| Override model cadangan (Default: `qwen/qwen3.8-27b`) | Opsional |
| `GROQ_FAST_MODEL` | Override model cepat (Default: `openai/gpt-oss-20b`) | Opsional |
| `GROQ_VOICE_MODEL` | Override model voice note (Default: `whisper-large-v3-turbo`)| Opsional |

---

### 5. Panduan Maintenance & Git Workflow untuk Masa Depan

Jika di kemudian hari Anda bekerja langsung dari folder root:
`D:\Google Antigrafity\AI WhatsApp Assistant & Automation Client Database`

#### Cara Push Update Server ke Vercel:
```powershell
# Masuk ke folder server
cd server

# Lakukan git commit & push
git add .
git commit -m "update: perbaikan fitur"
git push origin main
```
*(Vercel akan otomatis mendeteksi push pada branch `main` dan me-redeploy server secara instan).*
