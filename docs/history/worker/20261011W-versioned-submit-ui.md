# اجرای 20261011W — submit نسخه‌دار دستگاه قبلی و پیش‌نویس

نسخه مبنا: `11db6a198a1c01e15e43601eb8ebc27d7840e50a`. دامنه این اجرا فقط blocker شماره A05 از ممیزی `20261010P` بود: نسخه authoritative دستگاه قبلی و پیش‌نویس بازیابی‌شده باید همراه شناسه همان رکورد به `create_case` برسد. schema، هشت migration، منوها، قواعد نقش و endpointها تغییر نکردند. هیچ استیجینگ، داده مشتری واقعی، پیامک یا پرداخت واقعی استفاده نشد.

## تغییر محدود و fail-closed

- پاسخ واقعی جست‌وجوی مشتری از قبل `expectedDeviceVersion` و فهرست پیش‌نویس‌ها از قبل `version` داشت. type/state رابط اکنون این دو مقدار را بدون ساختن fallback نگه می‌دارند.
- `buildPreviousDeviceSelection` فقط دو حالت می‌سازد: برای دستگاه جدید `{}`؛ برای دستگاه قبلی جفت کامل `previousDeviceId` و `expectedDeviceVersion`. شناسه غیرمثبت یا نسخه مفقود، منفی، اعشاری یا ناامن پیش از dispatch رد می‌شود.
- `buildDraftSubmissionSelection` فقط دو حالت می‌سازد: نبود پیش‌نویس `{}`؛ یا جفت کامل `draftPublicId` و `draftExpectedVersion`. شناسه خالی/بیش از ۲۶ نویسه و نسخه نامعتبر پیش از dispatch رد می‌شود.
- بازیابی پیش‌نویس، نسخه فهرست‌شده را کنار شناسه نگه می‌دارد؛ اولین ذخیره موفق نیز نسخه پاسخ سرور را نگه می‌دارد. submit فرم هر دو جفت نسخه‌دار را از همان state به payload می‌افزاید.
- در مسیر API واقعی، سابقه بدون نسخه ساخته‌شده از snapshot پرونده‌ها دیگر جای پاسخ authoritative جست‌وجوی مشتری را نمی‌گیرد. مسیر نمایشی غیرفعال دست‌نخورده ماند، ولی helper اجازه ارسال دستگاه قبلی بی‌نسخه را نمی‌دهد.
- A06 عمداً وارد این تغییر نشد: autosave و discard هنوز نسخه جاری را برای mutation بعدی نمی‌فرستند و خطای 409 را به اپراتور نشان نمی‌دهند.
- سه فایل frozen یعنی `directadmin-api.ts`، `modules.tsx` و `operations.ts` عمداً تغییر و hash آن‌ها بازتأیید شد. ۱۶ فایل frozen دیگر، هر ۲۰ منو و ۲۷ قرارداد API مصرف‌شده رابط بدون تغییر ماندند.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| UI-VERSION-01 | نبود انتخاب هیچ فیلدی نسازد؛ شناسه و نسخه دستگاه/پیش‌نویس فقط به‌صورت جفت کامل ساخته شوند؛ مقدار مفقود/منفی/اعشاری/ناامن fail-closed شود | passed |
| UI-VERSION-02 / `TEST-TAMIRAN-1011W-A05-*` | مدیر و پذیرش نسخه دستگاه را از customer lookup واقعی محلی بخوانند، همان دستگاه را بدون ساخت device دوم ثبت و retry را read-only کنند؛ تکنسین، QC، انبار و مالی 403 و بدون write؛ نسخه stale پاسخ 409 و snapshot ثابت | passed |
| UI-VERSION-03 / `TEST-TAMIRAN-1011W-A05-DRAFT-*` | مدیر و پذیرش پیش‌نویس را با API ذخیره، نسخه را از operations list بازیابی و دقیقاً یک‌بار submit کنند؛ چهار نقش دیگر save/create را 403 و بدون write بگیرند | passed |
| UI-VERSION-04 / `TEST-TAMIRAN-1011W-A05-DRAFT-STALE` | جفت ناقص 400، نسخه صفر پس از ویرایش به نسخه یک 409 و بدون write، نسخه جاری 200 و retry دقیق read-only | passed |
| رگرسیون Node | ۱۹۷ سناریوی inline، شامل ۴ سناریوی تازه و workflow wrapper | passed؛ workflow برابر ۵۵/۵۵ |
| Wrangler local D1 | draft، identity/readback، receipt/token و capability به‌ترتیب و روی state آزمایشی تازه | passed 5/5؛ hosted/network/E2E اجرا نشد |
| TypeScript و build رسمی Sites/Vinext | `tsc --noEmit` و ساخت routeهای `/`، `/software` و API | passed |
| lint محدود | helper، type/API و دو تست A04/A05 بدون خطا یا هشدار | passed |
| lint مستقیم UI | `modules.tsx` همان ۳ خطا/۲ هشدار و `page.tsx` همان ۱۰ خطا/۱ هشدار شناخته‌شده | بدون افزایش؛ بدهی قدیمی صفر اعلام نمی‌شود |
| source preservation | ۶۷ hash، ۲۰ منوی اصلی، ۲۷ قرارداد frontend API و صفر staging request | passed؛ سه hash عمداً بازتأیید شد |
| Site foundation | شناسه Site، هشدار demo/status، جداسازی asset و نبود overlay تأییدنشده | passed |

