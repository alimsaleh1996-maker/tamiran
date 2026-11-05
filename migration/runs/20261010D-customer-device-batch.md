# 20261010D — customer upsert و دستگاه جدید در batch پذیرش

Source HEAD at opening: `b423612b67e69d90cf83d61bdfcceecebccf1cab`.

## دامنه و علت

مرحله چهارم محدود از `d1-core`: افزودن customer upsert و ساخت دستگاه جدید به همان تراکنش اتمیک پذیرش. مرحله قبل فقط مشتری و دستگاه موجود را می‌پذیرفت و بنابراین هنوز مسیر داده واقعی پذیرش را مدل نمی‌کرد. هم‌زمان، کنترل تکراری‌نبودن سریال فقط در برنامه بود و در برابر دو درخواست هم‌زمان تضمین دیتابیسی نداشت.

این تغییر endpoint یا UI را فعال نمی‌کند و فقط در Candidate سایت‌ساز است. استیجینگ، hosted D1، مشتری واقعی، پیامک و پرداخت فراخوانی نشدند.

## تغییر

- `createReceptionWithNewDevice` نام مشتری، موبایل ایران با ارقام فارسی/عربی، کدملی اختیاری با checksum، کدپستی اختیاری و مدل فعال متعلق به همان تعمیرگاه را کنترل می‌کند.
- مشتری با کلید `(shop_id, mobile)` upsert می‌شود؛ مشتری موجود تکرار نمی‌شود و فقط داده مجاز ورودی به‌روز می‌شود.
- مشتری، دستگاه، sequence قبض، پرونده، workflow، stage event، case event و audit در یک batch اتمیک نوشته می‌شوند.
- index غیر یکتای سریال با partial unique index روی `(shop_id, normalized_identifier)` جایگزین شد. مقدار null/خالی مجاز است، اما سریال غیرخالی پس از نرمال‌سازی در یک تعمیرگاه تکرار نمی‌شود.
- replay همان idempotency و payload فقط خواندنی است؛ همان کلید با payload متفاوت conflict می‌دهد. شکست uniqueness نیز تنها پس از readback و تطابق کامل می‌تواند replay تلقی شود.
- migration جدید با generator رسمی Drizzle ساخته شد و migrationهای 0000/0001 تغییر نکردند.

## شواهد

| اجرا | انتظار | نتیجه |
|---|---|---|
| `node --test tests/reception-new-device.test.mjs` | مشتری جدید، مشتری موجود، سریال تکراری، retry/conflict و rollback | passed 5/5 |
| schema/case/repository regression | مراحل قبلی بدون پسرفت | passed 48/48 |
| source/workflow tests | 67 frozen hash، 20 menu، 27 frontend API paths و قواعد | passed؛ 55/55 baseline checks |
| `tsc --noEmit` | typecheck | exit 0 |
| eslint فایل implementation و test مرحله | بدون خطای تازه | exit 0 |
| build Candidate | تولید Worker و `wrangler.json` | passed |
| migration 0000، 0001 و 0002 روی Wrangler local D1 تازه | schema کامل محلی | 24+53+2 statements passed |
| `d1-local.test.mjs` و readback | seed، FK، cross-shop denial و عدم تغییر | passed؛ 7 role، 7 membership، 0 FK violation |
| `node --test tests/site-foundation.test.mjs` در root | هویت Site و جداسازی asset | passed 1/1 |

Fixtureهای این مرحله `TEST-TAM-1010D-*` و داده‌های کاملاً ساختگی دارند. هیچ داده مشتری، مقصد ارتباطی، پیامک یا پرداخت واقعی استفاده نشده است.

## پوشش سناریو

- D1-RECEPTION-09: مشتری و دستگاه جدید؛ کل گراف یک‌بار commit شد.
- D1-RECEPTION-10: مشتری موجود با همان موبایل؛ یک مشتری ماند، داده مجاز به‌روز و یک دستگاه جدید ساخته شد.
- D1-RECEPTION-11: سریال نرمال‌شده تکراری؛ customer/device/case/receipt همگی rollback شدند.
- D1-RECEPTION-12: double-click همان payload read-only بود و payload متفاوت رد شد.
- D1-RECEPTION-13: شکست تزریقی workflow؛ device/case/receipt و sequence همگی rollback شدند.

## محدودیت و نقطه ادامه

این مرحله فقط داده هسته‌ای را پوشش می‌دهد. update دستگاه موجود، policy اجباری‌بودن نشانی، جدول/فهرست رنگ، گزینه‌های ظاهر و لوازم، رضایت‌ها و مجوز پاک‌کردن هنوز منتقل نشده‌اند. route شبکه، session/CSRF، hosted D1، هم‌زمانی واقعی چند Worker، browser/mobile/print و E2E همه نقش‌ها اجرا نشده‌اند. adapter تست تراکنش از رفتار D1/SQLite تقلید می‌کند، اما جای اجرای repository روی hosted D1 نیست. lint کامل همان ۲۳ خطای قدیمی UI را دارد.

گام بعدی: existing-device update را با قواعد baseline و optimistic/version guard اضافه کن و settings موردنیاز پذیرش را به migration بعدی منتقل کن؛ سپس create_case را فقط پشت هویت Site و کنترل origin/CSRF عرضه کن. success و denial با fixture مشخص برای repair_manager، reception، technician و cross-shop باید از API واقعی اجرا شوند.

## Fingerprint

- `migration/worker/lib/reception-new-device.ts`: `0cd20d031d33717d2467ffb53d3c3e2822e2c4ae17198f2bd235a1ff6b719887`
- `migration/worker/tests/reception-new-device.test.mjs`: `7b201879d0a3b66993572f48060af06280f6278370d09af797d2aa53a210d7a6`
- `migration/worker/db/schema.ts`: `c7de653a5fc30b8a2f9ce2d57f4ca15871a6952ef794f523773f5b9e2d3ba490`
- `migration/worker/drizzle/0002_spotty_havok.sql`: `808cbfe8c7f8c47d6b7c99e2011d3f0e8bb750a3231f84ccbd337962b64ee792`
