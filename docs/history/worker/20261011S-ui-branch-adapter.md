# اجرای 20261011S — adapter شعبه و CSRF رابط

نسخه مبنا: `9f7a3ba240bb0f833ba81685139cbf501ac81d19`. دامنه این اجرا فقط اتصال context معتبر مرحله قبل به درخواست‌های رابط اصلی `/software` بود. ۱۹ فایل frozen رابط و ۲۰ منوی اصلی، schema و هر هشت migration بدون تغییر ماندند. استیجینگ، داده مشتری واقعی، پیامک و پرداخت واقعی استفاده نشدند. Candidate میزبانی‌شده و آمادگی پایلوت تأیید نشده‌اند.

## علت و تغییر محدود

ممیزی A07 نشان داده بود که رابط، شعبه انتخاب‌شده را به همه APIها نمی‌فرستد و دو cache مستقل CSRF در `directadmin-api.ts` و `followups-api.ts` از شعبه جاری آگاه نیستند. تغییر مستقیم این فایل‌های frozen خطر بازطراحی و انحراف از مرجع را داشت؛ بنابراین یک boundary و request adapter بیرون از آن‌ها افزوده شد:

- `/software` پس از احراز هویت Sites، ابتدا `GET /api/auth.php` را اجرا می‌کند و رابط frozen را فقط بعد از حل actor/context معتبر D1 mount می‌کند.
- اگر حساب چند context مجاز داشته باشد، selector فقط همان contextهای برگشتی سرور را نشان می‌دهد. `branchId` نشانی یا session storage صرفاً درخواست انتخاب است؛ سرور عضویت را دوباره اعتبارسنجی می‌کند و شعبه بیگانه را رد می‌کند.
- درخواست‌های same-origin به `/api/*.php` برای `GET/HEAD`، `branchId` authoritative را در query می‌گیرند. نوشتن JSON همان شناسه را فقط در body می‌گیرد و آن را از URL POST حذف می‌کند تا قرارداد dispatcher حفظ شود.
- branch تکراری، متناقض، نامعتبر یا body متناقض قبل از `fetch` متوقف می‌شود. درخواست بیرونی و assetها دست‌نخورده می‌مانند.
- تعویض شعبه با reload کامل document انجام می‌شود؛ بنابراین هر دو cache سراسری توکن CSRF در ماژول‌های frozen از نو ساخته می‌شوند و توکن شعبه قبلی قابل استفاده مجدد نیست.
- مدیر مرکزی بدون branch adapter باقی می‌ماند. حالت‌های portal/track فعلاً از adapter عبور داده نمی‌شوند تا قرارداد عمومی آینده دستکاری نشود؛ خود `/software` همچنان احراز هویت Sites می‌خواهد.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| UI-BRANCH-01 | فقط یک شناسه شعبه مثبت و safe از URL/storage پذیرفته شود | passed |
| UI-BRANCH-02 | انتخاب شعبه view فعلی را حفظ و branch را دقیقاً یک‌بار جایگزین کند | passed |
| UI-BRANCH-03 | GET شعبه را بدون حذف query و با credentials موجود حمل کند | passed |
| UI-BRANCH-04 | POST JSON شعبه را فقط در body حمل کند و URL بدون query بماند | passed |
| UI-BRANCH-05 | query/body تکراری یا متناقض پیش از fetch رد شود | passed |
| UI-BRANCH-06 | CSRF شعبه‌دار و درخواست بیرونی/asset دست‌نخورده باشند | passed |
| UI-BRANCH-07 | هر شش برچسب نقش عملیاتی از adapter یکسان استفاده کنند | passed |
| UI-BRANCH-08 / `TEST-TAMIRAN-1010S-*` | adapter به handler واقعی محلی و SQLite وصل شود؛ token شعبه ۱ برای write شعبه ۳ پاسخ 419 بدهد و هر شعبه دقیقاً یک draft مستقل ثبت کند | passed |

- مجموعه رگرسیون محلی: ۱۸۳/۱۸۳ Node entry، شامل ۱۸۱ سناریو و دو wrapper؛ wrapper گردش‌کار ۵۵/۵۵ بررسی پایه را پاس کرد.
- source preservation: ۶۷ hash frozen، ۲۰ منوی اصلی و ۲۷ قرارداد frontend API بدون تغییر؛ staging request صفر.
- TypeScript `--noEmit`، ESLint محدود چهار فایل مرحله و build رسمی Sites/Vinext پاس شدند؛ routeهای `/`، `/api/:endpoint`، `/software` و `/tamiran` ساخته شدند.
- هر هشت فایل schema-only به‌ترتیب روی Wrangler D1 محلی تازه اجرا شدند. پنج check مستقل identity/readback، terms/token، draft envelope و capability entitlement/denial پاس شدند؛ `foreign_key_check` صفر و write بین‌تعمیرگاهی رد و بدون تغییر readback شد.
- فرمان convenience مربوط به `d1 migrations apply` به‌علت نبود `migrations_dir` در `dist/server` چیزی اعمال نکرد و با خطای تنظیمات متوقف شد؛ سپس فایل‌های رسمی `drizzle/*.sql` صریح و به‌ترتیب روی همان D1 محلی اعمال شدند. remote/hosted استفاده نشد.

## Blast radius و محدودیت

- هیچ schema یا migration جدیدی لازم نبود. فایل‌های frozen رابط و baseline hashها تغییر نکردند؛ wrapper فقط پیش از mount و در مرز `fetch` قرار گرفت.
- bootstrap فعلی هنوز all-or-nothing است: درخواست منتقل‌نشده `followups.php` می‌تواند نتیجه موفق auth/settings/catalog/operations/capabilities را در رابط کنار بزند. بنابراین وجود adapter به معنی پذیرش عملیاتی موفق در مرورگر نیست.
- `draftExpectedVersion`، شناسه و hash شرایط واقعاً نمایش‌داده‌شده، `expectedDeviceVersion` و `expectedVersion` پرونده هنوز به state/submit رابط وصل نشده‌اند. خطاهای autosave/discard نیز باید صریح نشان داده شوند.
- سیاست original single-active-session و logout/revocation، POST قابلیت، انبار simple/pro و چرخه تکنسین تا QC/مالی/تحویل همچنان منتقل نشده‌اند.
- Worker/API و D1 میزبانی‌شده، ورود واقعی نقش‌ها، browser/mobile/print و E2E اجرا نشدند؛ ابزار کنترل مرورگر در دسترس نبود. root فعال همچنان status/demo static است و نسخه آماده پایلوت نیست.

نقطه ادامه: bootstrap رابط را از dependency منتقل‌نشده followups جدا کن تا پاسخ‌های موفق واقعی دور ریخته نشوند؛ سپس نسخه‌های draft/terms/device/case را با پاسخ authoritative متصل و مسیر پذیرش آزمایشی تا قبض را در مرورگر و Worker میزبانی‌شده آزمون کن.
