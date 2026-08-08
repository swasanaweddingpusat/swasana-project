import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { IconProps } from "@solar-icons/react";
import {
  CalendarDate,
  UsersGroupRounded,
  Wallet,
  Settings,
} from "@solar-icons/react";

type SolarIcon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

export interface TutorialStep {
  title: string;
  caption: string;
  /** Path screenshot di /public (mis. "/tutorial/booking/01-dashboard.png"). Kalau kosong, tampil placeholder. */
  image?: string;
}

export interface TutorialLesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  steps: TutorialStep[];
}

export interface TutorialCategory {
  id: string;
  name: string;
  icon: SolarIcon;
  lessons: TutorialLesson[];
}

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  {
    id: "booking",
    name: "Booking & Order",
    icon: CalendarDate,
    lessons: [
      {
        id: "booking-baru",
        title: "Cara Membuat Booking Baru",
        duration: "6 menit",
        completed: true,
        steps: [
          {
            title: "1. Buka Halaman Booking",
            caption: 'Klik menu "Booking Weddings" (atau "Booking MICE") di sidebar kiri. Halaman menampilkan tabel semua booking, dan di header kanan atas ada tombol "Tambah Booking".',
            image: "/tutorial/booking/01-dashboard.png",
          },
          {
            title: "2. Klik Tombol Tambah Booking",
            caption: 'Klik "Tambah Booking" di header. Drawer pembuatan booking muncul dari kanan, berupa wizard 4 langkah (lihat indikator "Step 1 / 4" di pojok kanan atas drawer).',
            image: "/tutorial/booking/02-drawer-step1.png",
          },
          {
            title: "3. Cari Customer yang Sudah Terdaftar",
            caption: 'Ketik nama di kolom "Customer Name". Sistem otomatis menampilkan saran customer yang sudah ada di database. Klik salah satu untuk mengisi otomatis email, NIK, alamat, dan nomor kontaknya.',
            image: "/tutorial/booking/03-customer-search.png",
          },
          {
            title: "4. Atau Tambah Customer Baru",
            caption: 'Kalau customer belum terdaftar, cukup ketik nama lengkapnya (mis. "Budi & Sari") tanpa memilih saran. Data customer baru akan otomatis tersimpan saat booking dibuat.',
            image: "/tutorial/booking/04-customer-new.png",
          },
          {
            title: "5. Tambah Nomor Kontak",
            caption: 'Pada "Contact Person", klik "Tambah Nomor". Isi label (mis. cpw, cpp, ortu) dan nomor HP/WA dengan awalan +62, lalu klik "Tambah". Bisa menambah lebih dari satu nomor.',
            image: "/tutorial/booking/05-contact-popover.png",
          },
          {
            title: "6. Pilih Venue",
            caption: 'Klik dropdown "Venue". Daftar venue muncul dan bisa diketik untuk mencari. Pilih venue tempat acara berlangsung. Setelah dipilih, daftar paket akan otomatis dimuat sesuai venue.',
            image: "/tutorial/booking/06-venue-select.png",
          },
          {
            title: "7. Pilih Paket",
            caption: 'Setelah venue dipilih, dropdown "Pilih Paket" aktif. Pilih paket yang ditawarkan — kalau paket punya beberapa tipe/varian, pilih juga variannya (lengkap dengan PAX & harga). Harga otomatis menyesuaikan.',
            image: "/tutorial/booking/07-venue-picked.png",
          },
          {
            title: "8. Lengkapi Detail Acara",
            caption: 'Isi sisa field wajib (*): Sumber Informasi, Tanggal Event (hanya tanggal yang tersedia bisa dipilih), Event Session (Pagi/Malam/Fullday), dan Event Type (Resepsi, Akad & Resepsi, dll). Lalu klik "Continue".',
            image: "/tutorial/booking/09-step1-filled.png",
          },
          {
            title: "9. Atur Kategori Harga (Step 2)",
            caption: 'Di langkah 2, tinjau kategori harga paket. Aktifkan toggle "takeout" pada kategori yang tidak diambil customer — harga akan otomatis dikurangi. Minimal satu kategori harus tetap aktif. Klik "Continue".',
          },
          {
            title: "10. Term of Payment (Step 3)",
            caption: 'Pilih metode pembayaran, lalu atur termin (Booking Fee, DP, Angsuran, Pelunasan). Booking Fee harus berstatus "Paid" dan total seluruh termin wajib sama persis dengan harga setelah diskon. Klik "Continue".',
          },
          {
            title: "11. Tanda Tangan & Simpan (Step 4)",
            caption: 'Isi "Lokasi Tanda Tangan", bubuhkan tanda tangan sales di kanvas, dan aktifkan e-Meterai bila perlu. Terakhir klik "Create New Booking". Booking baru muncul di tabel menunggu approval.',
          },
        ],
      },
      {
        id: "approval-flow",
        title: "Proses Approval Booking",
        duration: "3 menit",
        completed: true,
        steps: [
          {
            title: "Buka Detail Booking",
            caption: "Klik baris booking yang ingin di-approve di tabel. Panel detail akan terbuka di sisi kanan.",
          },
          {
            title: "Periksa Tab Approval",
            caption: 'Klik tab "Approval" di panel detail untuk melihat alur persetujuan yang berlaku untuk booking ini.',
          },
          {
            title: "Klik Setujui atau Tolak",
            caption: 'Klik tombol "Setujui" jika booking sudah sesuai, atau "Tolak" dengan mengisi alasan penolakan. Aksi ini bersifat permanen.',
          },
          {
            title: "Konfirmasi Aksi",
            caption: "Dialog konfirmasi akan muncul. Klik OK untuk melanjutkan. Notifikasi akan dikirim ke pihak terkait.",
          },
        ],
      },
      {
        id: "term-of-payment",
        title: "Edit Term of Payment",
        duration: "3 menit",
        completed: false,
        steps: [
          {
            title: "Buka Detail Booking",
            caption: "Klik baris booking yang ingin diedit. Pastikan booking masih dalam status yang mengizinkan perubahan.",
          },
          {
            title: "Pilih Tab Pembayaran",
            caption: 'Klik tab "Pembayaran" atau "Term of Payment" di panel detail booking.',
          },
          {
            title: "Edit Jadwal Pembayaran",
            caption: 'Klik tombol Edit lalu ubah persentase dan tanggal jatuh tempo tiap termin. Total harus mencapai 100%.',
          },
          {
            title: "Simpan Perubahan",
            caption: 'Klik "Simpan" untuk mengunci jadwal pembayaran baru. Perubahan akan langsung terlihat di laporan AR.',
          },
        ],
      },
    ],
  },
  {
    id: "crm",
    name: "CRM — Daily Activity & Quotation",
    icon: UsersGroupRounded,
    lessons: [
      {
        id: "tambah-lead",
        title: "Tambah Lead Baru",
        duration: "3 menit",
        completed: true,
        steps: [
          {
            title: "Buka Halaman Daily Activity",
            caption: 'Klik menu "Daily Activity" di sidebar kiri. Halaman akan menampilkan tabel lead beserta statusnya.',
          },
          {
            title: "Klik Tambah Lead",
            caption: 'Klik tombol "Tambah Lead" di kanan atas. Drawer input akan terbuka.',
          },
          {
            title: "Isi Data Prospek",
            caption: 'Lengkapi nama, nomor telepon, sumber informasi, dan tanggal acara estimasi. Pilih status awal lead (biasanya "Baru").',
          },
          {
            title: "Simpan Lead",
            caption: 'Klik "Simpan". Lead baru akan muncul di tabel dengan status awal dan timestamp pembuatan.',
          },
        ],
      },
      {
        id: "pipeline-lead",
        title: "Pindahkan Lead di Pipeline",
        duration: "2 menit",
        completed: false,
        steps: [
          {
            title: "Cari Lead di Tabel",
            caption: "Gunakan search box atau filter status untuk menemukan lead yang ingin diperbarui statusnya.",
          },
          {
            title: "Buka Detail Lead",
            caption: "Klik baris lead. Panel detail akan terbuka memperlihatkan seluruh informasi dan riwayat.",
          },
          {
            title: "Ubah Status Pipeline",
            caption: 'Di panel detail, klik dropdown "Status" lalu pilih status baru (mis. Prospecting → Negosiasi).',
          },
          {
            title: "Tambah Catatan (Opsional)",
            caption: "Tambahkan catatan perubahan di kolom komentar untuk merekam alasan atau hasil follow-up.",
          },
        ],
      },
      {
        id: "buat-quotation",
        title: "Buat Quotation dari Lead",
        duration: "5 menit",
        completed: false,
        steps: [
          {
            title: "Buka Detail Lead",
            caption: "Klik lead yang sudah siap masuk tahap penawaran harga.",
          },
          {
            title: "Klik Buat Quotation",
            caption: 'Klik tombol "Buat Quotation" di panel detail lead. Sistem akan membuka halaman Quotations dengan data lead ter-pre-fill.',
          },
          {
            title: "Pilih Paket & Harga",
            caption: "Pilih paket yang akan ditawarkan, atur harga, dan sesuaikan item-item yang disertakan dalam penawaran.",
          },
          {
            title: "Preview Quotation",
            caption: 'Klik "Preview" untuk melihat tampilan dokumen quotation sebelum dikirim ke customer.',
          },
          {
            title: "Kirim atau Simpan Draft",
            caption: 'Klik "Kirim ke Customer" untuk mengirim via email, atau "Simpan Draft" untuk finalisasi nanti.',
          },
        ],
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    icon: Wallet,
    lessons: [
      {
        id: "catat-pembayaran",
        title: "Catat Pembayaran Customer",
        duration: "3 menit",
        completed: false,
        steps: [
          {
            title: "Buka Accounts Receivable",
            caption: 'Klik menu "Finance" lalu pilih "Accounts Receivable" di submenu sidebar.',
          },
          {
            title: "Cari Booking yang Dibayar",
            caption: "Gunakan search box atau filter untuk menemukan booking dengan termin yang jatuh tempo.",
          },
          {
            title: "Klik Catat Pembayaran",
            caption: 'Klik ikon atau tombol "Catat Bayar" di baris termin yang bersangkutan. Form input akan muncul.',
          },
          {
            title: "Isi Detail Pembayaran",
            caption: "Masukkan tanggal bayar, jumlah, metode pembayaran, dan nomor referensi transfer. Upload bukti transfer jika ada.",
          },
          {
            title: "Konfirmasi Pembayaran",
            caption: 'Klik "Simpan". Status termin akan berubah menjadi "Lunas" dan saldo AR akan terupdate otomatis.',
          },
        ],
      },
      {
        id: "lihat-ar",
        title: "Lihat Laporan Accounts Receivable",
        duration: "2 menit",
        completed: false,
        steps: [
          {
            title: "Buka Halaman AR",
            caption: 'Navigasi ke Finance → Accounts Receivable. Tabel akan memperlihatkan semua piutang aktif.',
          },
          {
            title: "Filter Periode",
            caption: "Gunakan filter tanggal di atas tabel untuk melihat AR pada rentang waktu tertentu.",
          },
          {
            title: "Ekspor Laporan",
            caption: 'Klik tombol "Ekspor" di kanan atas untuk mengunduh data AR dalam format Excel.',
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    name: "Pengaturan Sistem",
    icon: Settings,
    lessons: [
      {
        id: "kelola-user-role",
        title: "Kelola User & Role",
        duration: "4 menit",
        completed: false,
        steps: [
          {
            title: "Buka Settings → Users",
            caption: 'Klik menu "Settings" di sidebar lalu pilih "Users". Tabel user aktif akan ditampilkan.',
          },
          {
            title: "Undang User Baru",
            caption: 'Klik "Undang User". Masukkan email dan pilih role. Sistem akan mengirim email undangan otomatis.',
          },
          {
            title: "Kelola Role & Permission",
            caption: 'Pergi ke Settings → Roles. Klik role yang ingin diedit untuk melihat dan mengubah daftar permission yang dimiliki.',
          },
          {
            title: "Aktifkan atau Nonaktifkan User",
            caption: "Klik nama user di tabel untuk membuka detail. Toggle status Aktif/Nonaktif di panel kanan.",
          },
        ],
      },
      {
        id: "atur-venue-paket",
        title: "Atur Venue & Paket",
        duration: "4 menit",
        completed: false,
        steps: [
          {
            title: "Buka Settings → Venues",
            caption: 'Navigasi ke Settings → Venue Management. Daftar venue terdaftar akan tampil.',
          },
          {
            title: "Tambah atau Edit Venue",
            caption: 'Klik "Tambah Venue" untuk venue baru, atau klik nama venue untuk mengedit kapasitas, alamat, dan brand mapping.',
          },
          {
            title: "Kelola Paket Wedding",
            caption: 'Pergi ke menu "Packages" di sidebar. Klik "Tambah Paket" untuk membuat paket baru dengan harga dan item.',
          },
          {
            title: "Set Status Paket",
            caption: 'Klik paket yang ingin diaktifkan/dinonaktifkan. Toggle "Status Aktif" di panel detail. Paket nonaktif tidak muncul saat pembuatan booking.',
          },
        ],
      },
    ],
  },
];
