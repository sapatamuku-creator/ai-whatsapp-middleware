# 🚀 AI WhatsApp Assistant & Automation Middleware (Knowhere Studio)

Middleware server independen yang bertindak sebagai **AI Gateway** untuk menghubungkan WhatsApp (via Fonnte Gateway) dengan Google Workspace (Google Sheets, Google Drive, Google Docs, & Google Calendar).

---

## 🌟 Fitur Utama

1. **Multimodal Vision OCR Otomatis (Gemini 2.5 Flash)**:
   - Membaca foto struk transfer bank (BCA, Mandiri, BRI, BNI, QRIS) secara otomatis.
   - Mengekstrak nominal, nama pengirim/penerima, dan jam tanpa perlu mengetik caption.
2. **Agentic Tool / Function Calling**:
   - AI otomatis menentukan kapan harus mencatat pembayaran (`updatePayment`), membuat PDF invoice (`generatePdfInvoice`), atau mengecek jadwal (`checkBookingConflict`).
3. **Anti-Timeout (<50ms Acknowledge)**:
   - Webhook Fonnte langsung dibalas HTTP 200 seketika, seluruh proses AI & Google Workspace berjalan asinkron di background.
4. **Deploy Siap Pakai di Vercel (Gratis)**:
   - Dilengkapi file konfigurasi `vercel.json` untuk deployment 1 klik ke Vercel Serverless.

---

## 🛠️ Panduan Instalasi & Menjalankan Lokal

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Konfigurasi Environment Variables (`.env`)
Salin `.env.example` menjadi `.env`:
```env
PORT=3000

# API Key Google Gemini (Dapatkan gratis di https://aistudio.google.com/)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash

# Token Fonnte WhatsApp
FONNTE_API_KEY=your_fonnte_token_here
ADMIN_NUMBERS=6282214578132

# URL Web App Google Apps Script (Headless)
GAS_WEBAPP_URL=https://script.google.com/macros/s/AKfycb.../exec
GAS_API_SECRET=knowhere_secret_2026
```

### 3. Jalankan Server
```bash
npm start
# Atau mode dev (auto-reload):
npm run dev
```

---

## ☁️ Panduan Deploy ke Vercel (Production)

1. Upload / Push repository ini ke **GitHub**.
2. Buka [Vercel Dashboard](https://vercel.com) $\rightarrow$ **Add New Project** $\rightarrow$ Pilih repositori ini.
3. Set **Root Directory** ke folder `server`.
4. Masukkan **Environment Variables** (`GEMINI_API_KEY`, `FONNTE_API_KEY`, `GAS_WEBAPP_URL`, `GAS_API_SECRET`, `ADMIN_NUMBERS`).
5. Klik **Deploy**!
6. Anda akan mendapatkan URL Vercel publik (contoh: `https://knowhere-ai.vercel.app`).
7. Buka [Fonnte.com](https://fonnte.com) $\rightarrow$ **Webhook** $\rightarrow$ Pasang URL:
   `https://knowhere-ai.vercel.app/webhook/wa`

---

## 🧪 Endpoint Pengujian Langsung (Debug)

- **Health Check**: `GET /health`
- **Uji Chat AI Tanpa WA**:
  ```bash
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "cek status pembayaran Kinnas ID"}'
  ```
- **Uji Foto Struk Transfer**:
  ```bash
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"mediaUrl": "https://url-gambar-struk.jpg", "isImage": true}'
  ```
