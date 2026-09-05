# 🔍 AUDIT & DEBUGGING PASCA DEPLOY
**Proyek:** AI WhatsApp Assistant & Automation Middleware (Knowhere Studio)  
**Tanggal Mulai Audit:** 5 September 2026  
**Referensi Commit Terakhir:** `202c2a1` (*feat: access control, booking whitelist, and headless tool isolation*)  
**Status Eksekusi:** ✅ **DEPLOYED TO VERCEL** (Commit `202c2a1` telah dipush ke branch `main`)

---

## 📋 Ikhtisar & Tujuan Audit
Dokumen ini mencatat seluruh temuan, anomali, evaluasi akses, dan penyempurnaan fitur pasca deploy sistem middleware WhatsApp AI (Vercel + Groq Multi-Agent + Headless GAS).

Setiap poin yang disampaikan oleh user dicatat secara bertahap, dianalisis akar penyebabnya (*root cause*), dan dirumuskan spesifikasi solusinya ke dalam dokumen ini tanpa langsung memodifikasi *codebase* produksi.

---

## 📝 Rekapitulasi Temuan Lapangan

| No | Komponen / Area | Temuan / Gejala Masalah | Tingkat Urgensi | Status |
|---|---|---|---|---|
| **01** | **Gateway Security & Access Control** (`webhookController.js`) | Bot merespon semua nomor publik tanpa filter; tidak ada pembatasan nomor pribadi vs nomor publik, dan tidak ada filter jam operasional kerja admin (07.00–17.00 vs 17.00–07.00 WIB). | 🔴 **Kritis (High Priority)** | 📋 **Tercatat & Teranalisis** (Menunggu poin berikutnya) |

---

## 🔬 Detail Temuan #01: Kebocoran Akses Bot & Ketiadaan Filter Whitelist/Blacklist

### 1. Deskripsi Permasalahan
- **Nomor Admin Terdaftar:**
  - Nomor Pribadi Super Admin: `6282214578132`
  - Nomor Admin Vendor (Device Fonnte Bot): `6287864752163`
- **Gejala Lapangan:**
  - Siapapun (selain nomor pribadi) yang mengirim chat ke nomor admin vendor langsung direspon oleh Bot AI.
  - Bot belum mengenali apakah pengirim adalah pemilik pribadi (super admin) atau klien luar.
  - Belum ada pembagian jam operasional: bot tetap membalas di jam kerja admin manusia, yang berpotensi menimbulkan tabrakan respon antara admin dan AI.

---

### 2. Analisis Akar Masalah (*Root Cause*) pada Codebase
1. **Tidak Ada Gatekeeper Validasi Nomor di `src/controllers/webhookController.js`:**
   - Pada baris 52–61, webhook langsung memanggil `processMessageWithAI` dan `sendWhatsAppMessage` untuk setiap `cleanSender` yang masuk tanpa memeriksa apakah pengirim masuk ke dalam whitelist atau blacklist.
2. **Ketiadaan Engine Pengecekan Waktu (Time-Window Filter):**
   - Serverless function belum memiliki utility untuk membaca waktu lokal WIB (`Asia/Jakarta`) guna menentukan apakah request masuk di jam kerja admin (07.00–17.00) atau di luar jam kerja (17.00–07.00).
3. **Single System Prompt Universal:**
   - Saat ini `src/services/aiService.js` hanya memiliki 1 persona `SYSTEM_PROMPT` yang mengekspos semua tools (termasuk `getMonthlyOmset`, `addBooking`, `getAllBookings`, dll.) kepada siapapun yang bertanya.
4. **Belum Ada Guardrail Klien & Footer Bot:**
   - Belum ada proteksi privacy leak (mencegah data nama/paket klien lain terbaca publik).
   - Belum ada footer otomatis penanda identitas bot `(NOVA AGENT)`.

---

### 3. Spesifikasi Aturan Baru (Whitelist & Blacklist Policy)

#### A. Matriks Hak Akses & Jam Operasional

