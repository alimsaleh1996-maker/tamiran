# 20261010O — فهرست عملیاتی پرونده‌ها با دامنه نقش و شعبه

Source opened from the same private Site with the official helper at commit `1022c146c029bb45c0195bd9e4bd67692dcf93ba`. No staging, hosted database, customer data, SMS or payment operation was used. Root publication remains the static migration checkpoint, not the operational Worker candidate.

## علت و دامنه محدود

نقطه ادامه ثبت‌شده، انتقال `operations.php` از داده واقعی D1 بود. مسیر GET بدون پارامتر قبلاً عمداً 503 می‌داد؛ در نتیجه رابط نمی‌توانست پرونده‌های واقعی، خلاصه یا کاربران همان شعبه را بخواند. این نوبت فقط بخش خواندنی اولیه برای تعمیرگاه‌های `inventoryMode=off` منتقل شد. capability، انبار simple/pro، لینک بازیابی پرتال، نوشتن پرونده و adapter کامل رابط خارج از دامنه باقی ماندند.

پیاده‌سازی جدید:

- نقش و شعبه فقط از `resolveServerScope` و عضویت فعال D1 گرفته می‌شوند؛ `role`، `shopId` و پارامتر تکراری/جعلی رد می‌شوند.
- مدیر و پذیرش پرونده‌های همان شعبه و PII لازم را می‌بینند؛ تکنسین و QC فقط پرونده تخصیص‌یافته خود را می‌بینند؛ انباردار پرونده‌ای نمی‌گیرد؛ مالی پرونده شعبه را بدون موبایل، کدملی و نشانی می‌بیند.
- نقش برگشتی کاربران از `tamiran_user_branches.branch_role_code` است، نه نقش سراسری قابل‌کهنه‌شدن کاربر.
- پرونده، workflow، دو نوع timeline event، نسخه optimistic پرونده و خلاصه عملیاتی از D1 خوانده می‌شوند. توکن/ciphertext هرگز در پاسخ نیست و `trackingUrl` تا اتصال امن پرتال خالی می‌ماند.
- عضویت پیش و پس از query پرونده دوباره کنترل می‌شود تا لغو دسترسی هم‌زمان، payload مجاز قبلی را برنگرداند.
- برای مدیر/پذیرش، پیش‌نویس‌ها همچنان فقط با کلید پایدار سروری و decrypt مالک/شعبه خوانده می‌شوند.
- اگر حالت انبار `simple` یا `pro` باشد، endpoint با 503 بسته می‌ماند؛ آرایه خالی ساختگی برای داده منتقل‌نشده برنمی‌گرداند. در حالت `off`، آرایه‌های انبار واقعاً خالی‌اند.
- هیچ schema، migration، baseline، منو یا فایل frozen رابط تغییر نکرد.

## آزمون و شواهد

`OPERATIONS-01…08` با fixtureهای `TEST-TAMIRAN-1010A/B` پاس شدند:

1. مدیر/پذیرش: case، summary، کاربران authoritative، timeline، no-store و عدم نشت token.
2. هر شش نقش عملیاتی: projection مجاز، PII masking، تخصیص تکنسین/QC و رفتار انباردار.
3. جداسازی دو تعمیرگاه، دو شعبه، الزام انتخاب شعبه برای کاربر چندشعبه و رد شعبه غیرمجاز.
4. رد role/shop spoofing، query تکراری و action منتقل‌نشده.
5. anonymous/unbound، کاربر/عضویت/شعبه غیرفعال و مجوز منقضی.
6. نبود کلید پذیرش و حالت انبار منتقل‌نشده به‌صورت fail-closed؛ نقش غیرپذیرش به کلید پیش‌نویس وابسته نیست.
7. لغو عضویت میان resolve و query با پاسخ 403.
8. branch نامعتبر و method غیرمجاز، همراه readback بدون mutation.

نتایج اجرا:

- `node --experimental-strip-types --test` برای مجموعه غیرهم‌زمان D1: `158/158` entry پاس؛ شامل `156` سناریوی inline و دو wrapper. wrapper workflow جداگانه `55/55` تست پایه را پاس کرد.
- TypeScript `--noEmit`: exit 0.
- ESLint محدود به فایل‌های تغییرکرده: exit 0 بدون warning.
- build رسمی Sites/Vinext: exit 0؛ route پویا `/api/:endpoint` ساخته شد.
- source preservation: `67` هش، `20` منو و `27` قرارداد frontend API تأیید؛ staging request صفر. Root Site foundation نیز پاس شد.
- هفت migration تغییرنکرده روی D1 محلی تازه به‌ترتیب اعمال شدند. identity seed/خواندن مستقیم storage، رد cross-shop، terms/token و draft envelope/denial همگی پاس شدند. Hosted D1 و network API اجرا نشدند.
- browser/mobile/print E2E اجرا نشد؛ control-browser در این محیط در دسترس نیست.

## اثر و ادامه

GET اصلی `operations.php` اکنون برای دامنه محدود و صادقانه `inventoryMode=off` قرارداد واقعی D1 دارد، اما Candidate هنوز جایگزین انتشار static نشده است. `capabilities.php`، جداول entitlement/module، عملیات انبار، portal tracking URL و adapter رابط برای branch/CSRF/draft/terms/device/case versions گام بعدی‌اند. سپس کلید و D1 میزبانی‌شده باید با هویت واقعی Site و fixture آزمایشی network/E2E آزموده شوند. آمادگی پایلوت تأیید نشده است.
