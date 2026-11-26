# تعمیران ۱٫۰٫۰

نامزد انتشار `1.0.0-rc.14` در شاخهٔ `tamiran-v1/foundation` نگهداری می‌شود. مبنای نسل جدید `2.0.0-php.10` در Commit `8928ffd9a3c14494e069fb0cd4d2edc7f5bb2fa6` است. اجرای مستقل PHP/MariaDB در `hosting/` قرار دارد. مسیرهای وب و نصب همان `public_html/` و `private/` هستند.

```sh
cd tamiran-v1/hosting/frontend
npm ci --ignore-scripts
npm run typecheck
npm run build
```

بسته را از checkout تمیز شاخهٔ انتشار و با SHA کامل تأییدشده بسازید. [راهنمای ساخت، تطبیق و استقرار](docs/DEPLOYMENT.md) و [وضعیت ۲۲ اصلاح](docs/STABILIZATION-FA.md) در دسترس‌اند. فایل تأییدشدهٔ طراحی در `references/tamiran-prototype-v7.html` نگهداری می‌شود.

گراف مستقل در `graphify-out/` قرار دارد. از پوشهٔ نسخه، `graphify query`، `graphify path` و `graphify explain` را اجرا کنید. پس از تغییر سورس، `graphify update .` استخراج کد را با کش به‌روز می‌کند. روابط SQL، نشست و تراکنش با سورس اصلی کنترل می‌شوند.
