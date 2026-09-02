# 🚀 PANDUAN DEPLOY & GIT WORKFLOW
**AI WhatsApp Assistant & Automation Middleware (Knowhere Studio)**

Panduan praktis untuk melakukan push update, deployment ke Vercel, dan pemeliharaan model AI.

---

## 📂 1. Cara Push Update dari Folder Root

Jika Anda membuka terminal langsung dari folder utama:
`D:\Google Antigrafity\AI WhatsApp Assistant & Automation Client Database`

### Perintah Cepat (3 Baris):
```powershell
# 1. Masuk ke subfolder server
cd server

# 2. Stage dan Commit perubahan
git add .
git commit -m "update: deskripsi perubahan fitur"

# 3. Push ke GitHub (Vercel otomatis deploy)
git push origin main
```

*(Setelah perintah `git push` selesai, Vercel akan otomatis mendeteksi perubahan pada branch `main` dan memperbarui server dalam waktu ~10–15 detik tanpa perlu tindakan manual).*

---

## ⚙️ 2. Daftar Environment Variables di Vercel

Pastikan variabel-variabel berikut sudah terisi di **Vercel Project Settings** > **Environment Variables**:

| Variable (Key) | Nilai / Format | Keterangan |
| :--- | :--- | :--- |
| **`GROQ_API_KEY`** | `gsk_...` | **Wajib** — API Key dari [console.groq.com/keys](https://console.groq.com/keys) |
| **`FONNTE_API_KEY`** | `og6rw79Ayo...` | **Wajib** — Token Device WhatsApp dari Fonnte |
| **`GAS_WEBAPP_URL`** | `https://script.google.com/macros/s/.../exec` | **Wajib** — URL Web App Google Apps Script |
| **`GAS_API_SECRET`** | `knowhere_secret_2026` | **Wajib** — Token otorisasi ke Google Apps Script |
| `ADMIN_NUMBERS` | `6287864752163,6282214578132` | Nomor WhatsApp Admin |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | *(Opsional)* Override model utama |
| `GROQ_BACKUP_MODEL`| `qwen/qwen3.8-27b` | *(Opsional)* Override model cadangan |
| `GROQ_FAST_MODEL` | `openai/gpt-oss-20b` | *(Opsional)* Override model cepat |
| `GROQ_VOICE_MODEL` | `whisper-large-v3-turbo` | *(Opsional)* Override model Voice Note |

---

## 🔗 3. Pengaturan Webhook di Fonnte

1. Login ke [Dashboard Fonnte](https://md.fonnte.com/).
2. Buka menu **Device** > pilih device WhatsApp Anda > klik **Edit**.
3. Di kolom **`Webhook ?`** (paling atas), masukkan URL Vercel Anda:
   ```
   https://NAMA-PROJECT-ANDA.vercel.app/webhook/wa
   ```
4. Simpan konfigurasi.

---

## 🧠 4. Cara Mengganti / Maintenance Model AI di Masa Depan

Jika di kemudian hari Groq merilis model baru atau Anda ingin mengganti model yang digunakan, Anda **TIDAK PERLU merombak kode logika**:

### Cara A (Via Kode - 1 Tempat Terpusat):
Buka file [`src/models.js`](file:///d:/Google%20Antigrafity/AI%20WhatsApp%20Assistant%20&%20Automation%20Client%20Database/server/src/models.js) dan ubah nama model pada bagian `MODEL_REGISTRY`:
```javascript
const MODEL_REGISTRY = {
  PRIMARY_MODEL: 'openai/gpt-oss-120b', // Ganti model utama di sini
  BACKUP_MODEL: 'qwen/qwen3.8-27b',     // Ganti model backup di sini
  ...
};
```
Lalu lakukan `git commit` & `git push`.

### Cara B (Langsung dari Dashboard Vercel Tanpa Buka Kode):
1. Buka **Vercel** > **Project Settings** > **Environment Variables**.
2. Ubah nilai `GROQ_MODEL` menjadi nama model baru yang Anda inginkan.
3. Masuk ke tab **Deployments** > klik titik tiga di deployment teratas > pilih **Redeploy**.

---

## 🔍 5. Cara Memantau Log Real-Time (Debugging)

1. Buka dashboard project Anda di [vercel.com](https://vercel.com).
2. Masuk ke tab **"Logs"** (Runtime Logs).
3. Anda dapat melihat secara langsung setiap pesan WhatsApp yang masuk dari pelanggan, eksekusi tool ke Google Spreadsheet/Drive, dan respon balasan AI secara *real-time*.
