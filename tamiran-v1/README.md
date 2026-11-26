# تعمیران ۱٫۰٫۰

نامزد انتشار `1.0.0-rc.9` از `2.0.0-php.10` در Commit `8928ffd9a3c14494e069fb0cd4d2edc7f5bb2fa6` ساخته شده است. اجرای مستقل PHP/MariaDB در `hosting/` قرار دارد. مسیرهای وب و نصب همان `public_html/` و `private/` هستند.

```sh
cd tamiran-v1/hosting/frontend
npm ci --ignore-scripts
npm run typecheck
npm run build
```

ساخت بستهٔ نصب آزمایشی با `hosting/scripts/package.py --output <directory>` انجام می‌شود. راهنمای نصب در `hosting/INSTALL-FA.md` است. فایل تأییدشدهٔ طراحی در `references/tamiran-prototype-v7.html` نگهداری می‌شود.

گراف مستقل در `graphify-out/` قرار دارد. از پوشهٔ نسخه، `graphify query`، `graphify path` و `graphify explain` را اجرا کنید. پس از تغییر سورس، `graphify update .` استخراج کد را با کش به‌روز می‌کند. روابط SQL، نشست و تراکنش با سورس اصلی کنترل می‌شوند.
