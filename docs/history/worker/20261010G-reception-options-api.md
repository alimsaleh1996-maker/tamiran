# 20261010G — گزینه‌های پذیرش و مسیر احرازشده create_case

Source at open: `d6da76d62a7a3b400ddc5cf3c3b68c6f4448ad04`؛ همان Site مالک-خصوصی. انتشار این مرحله فقط checkpoint سورس و گزارش دموی خصوصی است؛ root همچنان static است و Worker عملیاتی فعال نشده است.

## تغییر و دلیل

پذیرش قبلی تخصیص مسئول، سقف تأیید، سیاست عیب‌یابی، موعد و رمز موقت را ثبت نمی‌کرد و endpoint اجرایی نداشت. این مرحله این داده‌ها را به همان تراکنش اصلی اضافه می‌کند و handler سروری برای POST `/api/operations.php` با action `create_case` می‌سازد.

- منطق مرجع: تنها تکنسین فعال با autoSingle پیش‌فرض حتی بر انتخاب queue/manual اولویت دارد؛ در غیر این حالت queue، انتخاب دستی و default فعال به ترتیب اعمال می‌شوند. string `0` در تنظیم قدیمی مانند PHP empty است. مقصد باید در همان تعمیرگاه و شعبه فعال و دارای نقش مجاز باشد؛ کنترل عضویت فعال نسبت به PHP مرجع محکم‌تر شده است.
- Solo بدون تخصیص وارد diagnosing می‌شود؛ snapshot انبار pro و QC مستقل در Solo عین سیاست مرجع به simple تبدیل می‌شوند. Pro با مسئول assigned و بدون مسئول awaiting_assignment است.
- مسئول پرونده و تکنسین اصلی workflow، مبلغ صحیح نامنفی به ریال، JSON محدود و canonical سیاست عیب‌یابی و موعد UTC در همان batch ثبت می‌شوند. مبلغ منفی/اعشاری/خارج از محدوده صحیح JS رد می‌شود.
- تغییر تنظیم تخصیص، فهرست تکنسین‌های فعال، عضویت مقصد یا profile/capability snapshots بین read و batch باعث rollback کامل می‌شود. شماره قبض، مشتری، دستگاه، قبول شرایط، توکن، workflow، رویداد و audit اتمیک باقی می‌مانند.
- رمز موقت تا ۵۰۰ بایت UTF-8؛ AES-256-GCM با context جداگانه تعمیرگاه/UUID، nonce تصادفی و expiry هفت‌روزه ذخیره می‌شود. plaintext در storage/audit/response نیست. هیچ endpoint بازیابی رمز در این مرحله منتشر نشده؛ کنترل مجوز و انقضا هنگام بازیابی، مرحله تکنسین را لازم دارد. انقضا به معنی حذف فیزیکی ciphertext در این مرحله نیست.
- fingerprint تمام گزینه‌ها و SHA-256 رمز موقت را در بر می‌گیرد. retry همان درخواست read-only و تغییر گزینه‌ها 409 است؛ retry رمز/انقضا/شماره قبض را از نو ثبت نمی‌کند.

## قرارداد HTTP و اعتماد

هویت فقط از getChatGPTUser رسمی Sites در context سرور دریافت می‌شود؛ DB عضویت فعال، شعبه، نقش و اعتبار تعمیرگاه را تعیین می‌کند. body نمی‌تواند shop، actor، role، public ID یا tracking hash را انتخاب کند. فقط مدیر تعمیرگاه و پذیرش مجازند. ورودی strict، JSON حداکثر ۳۲KB و Origin دقیق همان مبدأ الزامی است. این کنترل مبدأ آزموده شده؛ صدور csrf.php و سازگاری اتصال frontend هنوز باقی است.

شناسه‌ها، UUID پرونده و portal token تصادفی سرور ساخته می‌شوند. پاسخ repairCase از پرونده ذخیره‌شده و scope واقعی خوانده می‌شود و trackingUrl در retry با بازیابی ciphertext ذخیره‌شده همان قبلی است. این پاسخ مسیر create است؛ قرارداد فهرست پرونده‌ها/صورتحساب/سایر eventهای گردش‌کار هنوز منتقل نشده است. deliveryAmount از ستون پرونده خوانده می‌شود؛ الحاق invoice در مرحله مالی باقی است.

