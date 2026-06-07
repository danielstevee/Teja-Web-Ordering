# Setup Supabase TEJA Ordering

1. Buat project di Supabase.
2. Buka SQL Editor, jalankan isi file `supabase-schema.sql`.
3. Buka `supabase-config.js`.
4. Ganti nilai berikut:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

5. Ambil `Project URL` dan `anon public key` dari Supabase Dashboard -> Project Settings -> API.
6. Buka `checkout.html`, buat pesanan pembeli, lalu buka `admin-pesanan.html` untuk melihat order masuk.

Alur status:

- `baru`: pesanan masuk di admin.
- `diproses`: admin mengirim pesanan ke dapur.
- `siap`: admin menandai pesanan siap disajikan.
- `selesai`: admin menyelesaikan pesanan, lalu muncul di riwayat.

Jika URL/key belum diisi, aplikasi tetap berjalan memakai cache `localStorage` pada browser yang sama, tetapi admin dan pembeli di perangkat berbeda belum tersambung.