| Kategori Pengirim | Jam Operasional | Perilaku Bot AI | Lingkup / Konteks Respon |
|---|---|---|---|
| **Nomor Pribadi Super Admin**<br>`6282214578132` | **24 Jam Non-Stop** | 🟢 **Aktif Penuh** | **Bebas tanpa batasan konteks** (Full admin access, tool database, omset, booking, invoice, testing). |
| **Publik / Klien Luar**<br>*(Semua nomor selain nomor pribadi)* | **Jam Kerja Admin**<br>**07.00 – 17.00 WIB** | ⛔ **BLACKLIST (SILENT)** | **AI DILARANG MEMBALAS**. Chat masuk diabaikan oleh AI (status 200 silent drop, tanpa kirim WA) karena area ini sepenuhnya ditangani oleh Admin Manusia secara langsung. |
| **Publik / Klien Luar**<br>*(Semua nomor selain nomor pribadi)* | **Luar Jam Kerja Admin**<br>**17.00 – 07.00 WIB** | 🟡 **WHITELIST (GUARDED)** | **AI Aktif Terbatas** dengan batasan ketat sesuai pedoman whitelist di bawah. |

---

#### B. Aturan Filter Mode Publik (Luar Jam Kerja 17.00 – 07.00 WIB)

1. **Topik yang Diizinkan (Whitelist Scope):**
   - **Pricelist Resmi**: Bot hanya boleh memberikan informasi harga & paket berdasarkan katalog yang ter-hardcode di kode.
   - **Tautan Resmi**: Jika klien menanyakan detail salah satu paket, wajib berikan link pricelist resmi:
     > `https://sapatamu.id/vendor/knowhere-studio`  
     *(Sampaikan bahwa produk dan keterangan lengkap sudah tertera jelas di link tersebut).*
   - **Formulir Pemesanan Slot & Syarat DP**:
     - Jika klien ingin memesan/booking slot, bot wajib memberikan template formulir pemesanan:
       ```
       📋 *FORMULIR PEMESANAN SLOT KNOWHERE STUDIO*
       Silakan lengkapi data berikut:
       - Nama Lengkap:
       - Nomor WhatsApp:
       - Jenis Acara (Wedding / Prewedding / Engagement / dll):
       - Paket yang Dipilih:
       - Tanggal Acara:
       - Waktu / Jam Acara:
       - Lokasi / Venue Acara:
       - Catatan Khusus:
       ```
     - Syarat Penguncian Slot: Klien **wajib membayarkan DP sebesar Rp 500.000** ke salah satu rekening resmi:
       - 🏦 **BCA: 7746263472** a/n **Gildan Novianto Syahrir Sobirin**
       - 🏦 **BRI: 428201014655530** a/n **Gildan novianto Syahrir S.**
     - Klien diminta mengirimkan formulir yang telah diisi beserta foto bukti transfer DP ke chat WhatsApp.
   - **Pengecekan Slot Tanggal**:
     - Kapasitas slot: Maksimal **2 event per 1 hari**.
     - Jika klien bertanya ketersediaan tanggal, berikan estimasi ramah dan ingatkan bahwa slot resmi dikunci setelah pengisian formulir & pembayaran DP Rp 500.000.
   - **Rekomendasi Best Seller**:
     - Rekomendasikan paket terlaris yang paling sering dipilih klien (untuk Wedding: paket **Premium** dan **Basic 2**).
   - **Wajib Footer**:
     - Setiap balasan yang dikirim ke nomor publik wajib menyematkan footer penanda bot:  
       `\n\n_(NOVA AGENT)_`

2. **Larangan Keras (Blacklist Guardrails & Headless Isolation):**
   - 🚫 **DILARANG memberikan akses Headless Actions ke Publik**: Klien publik **TIDAK DIBERIKAN AKSES** untuk memanggil tool `addBooking`, `updatePayment`, `generatePdfInvoice`, atau aksi database lainnya. Panggilan aksi headless **100% EKSKLUSIF HANYA UNTUK NOMOR PRIBADI SUPER ADMIN (`6282214578132`)**.
   - 🚫 **Alur Setelah Klien Mengisi Formulir & Bayar DP**:
     - Bot **DILARANG** langsung mengeksekusi `addBooking` ke spreadsheet.
     - Bot **WAJIB MENGIRIM NOTIFIKASI** ke nomor pribadi Super Admin (`6282214578132`) via WhatsApp berisi data formulir dan link/status bukti transfer agar ditinjau oleh Super Admin.
     - Balasan ke klien publik wajib sopan dan ramah:
       > *"Terima kasih sudah melakukan pemesanan ke Knowhere Studio! Data Anda telah kami terima dan akan diverifikasi serta di-input oleh admin kami di jam kerja operasional."* + footer `\n\n_(NOVA AGENT)_`.
   - 🚫 **DILARANG KERAS improvisasi harga** atau membuat skema paket kustom (*custom bundle*). Wajib tunduk 100% pada pricelist yang ada beserta tautan resminya.
   - 🚫 **DILARANG membocorkan data pemesan lain**: Tidak boleh menyebutkan nama pemesan, rincian biaya, atau paket yang diambil oleh pemesan lain.
   - 🚫 **DILARANG berdiskusi di luar lingkup whitelist**: Jika ada pertanyaan di luar konteks atau negosiasi, bot menjawab sopan:
     > *"Untuk hal ini mohon ditunggu ya kak, akan didiskusikan dan dijawab langsung oleh admin kami saat jam operasional."*

