# حسابداری من

اپلیکیشن حسابداری وب (موبایل‌فرندلی) با بک‌اند Node.js.

> **نسخهٔ جدید بازطراحی‌شده (R1–R7):** اپ Next.js 16 در پوشهٔ [`webapp/`](./webapp) قرار دارد — بازطراحی کامل UI/UX بر پایهٔ سیستم طراحی توکن‌محور، واکنش‌گرایی در سه بریک‌پوینت (موبایل/تبلت/دسکتاپ)، اعداد اتمی `.money` و فرمت فشردهٔ مبالغ. اجرا:
>
> ```bash
> cd webapp
> npm ci
> npm run dev        # http://localhost:3000
> ```
>
> API بک‌اند همان سرور Node.js (`server/app.js`) است؛ راهنمای اجرای سرور در [README-SERVER.md](./README-SERVER.md).

## اجرای محلی (نسخهٔ کلاسیک Vite)

پیش‌نیاز: **Node.js 24**

```bash
npm ci
npm run dev:all
```

ورود پیش‌فرض: `admin` / `1111`

جزئیات بیشتر: [README-SERVER.md](./README-SERVER.md)

## استقرار روی cPanel

```bash
npm run pack:cpanel
```

سپس ZIP را روی هاست آپلود کنید. راهنمای کامل در [README-SERVER.md](./README-SERVER.md).
