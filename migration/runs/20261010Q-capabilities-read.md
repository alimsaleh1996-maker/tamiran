# اجرای 20261010Q — کاتالوگ قابلیت و entitlement خواندنی

نسخه مبنا: `71b384fc3cb4051b3dfb2b0ac734dffb5e3bfaa8`. دامنه این اجرا فقط انتقال schema ماژول‌ها و قرارداد GET قابلیت‌ها بود. رابط، منوها، استیجینگ، داده واقعی، پیامک و پرداخت تغییر یا استفاده نشدند. Candidate هنوز جایگزین انتشار static فعال نیست و آمادگی پایلوت تأیید نشده است.

## علت و تغییر محدود

بارگذاری اولیه رابط به `GET /api/capabilities.php` وابسته بود، اما dispatcher جدید آن را 503 می‌داد و جدول authoritative ماژول/entitlement در D1 وجود نداشت. دو جدول frozen زیر با migration رسمی و schema-only منتقل شدند:

- `tamiran_modules`: هر ۹ ستون مرجع، scope محصول، core/sellable و وضعیت کاتالوگ.
- `tamiran_shop_modules`: هر ۱۱ ستون مرجع، entitlement تعمیرگاه، انقضا، config JSON و actor به‌صورت tenant-scoped.

`0007_sticky_wild_pack.sql` فقط CREATE/INDEX/CONSTRAINT دارد. seed کاتالوگ و fixture آزمایشی جداست. GET جدید نام، توضیح و وضعیت را از D1 می‌خواند؛ نقش و عضویت شعبه، مجوزها، مجوز تعمیرگاه و feature flag در query دوباره کنترل می‌شوند. `modules_json`، query role و DOM منبع مجوز نیستند. config/source/شناسه داخلی در پاسخ برنمی‌گردند.

## آزمون‌ها و نتیجه

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| CAPABILITY-DB-01 | ستون‌های frozen کامل؛ cross-shop actor، state نامعتبر، JSON خام و module یتیم رد شوند | passed |
| CAPABILITY-GET-02 | مدیر کاتالوگ ۱۱ ماژول، active/trial/expired و مهلت trial را بدون config خصوصی بگیرد | passed |
| CAPABILITY-GET-03 | هر شش نقش عملیاتی فقط ماژول‌های مجاز خودش را ببیند/استفاده کند | passed |
| CAPABILITY-GET-04 | permission صریح discover/use اعمال شود ولی entitlement قفل‌شده را فعال نکند | passed |
| CAPABILITY-GET-05 | feature flag فقط قابلیت فعال را suspend کند و قابلیت تجاری قفل‌شده را فعال نکند | passed |
| CAPABILITY-GET-06 | Solo/Pro و entitlement دو تعمیرگاه از هم جدا بمانند | passed |
| CAPABILITY-GET-07 | حساب ناشناس/unbound، شعبه غیرمجاز، query spoof و branch تکراری رد شوند؛ GET بدون write | passed |
| CAPABILITY-GET-08 | لغو عضویت میان resolve و read دوباره کنترل و رد شود | passed |
| CAPABILITY-GET-09 | کاتالوگ خالی/disabled پاسخ موفق ناقص ندهد و 503 برگرداند | passed |
| D1-LOCAL-Q | هشت migration روی D1 محلی تازه؛ ۱۱ module و ۱۷ entitlement؛ سه denial و readback بدون تغییر | passed 1/1 |

- مجموعه محلی بدون wrapperهای D1 اشتراکی: ۱۶۷/۱۶۷ entry پاس؛ شامل ۱۶۵ سناریو و دو wrapper. wrapper گردش‌کار داخل خود ۵۵/۵۵ بررسی پایه را پاس کرد.
- TypeScript `--noEmit`، lint محدود فایل‌های تغییرکرده، build رسمی Sites و source preservation پاس شدند؛ ۶۷ hash، ۲۰ منو و ۲۷ مسیر API رابط حفظ شدند.
- migrationهای 0000 تا 0007 به‌ترتیب روی D1 محلی تازه اعمال شدند. readback هویت، terms/token، draft و capability پاس شد؛ `PRAGMA foreign_key_check` صفر بود.

## Blast radius و محدودیت

- GET قابلیت‌ها اکنون DB-backed است؛ POST رویداد قابلیت و درخواست فعال‌سازی عمداً هنوز 503 است و پاسخ موفق ساختگی ندارد.
- کاتالوگ hosted seed نشده، D1 میزبانی‌شده و مسیر شبکه اجرا نشده‌اند. انتشار فعال همچنان static checkpoint است.
- `auth.php`/actor و انتخاب شعبه رابط، followups، adapter شرایط/نسخه دستگاه/پیش‌نویس/CSRF و تست مرورگر/E2E هنوز بازند.
- ۲۳ جدول از ۱۰۴ جدول مرجع منتقل شده‌اند؛ این شمارش درصد پیشرفت نیست. انبار simple/pro همچنان fail-closed است.

نقطه ادامه: قرارداد authoritative actor/context و انتخاب شعبه از عضویت D1؛ پس از آن adapter رابط پذیرش. POST activation/event قابلیت‌ها باید در یک گام تراکنشی جدا با audit/idempotency منتقل شود.