---

### 4. Rencana Tindakan Teknis (*Action Plan*)

1. **Konfigurasi (`src/config.js`):**
   - Definisikan nomor admin:
     - `PERSONAL_ADMIN_NUMBER = '6282214578132'`
     - `VENDOR_ADMIN_NUMBER = '6287864752163'`
   - Parameter rekening resmi (BCA 7746263472 & BRI 428201014655530 a/n Gildan).
   - Parameter jam kerja WIB (`07:00` s/d `17:00`).

2. **Modul Helper Waktu (`src/utils/timeHelper.js`):**
   - Menghitung jam saat ini dalam timezone Indonesia Barat (`Asia/Jakarta`).
   - Fungsi: `isWorkingHoursWIB()` (return `true` jika 07.00–16.59 WIB, `false` jika 17.00–06.59 WIB).

3. **Gerbang Webhook (`src/controllers/webhookController.js`):**
   - **Step 1:** Cek apakah `cleanSender === PERSONAL_ADMIN_NUMBER`.
     - Jika YA ➔ Proses 24/7 Mode Super Admin tanpa filter konteks (Full Headless Access).
   - **Step 2:** Jika BUKAN nomor pribadi:
     - Periksa `isWorkingHoursWIB()`.
     - Jika jam 07.00–17.00 WIB (Jam Kerja) ➔ **Silent drop** (log aktivitas, return HTTP 200 tanpa kirim balasan Fonnte).
     - Jika jam 17.00–07.00 WIB (Luar Jam Kerja) ➔ Teruskan ke AI dengan `isAdmin = false`.

4. **Pembagian Persona & Tool Scoping (`src/services/aiService.js`):**
   - Mode Admin (`isAdmin = true`): Menggunakan `SYSTEM_PROMPT_ADMIN` + Full Tools (`addBooking`, `updatePayment`, `generatePdfInvoice`, dll.).
   - Mode Publik (`isAdmin = false`):
     - Menggunakan `SYSTEM_PROMPT_PUBLIC` + Katalog Hardcoded + Info Rekening Gildan + Template Formulir.
     - **Zero Headless GAS Tools (`tools = []`)**: Tidak ada akses ke Google Spreadsheet / Drive secara langsung.
     - Deteksi pengiriman formulir / bukti transfer DP: Otomatis mengirim pesan WhatsApp notifikasi ke nomor pribadi Super Admin (`6282214578132`) via `sendWhatsAppMessage`.
     - Mengembalikan pesan ucapan terima kasih ramah + footer `\n\n_(NOVA AGENT)_`.

---

## 📌 Log Keputusan & Status

- [x] Inisialisasi folder audit & template (`2026-09-05 06:28 WIB`).
- [x] **Poin 1 Tercatat & Dianalisis:** Spesifikasi Whitelist/Blacklist Pengirim & Pembagian Jam Kerja WIB (`2026-09-05 06:55 WIB`).
- [x] **Poin 2 Disempurnakan:** Whitelist Formulir Booking, DP Rp 500rb Rekening Gildan, Isolasi Headless Khusus Super Admin, & Notifikasi ke Nomor Pribadi (`2026-09-05 07:08 WIB`).
- [x] **Implementasi & Deploy Selesai:** Kode telah lolos seluruh unit test dan berhasil di-deploy ke Vercel via commit `202c2a1` (`2026-09-05 07:12 WIB`).
- [x] Menunggu evaluasi pengujian live WhatsApp atau temuan audit berikutnya dari user.
