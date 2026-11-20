# IngatJadwal

## Mengaktifkan Web Push

1. Dari folder `app`, tautkan CLI ke project Supabase IngatJadwal. Jalankan
   `npx supabase db push --dry-run --remote` dan tinjau migration yang tertunda,
   termasuk `202611210004_web_push.sql`. Setelah target dan daftar migration benar,
   jalankan `npx supabase db push --remote`.
2. Setelah `npm ci`, jalankan `npx web-push generate-vapid-keys` satu kali.
   Pada Web Service dan proses terjadwal, atur `PUBLIC_VAPID_KEY` ke kunci publik,
   `VAPID_PRIVATE_KEY` ke kunci privat, dan `VAPID_SUBJECT` ke alamat kontak
   seperti `mailto:admin@example.com`. Simpan kunci privat di environment hosting.
   Gunakan pasangan kunci yang sama di kedua proses dan pertahankan saat redeploy.
3. Buat proses terjadwal dari repo dan folder aplikasi yang sama dengan Web Service.
   Gunakan build command `npm ci`, jadwal `*/5 * * * *`, dan perintah
   `node scripts/send-reminder-push.mjs`. Isi `DATABASE_URL` pada proses terjadwal
   dengan URL koneksi PostgreSQL untuk project yang sama. Akun database job perlu akses
   ke tabel pengingat dan perangkat. Web Service tidak memerlukan URL database ini.
4. Buka aplikasi melalui HTTPS, masuk, lalu buka **Pengingat → Notifikasi perangkat**.
   Klik **Aktifkan notifikasi**, setujui izin, lalu klik **Kirim notifikasi tes**.
   Di iPhone dan iPad, tambahkan IngatJadwal ke Home Screen lalu buka aplikasi dari sana.

Push Hari H mulai dikirim pukul 07.00 WIB untuk sesi yang belum mulai. H-1 dan H-2
mengikuti waktu jatuh tempo pengingat. Satu proses dapat menggabungkan beberapa
pengingat menjadi satu notifikasi per perangkat. Klik notifikasi untuk membuka menu
Pengingat. Untuk perangkat bersama, nonaktifkan notifikasi sebelum berganti akun.

Aplikasi web SvelteKit untuk manajemen jadwal terapi dan reminder tindak lanjut pasien. Stack mengikuti BookingRame: SvelteKit, Svelte 5, TypeScript, Tailwind CSS 4, Node.js, dan Supabase PostgreSQL.

## Menjalankan Supabase lokal

Prasyarat: Node.js 24+, npm, Supabase CLI, dan Docker Desktop aktif.

```sh
npx supabase start
npx supabase db reset
```

Tambahkan `PUBLIC_SUPABASE_URL` dan `PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari output CLI ke `.env` lokal. Jika `.env` sudah ada, pertahankan isinya. `DATABASE_URL` hanya dipakai di server untuk migration langsung, bukan dikirim ke browser. Jalankan aplikasi:

```sh
npm install
npm run dev
```

Setelah `npm run build`, jalankan `npm run preview` untuk pratinjau production lokal. Perintah preview memuat `.env` yang sama seperti mode development. Pada deployment, atur `PUBLIC_SUPABASE_URL` dan `PUBLIC_SUPABASE_PUBLISHABLE_KEY` melalui environment platform.

Buka `http://127.0.0.1:5174`. Daftar akun petugas, lalu buat fasilitas pertama. Akun pertama membuat fasilitas dan membership owner melalui RPC terkontrol.

## Menautkan project Supabase hosted

Buat project Supabase khusus IngatJadwal. Jangan gunakan project atau `.env` BookingRame.

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Migration awal juga dapat diterapkan langsung lewat `DATABASE_URL` dengan `npm run db:push:direct`. Script menormalisasi karakter khusus di user/password hanya dalam memori, memakai transaksi, menolak schema `public` yang sudah berisi objek aplikasi, lalu mencatat migration di ledger Supabase.

Isi URL project dan `sb_publishable_...` key ke `.env` lokal atau environment variables deployment. URL project dapat diturunkan dari host database; publishable key perlu diambil dari Settings > API Keys. Jangan memakai legacy anon/service-role keys. Secret key tidak diperlukan untuk alur aplikasi.

## Fitur saat ini

- Autentikasi email/password melalui Supabase Auth.
- Onboarding fasilitas dan membership role owner.
- Data fasilitas terisolasi oleh RLS.
- Daftar pasien dan jadwal sesi.
- Trigger database membuat reminder H-2, H-1, dan hari H pukul 09.00 waktu fasilitas, serta membatalkannya saat sesi tidak aktif/berubah.
- WhatsApp click-to-chat dengan teks terisi; petugas mengirim manual.
- Audit event untuk tindak lanjut reminder.
- Data awal seed sengaja kosong. Gunakan data sintetis.

## Catatan keamanan

- Database berisi informasi kesehatan yang sensitif. Mulai dengan data sintetis.
- Jangan masukkan service/secret key di variabel publik atau browser.
- Project belum siap menerima data pasien nyata sebelum fasilitas meninjau role, kebijakan akses, backup, retensi, dan prosedur pemulihan.

