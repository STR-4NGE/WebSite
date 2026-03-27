# WEBTSITE Blog + Admin + Kullanici

## Kurulum

1. Terminalde bu klasore girin.
2. `.env.example` dosyasini `.env` olarak kopyalayin.
3. Gerekirse `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET` degerlerini guncelleyin.
4. Sunucuyu baslatin:

```bash
npm start
```

5. Tarayicida acin:
- `http://localhost:3000`
- Admin girisi: `http://localhost:3000/login.html`
- Kullanici kayit/giris: `http://localhost:3000/user-auth.html`

## Ozellikler

- Tek admin modeli (sadece bir admin hesabi)
- Kullanici kayit ve giris sistemi
- E-posta dogrulama token akisi
- Sifremi unuttum / token ile sifre yenileme
- Kullanici sifre degistirme
- Yorum sistemi (kullanicilar yayinlanan yazilara yorum birakabilir)
- Kullanici sadece kendi yorumunu duzenleyip silebilir
- Admin panelden yazi olusturma
- Yazi yayinla/taslak yap/sil
- Yayindaki yazilarin ana sayfada listelenmesi
- SQL destegi: SQLite, MySQL, PostgreSQL

## Veritabani

- Yerel SQLite: once `npm install sqlite3`, sonra `.env` icinde `DB_CLIENT=sqlite` kullanin. Veriler `data/blog.db` dosyasinda saklanir.
- **Render:** Postgres veritabani ile Web Service'i **bagla** ("Connect" / link); boylece `DATABASE_URL` ortam degiskeni otomatik eklenir. Ayrica `DB_CLIENT=postgres` tanimlayabilirsiniz.
- `DATABASE_URL` tanimliysa uygulama PostgreSQL kullanir (ek ayar gerekmez).
- `NODE_ENV=production` iken varsayilan surucu PostgreSQL'dir; `sqlite3` paketi repoda yoktur (Render GLIBC hatasini onlemek icin).
- `DB_CLIENT=mysql` veya `DB_CLIENT=postgres` ile MySQL/PostgreSQL ayri alanlar da kullanilabilir.
- MySQL icin tipik ayarlar: `DB_PORT=3306`
- PostgreSQL icin tipik ayarlar: `DB_PORT=5432`

## Ucretsiz / dusuk maliyetli yayin secenekleri

- **Render:** Web Service + Postgres (free tier; uyku modu olabilir). Bu proje burada calisir.
- **Railway / Fly.io:** Ucretsiz kotasi degisir; Node + Postgres benzer kurulum.
- **Cloudflare Pages + ayri API:** Bu repo tam bir Node sunucusu gerektirdigi icin sadece Pages yeterli degildir; ya tam stack bir serviste calistirin ya da API'yi baska yerde host edin.

## Internet Yayini (Production)

- `NODE_ENV=production` ve guclu bir `SESSION_SECRET` kullanin.
- Healthcheck endpoint: `/healthz`
- Upload edilen gorseller: `/uploads/...`
- En az bir cloud platformu secin (Render/Railway/Fly.io gibi) ve ortam degiskenlerini panelden girin.
- Production veritabaninda SQLite yerine `mysql` veya `postgres` onerilir.

### En Guvenli Yayin Mimarisi (onerilen)

- Uygulama: Render/Railway/Fly.io (managed deployment)
- Veritabani: Managed PostgreSQL
- DNS/WAF: Cloudflare (Always HTTPS + basic WAF)
- Secrets: Sadece platform ortam degiskenlerinde tutulur, repoya yazilmaz.

### Production Guvenlik Kontrol Listesi

- `NODE_ENV=production`
- `SESSION_SECRET` en az 32+ karakter rastgele deger
- `SHOW_DEBUG_TOKENS=false`
- Admin sifresi guclu ve tekil
- `/healthz` endpointi aktif
- HTTPS zorunlu (Cloudflare + platform SSL)
- Login ve upload rate-limit aktif
- Gunluk yedek (DB backup) aktif
