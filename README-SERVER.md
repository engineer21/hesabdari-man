# استقرار روی cPanel (Node.js)

اپلیکیشن حسابداری من به‌صورت یک برنامهٔ Node.js اجرا می‌شود: رابط کاربری و API از یک آدرس سرو می‌شوند.

## پیش‌نیاز هاست

- cPanel با **Setup Node.js App** / Application Manager
- **Node.js 24.15 یا بالاتر از شاخهٔ ۲۴**
- فضای قابل‌نوشتن برای پوشه‌های `data` و `backups`
- ترجیحاً یک **زیر‌دامنهٔ مستقل** مثل `acc.example.com` با مسیر `/`

## ساخت بستهٔ آپلود (روی سیستم خودتان)

```bash
npm ci
npm run pack:cpanel
```

فایل `acc-mobile-cpanel-….zip` در ریشهٔ پروژه ساخته می‌شود (شامل `dist` و بدون `node_modules`).

یا دستی:

```bash
npm ci
npm run build
```

سپس محتویات لازم را ZIP کنید: `start.js`, `package.json`, `package-lock.json`, `server/`, `dist/`, `public/`, `scripts/backup-db.js`, `.env.example`, پوشه‌های خالی `data/` و `backups/`.

## استقرار روی cPanel

1. ZIP را در مسیری مثل `/home/USERNAME/acc-app` آپلود و استخراج کنید.  
   **داخل `public_html` نگذارید** (مگر همان مسیر Application Root باشد).

2. در پنل Node.js یک اپ بسازید:
   - **Node.js version:** 24.15+
   - **Application root:** همان پوشهٔ استخراج‌شده (`acc-app`)
   - **Application URL:** زیر‌دامنه با مسیر `/`
   - **Startup file:** `start.js`
   - **Application mode:** Production

3. متغیرهای محیطی (Environment):

   | کلید | مقدار پیشنهادی |
   |------|----------------|
   | `NODE_ENV` | `production` |
   | `SESSION_TTL_HOURS` | `168` |

   `PORT` را فقط اگر هاست گفت دستی بگذارید؛ معمولاً cPanel خودش تنظیم می‌کند.

   مسیرهای اختیاری:

   | کلید | پیش‌فرض |
   |------|---------|
   | `DB_PATH` | `data/accounting.sqlite` |
   | `UPLOAD_DIR` | `data/uploads` |
   | `BACKUP_DIR` | `backups` |

4. در تنظیمات Node.js App:
   - **Application root** باید همان پوشه‌ای باشد که `start.js` و `dist/` داخلش است (نه فقط `public_html` خالی).
   - فیلد **Build / Run script** را خالی بگذارید، یا `npm run build` بزنید (اگر `dist` در بسته باشد، بدون خطا رد می‌شود).
   - **نصب:** 

   ```bash
   npm ci --omit=dev
   ```

   اگر اشتباهاً فقط سورس بدون `dist` آپلود کرده‌اید، از سیستم خودتان دوباره `npm run pack:cpanel` بگیرید و ZIP کامل را جایگزین کنید.

5. از پنل Node.js روی **Restart** بزنید و آدرس HTTPS را باز کنید.

6. ورود اولیه: نام کاربری `admin` و رمز `1111` — بلافاصله رمز را عوض کنید.

## توسعهٔ محلی

```bash
npm ci
npm run dev:server   # API
npm run dev          # Vite روی 3000 با پروکسی
# یا
npm run dev:all
```

```bash
npm run build
npm start
```

## پشتیبان‌گیری

از SSH یا Cron در پوشهٔ پروژه:

```bash
npm run backup
```

خروجی در `backups/` است. پوشهٔ `backups` و `data` را عمومی نکنید و نسخه‌ها را دوره‌ای جای دیگری کپی کنید.

## عیب‌یابی سریع

| مشکل | کار |
|------|-----|
| صفحه سفید / 404 | مطمئن شوید `dist/index.html` هست و Startup = `start.js` |
| خطای sqlite / ماژول | نسخهٔ Node باید ۲۴ باشد |
| آپلود عکس خطا | دسترسی نوشتن روی `data/uploads` |
| پورت اشغال | `PORT` را به cPanel بسپارید؛ Restart اپ |

بررسی سلامت API:

`https://دامنه-شما/api/health`