DB یا کلید پایدار سرور TAMIRAN_DATA_KEY تنظیم نشده باشد: 503 و بدون ثبت. کلید ۲۵۶ بیتی فقط binding سرور است؛ در سورس، فایل یا مرورگر قرار نگرفته و هنوز در runtime میزبانی‌شده تنظیم نشده است. تبدیل draft، actionهای دیگر، پذیرش sms_otp ساختگی و endpointهای منتقل‌نشده همچنان fail-closed هستند. خطای ناشناخته پاسخ 500 با tracking_code می‌دهد؛ SQL یا بدنه حساس به پاسخ راه پیدا نمی‌کند. اگر پس از commit بازیابی پاسخ شکست بخورد، کاربر باید همان idempotencyKey را retry کند.

## شواهد اجرا

| بررسی | نتیجه |
|---|---|
| reception-options | 14/14 passed؛ تخصیص خودکار/دستی/صف/default، Solo، UTC/ریال، رمز، rollback/race/replay |
| reception-http | 12/12 passed؛ موفقیت مدیر/پذیرش، پاسخ واقعی و retry، هفت نقش، شعبه/تعمیرگاه، اعتبار، origin، جعل body، حجم/JSON، کلید/DB، خطای sanitized |
| schema/case/repository/settings/terms/crypto قبلی | 81/81 passed |
| workflow/parity/security قبلی | 55/55 passed |
| source preservation | 67 frozen hashes، 20 menus و 27 API paths preserved |
| TypeScript | exit 0 |
| lint تغییرات | exit 0؛ بدون warning پس از حذف import اضافی harness |
| Worker candidate build رسمی | passed؛ route /api/:endpoint تولید شد |
| Wrangler local D1 receipt/token readback و constraint denial | 1/1 passed در اجرای مستقل نهایی پس از build؛ immutable/cross-shop rejected و FK صفر |
| root Site foundation | هویت/static/warning/asset isolation بررسی شد |

۱۰۷ تست schema/repository/crypto/HTTP handler + یک تست رسمی Wrangler ذخیره/constraint (جمع ۱۰۸)، به‌علاوه ۵۵ کنترل پایه پاس شدند. اجرای node --test برابر 109 pass است زیرا دو فایل workflow/source نیز wrapper مستقل شمرده می‌شوند. HTTP tests از Request/Response واقعی روی handler و adapter SQLite استفاده می‌کنند؛ تست شبکه Worker، dispatch هویت میزبانی‌شده یا browser E2E نیستند. یک اجرای CLI با build هم‌زمان شد و config موقتاً حذف شده بود؛ پس از پایان build مستقل تکرار شد. یک ایراد مرزی پیشین نیز اصلاح شد: stage key با پیشوند case-create می‌توانست از ۱۶۰ کاراکتر مجاز فراتر رود؛ اکنون SHA-256 کلید درخواست طول آن را به ۷۶ محدود می‌کند. تست ثبت/retry با کلید ۱۶۰ و رد ۱۶۱ پاس شد. schema/migration جدیدی نیاز نبود؛ شش migration پیشین تغییر نکردند.

## باقی‌مانده

catalog/settings/capabilities، csrf و session contract برای رابط، customer lookup/history، مدیریت draft و فهرست پرونده‌ها؛ سپس اتصال واقعی فرم با نسخه شرایط و lock_version بدون تغییر منو/طراحی. پیش از ثبت عملیاتی: کلید پایدار server-managed، binding میزبانی‌شده، آزمون واقعی HTTP و هم‌زمانی Worker لازم است. تکنسین، OTP بدون SMS خارجی، پرتال مشتری، برآورد، قطعات، QC، مالی، تحویل، چاپ، موبایل و recovery/E2E باقی‌اند. staging/داده/پیامک/پرداخت واقعی استفاده نشده است؛ آمادگی پایلوت تأیید نشده است.
