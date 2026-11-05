# راهنمای گام‌به‌گام استقرار روی Vercel + سرور اختصاصی (Fly.io / Render)

پروژه **MOSAVI CS** به‌صورت استاندارد در دو لایه تفکیک شده است:
1. **فرانت‌اند و موتور سه‌بعدی بازی (Vite + React + Three.js)** روی **Vercel** (از طریق `vercel.json`).
2. **سرور دائمی مالتی‌پلیر و دیتابیس (Node.js + Express + WebSocket + PostgreSQL)** روی **Fly.io** یا **Render** (از طریق `fly.toml`، `render.yaml` و `Dockerfile`).

---

## مرحله ۱: راه‌اندازی سرور Node.js / WebSocket روی Render یا Fly.io

قبل از اتصال Vercel، سرور بک‌اند را روی یکی از دو سرویس زیر بالا بیاورید تا آدرس آن را دریافت کنید:

### گزینه الف: استقرار روی Render.com (ساده‌ترین روش همراه با PostgreSQL رایگان)
فایل `render.yaml` در ریشه پروژه آماده شده است:
1. کدهای پروژه را در یک مخزن **GitHub** قرار دهید.
2. وارد پنل [dashboard.render.com](https://dashboard.render.com) شوید و روی **New +** -> **Blueprint** کلیک کنید (یا **New Web Service** را انتخاب کنید).
3. مخزن GitHub پروژه را متصل کنید. اگر به صورت دستی **Web Service** می‌سازید، مقادیر زیر را وارد کنید:
   - **Runtime**: `Node`
   - **Region**: `Frankfurt (EU Central)` *(برای کمترین پینگ با ایران)*
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. در بخش **Environment Variables** در Render:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `DATABASE_URL` = رشته اتصال دیتابیس PostgreSQL (از Render PostgreSQL یا Neon.tech)
   - `CORS_ORIGIN` = `*` (یا آدرس دامنه Vercel شما، مثلاً `https://mosavi-cs.vercel.app`)
5. پس از اتمام ساخت، Render یک آدرس به شما می‌دهد (مثلاً `https://mosavi-cs-server.onrender.com`).
   - برای اطمینان از سلامت سرور، آدرس `https://mosavi-cs-server.onrender.com/api/health` را در مرورگر باز کنید.

---

### گزینه ب: استقرار روی Fly.io (مخصوص بازی‌های آنلاین با اتصال دائمی و پینگ پایین)
فایل‌های `fly.toml` و `Dockerfile` از قبل در ریشه پروژه تنظیم شده‌اند (`primary_region = "fra"` برای دیتاسنتر فرانکفورت و `auto_stop_machines = "off"` برای قطع نشدن WebSocket):

1. ابزار خط فرمان Fly.io (`flyctl`) را نصب و وارد حساب خود شوید:
   ```bash
   fly auth login
   ```
2. در پوشه پروژه دستور زیر را اجرا کنید (بدون بازنویسی فایل `fly.toml` موجود):
   ```bash
   fly launch --copy-config --no-deploy
   ```
3. دیتابیس PostgreSQL را متصل کنید (یا متغیر `DATABASE_URL` را تنظیم نمایید):
   ```bash
   fly secrets set DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   fly secrets set CORS_ORIGIN="*"
   ```
4. سرور را منتشر کنید:
   ```bash
   fly deploy
   ```
5. آدرس سرور شما به شکل `https://mosavi-cs-server.fly.dev` آماده خواهد شد.

---

## مرحله ۲: پیکربندی و استقرار فرانت‌اند روی Vercel

فایل `vercel.json` در ریشه پروژه با تنظیمات زیر قرار داده شده است:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "framework": "vite",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### گام‌های اجرا در پنل Vercel:
1. وارد [vercel.com/new](https://vercel.com/new) شوید و مخزن GitHub پروژه را **Import** کنید.
2. تنظیمات Build به‌صورت خودکار از روی `vercel.json` تشخیص داده می‌شوند (`Framework: Vite`, `Build Command: npm run build`, `Output Directory: dist`).
3. بخش **Environment Variables** را باز کنید و دو متغیر زیر را به آدرس سرور مرحله ۱ متصل نمایید:

   | نام متغیر (Key) | مقدار نمونه برای Render | مقدار نمونه برای Fly.io |
   | :--- | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://mosavi-cs-server.onrender.com` | `https://mosavi-cs-server.fly.dev` |
   | `VITE_WS_SERVER_URL` | `wss://mosavi-cs-server.onrender.com/ws` | `wss://mosavi-cs-server.fly.dev/ws` |

   *(دقت کنید که برای `VITE_WS_SERVER_URL` حتماً از پروتکل امن `wss://` و مسیر `/ws` در انتهای آدرس استفاده شود).*

4. روی دکمه **Deploy** کلیک کنید.
5. پس از اتمام Deploy، بازی شما روی دامنه Vercel بالا می‌آید؛ تمام درخواست‌های REST API (`/api/*`) به‌صورت خودکار به `VITE_API_BASE_URL` و تمام ارتباطات لحظه‌ای لابی و مسابقه آنلاین به `VITE_WS_SERVER_URL` متصل می‌شوند.
