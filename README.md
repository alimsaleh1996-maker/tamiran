# تعمیران

سامانهٔ فارسی مدیریت تعمیرگاه با رابط راست‌به‌چپ، پذیرش، گردش تعمیر، انبار، کنترل کیفیت و امور مالی.

نسخهٔ جاری قابل نصب: **2.0.0-php.2**. کد اصلی نسخهٔ PHP/MySQL در [hosting](hosting/README.md) قرار دارد و شامل رابط React/TypeScript قابل ویرایش، خروجی آمادهٔ `public_html`، APIهای PHP، SQL و نصب‌کننده است.

- [راهنمای نصب روی هاست](hosting/INSTALL-FA.md)
- [به‌روزرسانی از php.1](hosting/UPGRADE-FA.md)
- [اصلاحات رابط کاربری](hosting/UI-FIXES-FA.md)
- [نتایج و محدودیت‌های آزمون](hosting/VERIFICATION-FA.md)
- [راهنمای کار و انتشار در GitHub](GITHUB-FA.md)

هاست به PHP 8.2+ و MySQL 8 یا MariaDB 10.6+ نیاز دارد. Node فقط برای ساخت مجدد رابط لازم است؛ فایل‌های آمادهٔ مرورگر در سورس موجودند. پوشه‌های `hosting/public_html` و `hosting/private` باید در هاست کنار هم باشند.

برای ساخت مجدد رابط:

```sh
cd hosting/frontend
npm ci --ignore-scripts
npm run typecheck
npm run build
```

برای تولید بستهٔ نصب و سورس، از ریشهٔ مخزن:

```sh
python3 hosting/scripts/package.py --output /absolute/path/outside-the-repository
```

بستهٔ نصب کلید خصوصی نصب جدید می‌سازد؛ فایل ZIP نصب را در Git ثبت نکنید. ساخت بسته به‌تنهایی جای آزمون نصب و API را نمی‌گیرد.

`migration/worker` سورس انتقال قبلی به Workers/D1 و مرجع منجمد آن را نگه می‌دارد؛ `dist` دموی قدیمی است. دامنهٔ آماده‌بودن هر نسخه در گزارش مربوط به همان نسخه ثبت شده است. فایل‌های استقرار Sites برای حفظ هویت پروژه در سورس باقی مانده‌اند و انتقال به GitHub انتشار سایت را اجرا نمی‌کند.

بررسی‌های پایهٔ سورس، بدون دیتابیس:

```sh
node --test tests/site-foundation.test.mjs
node migration/worker/tests/source-preservation.test.mjs
```

آزمون‌های HTTP و SQL در `hosting/tests` با دادهٔ مصنوعی روی محیط محلی اجرا می‌شوند. تنظیمات نصب‌شده، کلیدها و داده‌های کاربران در مخزن قرار نمی‌گیرند. اعلان مجوز ضبط‌های صوتی و سایر اجزای ثالث در [THIRD-PARTY-NOTICES.txt](hosting/THIRD-PARTY-NOTICES.txt) است.