اجرای نخست رگرسیون، پس از پاس‌شدن ۱۹۶ سناریوی محصول، فقط روی hash قدیمی اولین فایل frozen متوقف شد. پس از بازتأیید محدود سه فایل مجاز، اجرای کامل دوباره ۱۹۷/۱۹۷ پاس شد. پنج wrapper رسمی D1 نیز پس از build و به‌ترتیب runbook اجرا شدند. این بازتأیید تغییر منو، schema یا API نبود.

در سناریوهای متمرکز A05 پنج پرونده کاملاً مصنوعی ساخته شد: دو پرونده دستگاه قبلی برای مدیر/پذیرش، دو تبدیل پیش‌نویس برای همان دو نقش و یک تبدیل نسخه جاری پس از رد نسخه stale. همه در دیتابیس‌های SQLite حافظه‌ای تست بودند؛ هیچ داده عملیاتی یا میزبانی‌شده نوشته نشد.

## Blast radius، مانع و نقطه ادامه

- فرم مرورگری و DOM به‌علت در دسترس نبودن `control-browser` اجرا نشد. بنابراین کلیک واقعی، focus، نمایش 409، RTL، موبایل و چاپ هنوز `NOT_RUN/BLOCKED` هستند؛ موفقیت source/type/handler محلی به‌عنوان E2E مرورگر گزارش نمی‌شود.
- Worker، شبکه و D1 میزبانی‌شده استفاده نشدند؛ root فعال همچنان status/demo static است و پذیرش عملیاتی ایجاد نشد.
- A05 در سطح source/type/serialization/handler/SQLite محلی بسته شد. این نتیجه «آماده پایلوت» یا «صفر باگ» نیست.
- نقطه ادامه A06 است: autosave باید `expectedVersion` جاری را بفرستد، discard باید همان نسخه را مصرف کند، پاسخ نسخه جدید state را به‌روزرسانی کند و تعارض 409 به‌جای swallow شدن با مسیر بازیابی/بازخوانی روشن به اپراتور نمایش داده شود. این مرحله نیز باید save/edit/discard، retry، race و هر شش نقش را با داده مصنوعی پوشش دهد.
- بعد از A06، `expectedVersion` پرونده، session/logout، capability POST، inventory simple/pro و چرخه تکنسین تا QC/مالی/تحویل باز می‌مانند.

نقطه ادامه: A06 را محدود و مستقل اجرا کن؛ نسخه mutation پیش‌نویس را برای autosave/discard وصل کن و تعارض را قابل مشاهده و قابل بازیابی کن، بدون تغییر منو یا ورود به استیجینگ/داده واقعی.
