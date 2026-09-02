/**
 * Tool Declarations for Gemini Function Calling
 */

const toolDeclarations = [
  {
    name: "addBooking",
    description: "Menambahkan booking baru klien ke database spreadsheet, Google Calendar, dan Google Drive. Otomatis memeriksa konflik tanggal.",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien atau nama pengantin (contoh: 'Widya Dela Putri')" },
        groom: { type: "STRING", description: "Nama pengantin pria / Groom (opsional)" },
        bride: { type: "STRING", description: "Nama pengantin wanita / Bride (opsional)" },
        tanggal: { type: "STRING", description: "Tanggal acara format DD/MM/YYYY atau teks (contoh: '23/09/2026' atau '23 September 2026')" },
        waktu: { type: "STRING", description: "Waktu/jam acara (contoh: '08.00 - 16.00')" },
        lokasi: { type: "STRING", description: "Lokasi / venue acara" },
        layanan: { type: "STRING", description: "Jenis layanan (Wedding Day / Prewedding / Engagement / Siraman / Unduh Mantu / Photobooth)" },
        paket: { type: "STRING", description: "Nama paket (contoh: 'Noer Basics 2', 'Cinematic Wedding', 'Prewedding Deluxe')" },
        harga: { type: "NUMBER", description: "Total harga paket dalam angka bulat (contoh: 2900000)" },
        dp1: { type: "NUMBER", description: "Nominal DP pertama yang masuk (contoh: 500000)" },
        catatan: { type: "STRING", description: "Catatan tambahan untuk acara" }
      },
      required: ["nama", "tanggal", "paket", "harga"]
    }
  },
  {
    name: "updatePayment",
    description: "Mencatat pembayaran DP baru (DP1, DP2, DP3, DP4) atau pelunasan untuk klien yang sudah ada di database.",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien yang melakukan pembayaran" },
        nominal: { type: "NUMBER", description: "Nominal pembayaran dalam angka bulat (contoh: 500000)" },
        stage: { type: "STRING", description: "Tahap pembayaran: 'dp1', 'dp2', 'dp3', 'dp4', atau 'pelunasan'" },
        catatan: { type: "STRING", description: "Catatan atau keterangan pembayaran (misal nama rekening pengirim)" },
        bukti_url: { type: "STRING", description: "URL bukti transfer yang diunggah" }
      },
      required: ["nama", "nominal"]
    }
  },
  {
    name: "getPaymentSummary",
    description: "Mengecek status rincian pembayaran klien (total harga, rincian DP1-DP4, total DP masuk, sisa tagihan, link PDF invoice, dan link folder Drive).",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien yang ingin dicek pembayarannya" }
      },
      required: ["nama"]
    }
  },
  {
    name: "generatePdfInvoice",
    description: "Membuat dokumen PDF Invoice resmi berstempel dan berlogo Knowhere Studio, menyisipkan foto bukti transfer, menyimpan ke Google Drive, dan mengembalikan link download.",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien yang ingin dibuatkan invoicenya" },
        bukti_url: { type: "STRING", description: "URL foto bukti transfer dari WhatsApp atau Google Drive (opsional)" }
      },
      required: ["nama"]
    }
  },
  {
    name: "getBookingByName",
    description: "Mencari data detail booking klien berdasarkan nama.",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien yang dicari" }
      },
      required: ["nama"]
    }
  },
  {
    name: "getAllBookings",
    description: "Mengambil seluruh daftar booking yang ada di database spreadsheet.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "checkBookingConflict",
    description: "Mengecek ketersediaan tanggal dan apakah ada jadwal booking lain yang bentrok pada tanggal tersebut.",
    parameters: {
      type: "OBJECT",
      properties: {
        tanggal: { type: "STRING", description: "Tanggal yang ingin dicek (format DD/MM/YYYY atau '23 September 2026')" }
      },
      required: ["tanggal"]
    }
  },
  {
    name: "getMonthlyOmset",
    description: "Menghitung laporan keuangan, total omset masuk, piutang tersisa, dan jumlah klien pada bulan & tahun tertentu.",
    parameters: {
      type: "OBJECT",
      properties: {
        bulan: { type: "STRING", description: "Nama bulan (Januari - Desember) atau angka 1-12" },
        tahun: { type: "NUMBER", description: "Tahun (contoh: 2026)" }
      }
    }
  },
  {
    name: "getUnpaidClients",
    description: "Mengambil daftar seluruh klien yang masih memiliki sisa piutang / pembayaran belum lunas.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },
  {
    name: "getUpcomingEvents",
    description: "Melihat daftar acara dan jadwal liputan yang akan datang dalam X hari ke depan (default 30 hari).",
    parameters: {
      type: "OBJECT",
      properties: {
        days: { type: "NUMBER", description: "Jumlah hari ke depan (contoh: 7, 14, 30)" }
      }
    }
  },
  {
    name: "syncGoogleCalendar",
    description: "Menyinkronkan jadwal acara klien ke Google Calendar Knowhere Studio.",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien yang ingin disinkronkan ke kalender" }
      },
      required: ["nama"]
    }
  },
  {
    name: "createClientDriveFolder",
    description: "Membuat struktur folder Google Drive lengkap untuk klien (Raw Photos, Edited Photos, Video Cinematic, Invoice & Contract).",
    parameters: {
      type: "OBJECT",
      properties: {
        nama: { type: "STRING", description: "Nama klien" }
      },
      required: ["nama"]
    }
  }
];

// Konversi toolDeclarations ke format standard OpenAI/Groq Tool Calling
const groqTools = toolDeclarations.map(t => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties || {}).map(([k, v]) => [
          k,
          {
            type: (v.type || 'string').toLowerCase(),
            description: v.description
          }
        ])
      ),
      required: t.parameters.required || []
    }
  }
}));

module.exports = { toolDeclarations, groqTools };

