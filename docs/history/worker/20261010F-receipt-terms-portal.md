# 20261010F — شرایط پذیرش، مدرک قبول مشتری و توکن پرتال

Source at open: `f287a94616095ee5235cb49cf1d2443ff6cd484b`؛ همان Site مالک-خصوصی.

## علت و دامنه

Repository قبلی با وجود ذخیره dataHandling، نسخه شرایط پذیرفته‌شده و مدرک قبول مشتری را ثبت نمی‌کرد؛ tracking hash روی پرونده بود ولی repair_portal_tokens ساخته نمی‌شد. بنابراین پرونده پذیرش برای پرتال و چاپ شرایط ناقص بود. این مرحله سه جدول و آثار اتمیک آن‌ها را منتقل می‌کند؛ endpoint یا UI جدید فعال نشده است.

- ۱۹ جدول اکنون منتقل شده‌اند؛ تمام ۳۰ ستون سه جدول مرجع حفظ شده‌اند و shop_id داخلی به مدرک قبول اضافه شده تا دو FK مرکب، پرونده/شرایط را در همان تعمیرگاه نگه دارند.
- migration 0005 توسط Drizzle تولید شد؛ schema-only triggers پیش از apply به همین migration تازه برای تغییرناپذیری محتوا/مدرک و اتصال token به hash پرونده اضافه شدند. migrationها و snapshotهای 0000–0004 دست‌نخورده‌اند.
- مشتری باید accepted=true و versionId/contentSha256 نسخه نمایش‌داده‌شده را بدهد. جدیدترین نسخه فعال معتبر زمانی از DB خوانده می‌شود؛ checksum متن تأیید و در همان batch فعال‌ماندن همان نسخه کنترل می‌شود.
- مدرک شامل عنوان/نسخه/hash شرایط از DB، نام مشتری، روش ثبت، details JSON محدود، کاربر ثبت‌کننده، شعبه و requestId است؛ محتوا و مدرک نهایی UPDATE/DELETE نمی‌شوند. بازنشسته‌کردن نسخه با active/effective_to سابقه را حذف نمی‌کند.
- پذیرش، رضایت، portal token، workflow، رویداد و ممیزی یک batch دارند. شکست هر مرحله یا تغییر شرایط بین read/batch تمام آثار و شماره قبض را rollback می‌کند.
- fingerprint شامل نسخه و مدرک قبول است؛ JSON با ترتیب کلید متفاوت replay معتبر است، اما تغییر مدرک/نسخه conflict می‌دهد. شناسه‌های تولیدی سرور باعث شکست retry نمی‌شوند.
- توکن تصادفی ۲۵۶ بیتی؛ SHA-256 در portal tokens و ciphertext در پرونده. helper AES-256-GCM با context تعمیرگاه/UUID پرونده از جابه‌جایی ciphertext جلوگیری می‌کند. raw token در داده پایدار، audit یا گزارش ذخیره نمی‌شود. تست‌ها کلید تصادفی فقط در حافظه دارند.
- انقضا ۴۰۰ روز UTC عین baseline است. resolver داخلی فقط scope پرونده را پس از بررسی token/hash/expiry/revocation برمی‌گرداند؛ مسیر مشتری و payload مالی/برآورد/پیام‌ها هنوز منتقل نشده‌اند.
- sms_otp acceptance تا تکمیل OTP تأییدشده سمت سرور fail-closed است. فیلد verified=true مشتری/رابط مدرک معتبر OTP نیست. پذیرش با نام روش digital_signature به معنی اعتبارسنجی رمزنگاری امضای واقعی نیست؛ این مرحله ثبت مدرک طبق قرارداد مرجع را فراهم می‌کند.

## شواهد

| اجرا | انتظار | نتیجه |
|---|---|---|
| reception-terms-portal | complete graph, active/displayed terms, stale/cross-shop/expiry/rollback/replay, schema/crypto | 15/15 passed |
| schema/case/repository/new-device/settings regressions | بدون پسرفت | 66/66 passed |
| workflow/parity/security | قواعد مرجع و gate | 55/55 passed |
| source preservation | اصل رابط و قراردادها | 67 frozen hashes، 20 menus، 27 API paths preserved |
| TypeScript | بدون خطای نوع | exit 0 پس از اصلاح BufferSource در context WebCrypto |
| targeted lint | implementation/tests تازه | exit 0؛ full UI lint خارج از دامنه |
| Worker build با helper رسمی | تولید artifact Candidate | passed |
| migration 0005 روی Wrangler local D1 | سه جدول و ۶ trigger | 18 statements passed |
| d1-local و readback قبلی | scoped identity/zero FK violation | passed؛ 7 roles/7 memberships؛ cross-shop denied/unchanged |
| d1-receipt-readback | durable synthetic terms/acceptance/token + DB denial | 1/1 passed؛ immutable و cross-shop رد و readback بدون تغییر |
| root Site foundation | هویت، warning، جداسازی assets | passed 1/1 |

مجموع مرتبط: ۸۲ آزمون دیتابیس/repository/crypto/local persistence، به‌علاوه ۵۵ کنترل پایه. تست atomic repository روی adapter SQLite سازگار D1 است؛ CLI فقط storage و constraint را آزموده است. یک probe مستقیم binding Miniflare به مرحله initialize نرسید و لغو شد؛ API runtime یا HTTP را passed اعلام نمی‌کنیم.

## تست‌های کلیدی

D1-RECEPTION-27 تا 38: atomic acceptance/token, invalid/missing consent/version, inactive/future/expired terms, latest active version, race at batch, failure in receipt/token/workflow, fingerprint evidence conflict, immutable evidence/version history, tenant FKs/token identity, expired/revoked/unknown token, forged OTP denial, corrupt term body/hash. PORTAL-CRYPTO-01/02: entropy و recovery/tamper/wrong key/shop/case/hash؛ invalid key/date/oversized/deep JSON. Schema test ستون‌های frozen سه جدول را دقیق مقایسه کرد.

## اثر عملیاتی و محدودیت

پذیرش و مدیر: رکورد پذیرش همراه نسخه شرایط کامل می‌شود و در صورت تغییر شرایط، مرور مجدد لازم است. مشتری: مدرک مجوز/شرایط و پایه لینک محدود به پرونده فراهم است؛ پرتال واقعی هنوز فعال نیست. تکنسین: همان snapshot/مجوز قبلی حفظ می‌شود. مالی و انبار: تغییری ندارد. توسعه: سه جدول و FK/trigger اضافه؛ API مرجع و منوها ثابت. هیچ اطلاعات واقعی، SMS، پرداخت یا استیجینگ استفاده نشد.

کلید پایدار runtime، صدور/بازیابی HTTP توکن، payload کامل پرتال، OTP، PDF/چاپ، hosted DB و E2E نقش‌ها هنوز انجام نشده‌اند. Candidate هنوز آماده پایلوت نیست؛ انتشار فقط source checkpoint و گزارش خصوصی است.

## ادامه دقیق

Remaining reception options: assignmentMode/assignedToUserId و resolver مجاز شاخه/تعمیرگاه، preapprovedAmount integer، diagnosticFeePolicy، promisedAt UTC، temporaryDeviceSecret رمزنگاری‌شده/expiry عین baseline. سپس create_case به repository کامل پشت هویت server-side و کنترل same-origin متصل شود؛ primitive ناقص مرحله۳ مستقیم عرضه نشود. تنظیم secret پایدار با ابزار env رسمی و حفظ key برای recovery لازم است؛ هیچ secret آزمایشی در سورس/گزارش نوشته نشود.
