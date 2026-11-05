# MOSAVI CS — Tactical 3D Competitive FPS

**MOSAVI CS** یک بازی شوتر اول‌شخص سه‌بعدی (3D Tactical First-Person Shooter) با موتور **Three.js (WebGL PBR)**، سیستم **بات‌های هوشمند مجهز به مسیریابی `*A` و ماشین حالت (FSM)**، **سرور آنلاین WebSocket**، پایگاه داده **PostgreSQL (Cloud SQL + Drizzle ORM)** و پشتیبانی کامل از **PC و Android** است.

## معماری و ساختار پروژه
- `src/game/weapons.ts` — مشخصات مستقل ۱۲ اسلحه (`AK-47`, `M4A1`, `AWP`, `MP5`, `Shotgun`, `Desert Eagle`, `Glock`, `USP`, `Knife`, `Grenade`, `Smoke Grenade`, `Flashbang`) و کاتالوگ فروشگاه اسکین‌ها.
- `src/game/maps.ts` — ۳ نقشه سه‌بعدی قابل بازی (`MOSAVI DUST`, `MOSAVI CITY`, `MOSAVI BASE`) به همراه گراف مسیریابی `*A` و برخوردهای فیزیکی AABB.
- `src/game/botAI.ts` — سیستم هوش مصنوعی بات‌ها با ۴ سطح دشواری (`Easy`, `Normal`, `Hard`, `Expert`) و ۴ سیاست حرکتی متمایز (`Assault`, `Anchor`, `Flanker`, `Sniper`).
- `src/game/sceneBuilder.ts` — سازنده مدل‌های ترکیبی سه‌بعدی (اپراتورهای ۸ بخشی و اسلحه‌های اول‌شخص ۶ تا ۱۰ بخشی با متریال PBR).
- `src/game/soundEngine.ts` — موتور سنتز صدای سه‌بعدی Web Audio API (شلیک، قدم‌ها، خشاب‌گذاری، انفجار، بوق بمب C4).
- `src/db/schema.ts` & `src/db/repository.ts` — جداول دیتابیس PostgreSQL و توابع امنیتی سرور (`scrypt` password hashing).
- `server.ts` — سرور یکپارچه Express API و WebSocket Multiplayer (`/ws`) با اعتبارسنجی ضدتقلب سمت سرور.

## نصب و اجرا
```bash
npm install
npm run dev
```

## اجرای تست‌های واحد (Unit Tests)
```bash
npx --yes tsx --test src/game/rules.test.ts
```
