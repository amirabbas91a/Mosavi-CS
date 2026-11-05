# راهنمای ساخت فایل نصبی اندروید (APK) — MOSAVI CS

پروژه **MOSAVI CS** با هسته مشترک سه‌بعدی و رابط لمسی اختصاصی موبایل (جوی‌استیک مجازی، صفحه چرخش دوربین و دکمه‌های قابل جابه‌جایی و تغییر سایز) برای خروجی بومی اندروید از طریق **Capacitor Android** پیکربندی شده است (`capacitor.config.json`).

## مراحل ساخت مستقیم فایل APK در محیط Android SDK
```bash
# ۱. نصب هسته Capacitor Android
npm install @capacitor/core @capacitor/cli @capacitor/android

# ۲. ساخت بیلد نهایی موتور بازی
npm run build

# ۳. ایجاد پروژه بومی اندروید و همگام‌سازی فایل‌ها
npx cap add android
npx cap sync android

# ۴. کامپایل فایل APK قابل نصب
cd android && ./gradlew assembleRelease
```
فایل خروجی در مسیر `android/app/build/outputs/apk/release/app-release.apk` تولید می‌شود. همچنین کانفیگ کامل بیلد از بخش **تنظیمات و APK اندروید** داخل بازی قابل دانلود است.
