# اجرای 20261011Y — mutation نسخه‌دار پرونده

نسخه مبنا: `848d2b210534714dff92e75d6ffd517727663a27`. دامنه این اجرا فقط blocker شماره A08 بود: نسخه authoritative پرونده از پاسخ واقعی operations تا تمام mutationهای پرونده حمل شود و PATCH به‌جای gate موقت، با optimistic lock و شواهد اتمیک اجرا شود. schema، هشت migration، ساختار ۲۳ جدول، منوها و قراردادهای مرحله‌ای V2 تغییر نکردند. هیچ استیجینگ، داده مشتری واقعی، پیامک یا پرداخت واقعی استفاده نشد.

## علت ریشه‌ای و اصلاح محدود

- GET عملیات مقدار `row_version` را می‌خواند، اما نوع رابط آن را نگه نمی‌داشت و PATCH هیچ `expectedVersion` از کلاینت دریافت نمی‌کرد؛ route نیز هنوز با پاسخ 503 بسته بود. بنابراین کاربر نمی‌توانست stale write را از mutation معتبر جدا کند.
- `RepairCaseRecord` اکنون `expectedVersion` را از projection واقعی D1 نگه می‌دارد. سازنده بدنه PATCH وجود عدد صحیح امن و نامنفی را اجباری می‌کند. handler مرکزی همه منوهای پرونده، از جمله «کارهای من»، نسخه همان snapshot را می‌فرستد؛ بعد از موفقیت snapshot را تازه می‌کند و در 409 نیز نسخه/داده authoritative دوباره خوانده می‌شود.
- PATCH واقعی فقط `/api/operations.php`، مبدأ یکسان، JSON محدود، scope سروری و CSRF وابسته به حساب/کاربر/تعمیرگاه/شعبه را می‌پذیرد. نقش، shop، branch و هویت ارسالی از بدنه پذیرفته نمی‌شوند.
- مدیر، پذیرش، تکنسین و کنترل کیفیت مطابق قواعد مرجع مجازند؛ تکنسین/QC فقط پرونده واگذارشده خود را می‌بینند و نمی‌توانند مسئول، مالی یا تحویل را تغییر دهند. انباردار و مالی توکن scoped می‌گیرند، اما PATCH آن‌ها با 403 و بدون write رد می‌شود؛ صدور توکن مجوز عملیاتی ایجاد نمی‌کند.
- UPDATE با `id/shop/branch/row_version/status` و عضویت/مجوز فعال guard می‌شود. در همان `D1 batch` دقیقاً یک event و یک audit وابسته به موفقیت UPDATE نوشته می‌شود. شکست event/audit کل پرونده را rollback می‌کند؛ revoke عضویت، تغییر assignee، stale version یا race بدون overwrite طبقه‌بندی می‌شوند.
- هر تغییر صریح یا ضمنی وضعیت پرونده دارای workflow با 409 رد می‌شود؛ حتی تخصیص مسئول به پرونده `awaiting_assignment` نمی‌تواند قاعده «وضعیت V2 فقط از موتور فرایند» را دور بزند. گزارش/نتیجه غیرمرحله‌ای همچنان از قرارداد واقعی پرونده عبور می‌کند.
- چهار فایل frozen رابط یعنی `directadmin-api.ts`، `operations.ts`، `page.tsx` و `technician-workbench.tsx` عمداً تغییر و hash آن‌ها بازتأیید شدند. ۱۵ فایل frozen رابط دیگر، هر ۲۰ منو و ۲۷ قرارداد API مصرف‌شده بدون تغییر ماندند.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| UI-CASE-01 | سازنده بدنه بدون `expectedVersion` یا با ID/نسخه/مبلغ نامعتبر پیش از dispatch fail-closed شود | passed |
| UI-CASE-02 / `TEST-TAMIRAN-1011Y-A08-*` | مدیر یک تغییر ثبت کند؛ نسخه `0→1`، یک event و یک audit تازه؛ retry دقیق با 409 و snapshot ثابت | passed |
| UI-CASE-03 | هر شش نقش CSRF وابسته به scope بگیرند؛ مدیر/پذیرش/تکنسین/QC mutation مجاز انجام دهند و انبار/مالی 403 بدون write بگیرند | passed |
| UI-CASE-04 | stale، race هم‌زمان، scope خارجی، بدنه جعل‌شده، CSRF مفقود، تغییر صریح وضعیت V2 و تخصیص ضمنی تغییر‌دهنده وضعیت همگی بدون evidence اضافه رد شوند | passed |
| UI-CASE-05 | شکست تزریق‌شده event کل case/audit را rollback کند؛ لغو عضویت میان read و batch با 403 و بدون mutation برنده شود | passed |
| رگرسیون Node | ۲۰۶ ورودی Node شامل ۵ سناریوی تازه، schema/core و source preservation | passed؛ workflow برابر ۵۵/۵۵ |
| Wrangler local D1 | هشت migration روی state تازه؛ identity/readback، terms/token، draft، capability و readback تازه case/version/event/audit | passed 6/6؛ hosted/network/E2E اجرا نشد |
| TypeScript و build رسمی Sites/Vinext | `tsc --noEmit` و ساخت routeهای `/`، `/software` و API | passed |
| lint محدود | route، adapter، repository، projection و تست‌های A08 بدون خطا یا هشدار | passed |
| lint مستقیم UI | `page.tsx` برابر ۱۰ خطا/۱ هشدار و `technician-workbench.tsx` برابر ۲ خطا/۲ هشدار، دقیقاً برابر commit مبنا | unchanged baseline؛ lint صفر اعلام نمی‌شود |
| source preservation | ۶۷ hash، ۲۰ منوی اصلی، ۲۷ قرارداد frontend API و صفر staging request | passed؛ چهار hash عمداً بازتأیید شد |
| Site foundation | شناسه Site، هشدار demo/status، جداسازی asset و نبود overlay تأییدنشده | passed |

همه شناسه‌ها و مقادیر آزمون با پیشوند `TEST-TAMIRAN-1011Y-A08` در SQLite حافظه‌ای یا Wrangler D1 محلی و ایزوله بودند. هیچ پرونده، event یا audit در D1 میزبانی‌شده یا داده مشتری ایجاد نشد.

## Blast radius، محدودیت و نقطه ادامه

- مرورگر و DOM به‌علت در دسترس نبودن `control-browser` اجرا نشد؛ مشاهده واقعی پیام 409، focus، RTL، موبایل و چاپ هنوز `NOT_RUN/BLOCKED` است. موفقیت source/type/handler محلی E2E مرورگر نیست.
- Worker شبکه‌ای و D1 میزبانی‌شده استفاده نشدند. root منتشرشده همچنان گزارش خصوصی status/demo است و Candidate Worker عملیاتی جایگزین آن نشده است.
- A08 فقط در سطح source/type/Request-Response/SQLite/Wrangler-local بسته شد. این نتیجه «آماده پایلوت» یا «صفر باگ» نیست.
- نقطه ادامه محدود بعدی: POST/DELETE احراز هویت و سیاست single-active-session/logout را با revoke و شش نقش منتقل و آزمون کن. پس از آن capability POST activation/event، انبار simple/pro و چرخه تکنسین تا QC/مالی/تحویل باز می‌مانند.

نقطه ادامه: نشست/خروج authoritative را مستقل، بدون تغییر منو و بدون تماس با استیجینگ پیاده و با داده کاملاً آزمایشی آزمون کن.
