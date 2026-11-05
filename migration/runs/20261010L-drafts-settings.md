# 20261010L — تنظیمات خواندنی و پیش‌نویس رمزنگاری‌شده پذیرش

Base HEAD: `71d283cc231ec92b38a59fc9e3c3fb4dc358a46a`؛ همان Site، مالک‌خصوصی، بدون staging، اطلاعات مشتری، پیامک یا پرداخت واقعی.

## علت و دامنه

ادامه اولین کار آماده d1-core. baseline operations.php کلید upsert را در سطح تعمیرگاه یکتا می‌داند اما مالک/شعبه را هنگام برخورد کنترل نمی‌کند؛ رابط حذف publicId می‌فرستد و API draftPublicId می‌خواهد. مسیر جدید هر دو نام را می‌پذیرد و اگر متفاوت باشند رد می‌کند. UI و baseline frozen تغییر نکردند. تنظیمات/کاتالوگ فقط خواندن منتقل شد؛ PATCH/CRUD/CSRF/capabilities هنوز fail-closed هستند.

دو جدول frozen، `repair_reception_drafts` (۱۲ ستون) و `tamiran_data_retention_policies` (۱۱ ستون)، حفظ شدند. دو ستون version/digest افزوده شد. Drizzle migration 0006 تولید و بررسی شد؛ envelope CHECK برای رد NULL ناقص پیش از اجرا اصلاح و snapshot/schema هماهنگ شدند؛ trigger هویت تغییرناپذیر افزوده شد. بازتولید Drizzle پس از اعمال محلی «No schema changes» داد. شش migration قبلی byte-for-byte با base HEAD برابرند. schema-only؛ seed جدا و فقط محلی. اکنون ۲۱ جدول و هفت migration وجود دارد.

payload_json فقط envelope نسخه ۱ AES-GCM است؛ AAD شامل تعمیرگاه، شعبه، مالک و publicId پیش‌نویس است. هیچ plaintext یا رمز دستگاه در DB/audit نیست. بدنه payload حداکثر ۶۵۵۳۶ بایت و depth=12؛ بدنه HTTP حداکثر ۹۸۳۰۴ بایت. مدت نگهداری طبق سیاست مرجع با پیش‌فرض ۳۰ روز و محدودیت ۱…۹۰ روز. cleanup هنوز منتقل نشده است.

save/list/discard فقط مدیر/پذیرش دارای حساب و عضویت فعال DB، در محدوده مالک و شعبه مجازند. برخورد همان کلید از مالک/شعبه دیگر conflict و بدون تغییر است؛ کلید یکسان در تعمیرگاه دیگر مستقل است. retry payload یکسان، بدون افزایش نسخه یا ممیزی است. تغییر payload و حذف باید expectedVersion جاری بدهند؛ این افزوده برای جلوگیری از lost update است و adapter رابط باید آن را ارسال کند. پیش‌نویس discarded/submitted دوباره فعال نمی‌شود؛ پس از حذف باید کلید جدید استفاده شود. این سخت‌گیری اصلاح resurrection و overwrite مرجع است، نه تغییر سایر گردش‌کارها.

مجوز و optimistic version در همان batch کنترل می‌شوند؛ write و audit اتمیک‌اند. خطای audit ثبت/حذف را کامل برمی‌گرداند. تداخل از preflight تا batch با نسخه/مالک/هش دوباره کنترل می‌شود. اصل create_case و رد تبدیل draft ناقص حفظ شده‌اند. تبدیل draft-to-case هنوز 503 است و در گام بعد باید در تراکنش پذیرش انجام شود.

settings GET از DB همان تعمیرگاه، قرارداد shop/settings/activeReceiptTerms را با versionId لازم برای پذیرش برمی‌گرداند. catalog GET همان فیلدهای frozen و scope تعمیرگاه را حفظ می‌کند. settings/catalog read مطابق baseline برای نقش‌های دارای شعبه فعال است؛ draft/customer history فقط مدیر و پذیرش.

## شواهد

Fixture: TEST-TAMIRAN-1010L-DRAFT/CREATE/CLI/X و نام «آزمایشی — مشتری پیش‌نویس». کلید صفر فقط داخل آزمون WebCrypto، نه کلید runtime. شماره نمونه فقط DB محلی؛ هیچ مقصد پیامک یا پرداختی نیست.

- `node --experimental-strip-types --test tests/reception-drafts.test.mjs`: 17/17 passed. 01 schema preservation/raw JSON/tenant FK/immutable identity؛ 02 save/decrypt/no plaintext؛ 03 replay/version/stale؛ 04 owner/branch/cross-shop؛ 05 discard/retry/no resurrection؛ 06 audit rollback؛ 07 revoked membership in batch؛ 08 default/policy expiry؛ 09 crypto tamper/key/size/depth؛ 10 HTTP save/list/discard alias؛ 11 forbidden roles/anonymous/unbound/key؛ 12 origin/content/spoof؛ 13 settings/catalog/terms؛ 14 unported/branch/auth/lookup؛ 15 interleaved initial creation؛ 16 intervening update/discard؛ 17 dispatcher create_case success/replay and fail-closed conversion.
- مجموعه رگرسیون شامل 117 تست مرتبط قبلی و 17 جدید، و 55 checks baseline passed. Node runner عدد 136 را شامل دو فایل script-level source/workflow گزارش کرد؛ 134 سناریو inline است. این شمارش E2E نیست.
- TypeScript noEmit و lint محدود فایل‌های مرحله passed؛ full UI lint قدیمی خارج دامنه باقی است.
- helper رسمی `build-site.mjs` در worker passed. root Site foundation passed.
- `tests/d1-drafts-readback.test.mjs`: 1/1 passed با Wrangler رسمی `d1 execute --local`؛ هفت فایل schema به‌ترتیب در checkout تازه اعمال شدند، seed A/B/F جدا اجرا شد. envelope و policy خوانده شدند؛ raw JSON، تغییر مالک و branch تعمیرگاه دیگر رد و readback ثابت؛ FK violations=0.

اجرای اولیه `d1 migrations apply` به‌علت نبود migrations_dir شکست خورد و هیچ migration اجرا نکرد. طبق README رسمی، `d1 execute --local --file` جایگزین شد؛ تنظیمات محصول برای خطای ابزار تغییر نکردند. آزمون D1 جدید storage/constraints است و از ciphertext واضحاً مصنوعی استفاده می‌کند؛ رمزنگاری واقعی در آزمون repository/WebCrypto جدا اجرا شده است. تداخل‌ها در adapter محلی بین preflight/batch ایجاد شدند؛ چند Worker واقعی هنوز آزموده نشده‌اند.

## محدودیت و ادامه

انتشار root همچنان static demo + گزارش خصوصی است؛ APIهای candidate روی شبکه میزبانی‌شده فعال نیستند. هیچ ادعای پذیرش عملیاتی، UI یکپارچه، ورود هر نقش، چاپ، E2E تکنسین/مشتری یا آمادگی پایلوت وجود ندارد. کلید پایدار runtime و hosted D1 هنوز تنظیم نشده‌اند.

Next: تبدیل مالک/شعبه/نسخه معتبر پیش‌نویس به submitted در batch اصلی پذیرش، initial operations payload/case list و adapter بدون تغییر منو/ظاهر (expectedVersion، terms versionId/hash و device version). سپس capabilities/CSRF و APIهای باقیمانده، hosted identity/DB و E2E.
