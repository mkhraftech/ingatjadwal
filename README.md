# IngatJadwal

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

