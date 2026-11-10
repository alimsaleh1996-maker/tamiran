# 20261010B — ساختار پرونده، قبض و شواهد

Source HEAD at opening: `c247e5dcb3dbee319d2e0004e514092a6f769a8b`.

## دامنه و علت

مرحله دوم محدود از `d1-core`: انتقال کاتالوگ دستگاه، دستگاه مشتری، شمارنده قبض، پرونده، گردش‌کار، رویداد مرحله و audit از schema مرجع. دلیل ریشه‌ای: پس از مرحله هویت/مشتری، هنوز هیچ محل پایدار و محدودشده‌ای برای دستگاه، قبض و پرونده وجود نداشت و بنابراین تراکنش واقعی پذیرش قابل ساخت نبود.

هیچ endpoint عملیاتی نشده، UI و ۲۰ منو تغییر نکرده‌اند، استیجینگ یا سرویس بیرونی فراخوانی نشده و پیامک/پرداخت واقعی وجود ندارد. انتشار فعال همچنان صفحه هشدار static است؛ Candidate ناقص جایگزین نرم‌افزار عملیاتی نشده است.

## تغییر

- ده جدول افزوده شد: `repair_device_types`، `repair_device_brands`، `repair_device_models`، `repair_receipt_sequences`، `repair_customer_devices`، `repair_cases`، `repair_case_workflows`، `repair_case_events`، `repair_case_stage_events` و `tamiran_audit_log`.
- هر ۱۳۶ ستون مرجع این ده جدول، کلیدها و indexهای پایه حفظ شدند. migration قبلی `0000` و snapshot آن بدون تغییر ماندند.
- FKهای ترکیبی اضافه، actor/technician پرونده و audit را به همان تعمیرگاه محدود می‌کنند.
- trigger دامنه کاتالوگ، مدل دستگاه را تا زنجیره type → brand → model به shop دستگاه محدود می‌کند؛ خلأ FK نسخه مرجع بسته شد.
- UUID، شماره و sequence قبض، public receipt و tracking token پس از ایجاد تغییرناپذیرند. شمارنده قبض نمی‌تواند کاهش یابد.
- event مرحله، event پرونده و audit append-only شدند؛ actor رویداد باید عضو همان shop باشد. parent case نیز نمی‌تواند به shop دیگر اشاره کند.
- JSON nullable ممیزی درست پشتیبانی می‌شود؛ JSON نامعتبر، enum نامعتبر و عدد منفی رد می‌شوند.

این migration فقط schema است. seedهای `TEST-TAMIRAN-1010A-*` و `TEST-TAMIRAN-1010B-*` جدا هستند و در migration میزبانی‌شده اجرا نمی‌شوند. اطلاعات شامل نام «آزمایشی — …»، شناسه و موبایل غیرواقعی، hash غیرقابل ورود و token غیرواقعی است.

## شواهد

| اجرا | انتظار | نتیجه |
|---|---|---|
| `node --test tests/d1-schema.test.mjs tests/d1-case-core.test.mjs` | phase1 و phase2؛ جداسازی shop/branch، unique، immutable، retry، rollback و JSON | passed 40/40 |
| `node --experimental-strip-types tests/workflow.test.mjs` | قواعد workflow و امنیت قبلی | passed 55/55 |
| `node tests/source-preservation.test.mjs` | سورس frozen، ۲۰ منو و APIها دست‌نخورده | 67 hash، 20 menu، 27 frontend API path verified |
| `node node_modules/typescript/bin/tsc --noEmit` | typecheck | exit 0 |
| Sites build helper در `migration/worker` | build Candidate | passed |
| Wrangler local D1، migration 0000 | schema phase1 | 24 statements passed |
| Wrangler local D1، migration 0001 | schema phase2 + triggerها | 53 statements passed |
| Wrangler local D1، seedهای A و B | داده آزمایشی جدا | 5+10 statements passed |
| D1 CLI readback | گراف سالم | cases=2, workflows=2, case_events=1, audits=1, FK violations=0 |
| D1 CLI cross-shop update | اتصال model shop B به device shop A رد شود | exit 1؛ SQLITE_CONSTRAINT_TRIGGER؛ readback model_id=1 |

اولین اجرای تست‌ها ۳ failure داشت: دو مورد به‌دلیل precedence محافظ immutable/unique و یک مورد به‌دلیل precedence unique/FK در خود انتظار تست بود. هیچ نوشتن نامعتبر پذیرفته نشد. سناریوها به insert مستقل و انتظار دقیق‌تر اصلاح و کل ۴۰ تست دوباره با موفقیت اجرا شدند.

## Blast radius و محدودیت

تغییر فقط در Candidate زیر `migration/worker`، تست‌ها و گزارش وضعیت است. root انتشار static، UI، endpointها، واحد پول، تاریخ شمسی، چاپ، SMS و پرداخت تغییر نکرده‌اند. hosted D1، هویت واقعی Site، API پذیرش، هم‌زمانی چند Worker، مرورگر، موبایل، چاپ، backup/restore و E2E نقش‌ها هنوز not-run/blocked هستند؛ آمادگی پایلوت یا صفر باگ ادعا نمی‌شود.

## نقطه ادامه

گام بعد: resolver هویت server-side از account user به membership فعال shop/branch؛ سپس repository اتمیک پذیرش با خواندن facts از DB، تخصیص sequence، insert مشتری/دستگاه/پرونده/workflow/event/audit در یک عملیات، idempotency و readback. سناریوهای success، double-click، retry پس از قطع، cross-branch، actor غیرفعال، rollback و عدم تولید شماره تکراری باید اجرا شوند. migrationهای 0000 و 0001 و metadata آنها تغییر نکنند.

## Fingerprint

- `db/schema.ts`: `c4a15b67da2afc52d486163e45f93972e677053b4d065afad91c34be19ed2913`
- `drizzle/0001_petite_ben_urich.sql`: `03e471fa6fde97c08b653e0b7fe2acd785f212deff75f8fc0137dfa3f351dc5d`
- `drizzle/meta/0001_snapshot.json`: `ddd94e2b914b66d98ce4cca86fcdb5dac6bc708805e0dbae0ab090c5eb8b984c`
- `tests/d1-case-core.test.mjs`: `f6cb4c1cd379f4bc5ddbec43b057550bb09ae232fed47ea67a94ba80d5fec429`
- `tests/fixtures/d1-case-core.sql`: `1664799cc9cdc0c21bc88529631e99b9bf66d288b4945843b918159c2db91667`
