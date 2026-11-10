# اجرای 20261011U — اتصال شرایط فعال پذیرش به رابط

نسخه مبنا: `0656f1e48f086de940e9f8ffe002343b3eec568f`. دامنه این اجرا فقط blocker شماره A03 از ممیزی `20261010P` بود: متن نسخه فعال شرایط پذیرش باید از پاسخ authoritative تنظیمات نمایش داده شود و همان شناسه دیتابیس و hash محتوا فقط پس از تأیید صریح اپراتور به `create_case` برسد. schema، هشت migration، منوها، قواعد نقش و endpointها تغییر نکردند. هیچ استیجینگ، داده مشتری واقعی، پیامک یا پرداخت واقعی استفاده نشد.

## تغییر محدود و fail-closed

- helper خالص `app/software/reception-ui-contract.ts` پاسخ snake-case واقعی تنظیمات را به مدل صریح UI تبدیل می‌کند. شناسه و شماره نسخه باید عدد صحیح مثبت، متن/عنوان/شناسه عمومی/تاریخ مؤثر باید ناتهی و hash باید دقیقاً ۶۴ رقم hex کوچک باشد؛ payload مفقود به `null` و payload بدشکل به خطای واقعی تبدیل می‌شود.
- loader تنظیمات پیش از اعمال state نسخه فعال را اعتبارسنجی می‌کند. payload بدشکل core bootstrap را reject می‌کند و به داده ناقص یا شرایط ساختگی تبدیل نمی‌شود.
- فرم پذیرش عنوان، شماره نسخه، شناسه عمومی و متن کامل همان نسخه را قبل از ثبت نشان می‌دهد. checkbox تا کامل‌شدن نام و موبایل فعال نمی‌شود و کلید تأیید به نسخه ID/hash و همان نام/موبایل متصل است؛ تغییر مشتری یا نسخه، تأیید قبلی را بی‌اعتبار می‌کند.
- `CreateRepairCaseInput` اکنون `receiptAcceptance` اجباری دارد. submit فقط `{versionId, contentSha256, accepted:true}` را می‌فرستد؛ پذیرش خودکار، OTP، امضا یا evidence ساختگی اضافه نشده است. سرور همچنان فعال‌بودن نسخه، hash متن ذخیره‌شده و تغییر نسخه را دوباره کنترل می‌کند.
- برای این اصلاح سه فایل frozen یعنی `page.tsx`، `modules.tsx` و `operations.ts` عمداً تغییر و hash آنها بازتأیید شد. ۱۶ فایل frozen دیگر، هر ۲۰ منو و ۲۷ قرارداد API مصرف‌شده رابط بدون تغییر ماندند.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| UI-TERMS-01 | تبدیل payload واقعی تنظیمات بدون تغییر متن یا hash؛ رد hash بدشکل | passed |
| UI-TERMS-02 | نبود نسخه، نبود تأیید و کلید نسخه قدیمی رد شود؛ فقط ID/hash دقیق پذیرفته شود | passed |
| UI-TERMS-03 / `TEST-TAMIRAN-1011U-A03-*` | هر شش نقش نسخه یکسان را از handler/SQLite واقعی محلی بخوانند؛ مدیر و پذیرش دو پرونده آزمایشی بسازند؛ تکنسین، QC، انبار و مالی 403 و بدون write بگیرند | passed |
| رگرسیون Node | ۱۹۰ سناریوی inline، شامل ۳ سناریوی تازه و workflow wrapper | passed؛ workflow برابر ۵۵/۵۵ |
| Wrangler local D1 | draft، identity/readback، receipt/token و capability به‌ترتیب و روی state آزمایشی تازه | passed 5/5؛ hosted/network/E2E اجرا نشد |
| TypeScript و build رسمی Sites/Vinext | `tsc --noEmit` و ساخت routeهای `/`، `/software` و API | passed |
| lint محدود | helper، تست و `operations.ts` بدون خطا/هشدار | passed |
| lint مستقیم UI | `modules.tsx` همان ۳ خطا/۲ هشدار و `page.tsx` همان ۱۰ خطا/۱ هشدار شناخته‌شده | بدون افزایش؛ بدهی قدیمی صفر اعلام نمی‌شود |
| source preservation | ۶۷ hash، ۲۰ منوی اصلی، ۲۷ قرارداد frontend API و صفر staging request | passed؛ سه hash عمداً بازتأیید شد |
| Site foundation | شناسه Site، هشدار demo/status، جداسازی asset و نبود overlay تأییدنشده | passed |

در اجرای اولیه کل glob تست، ۱۹۰ سناریوی inline پاس شدند و پنج wrapper D1 به علت نبود artifact ساخت و اجرای هم‌زمان روی یک state شروع نشدند. پس از build رسمی، همان پنج wrapper مطابق runbook به‌صورت ترتیبی اجرا و همگی پاس شدند. این رویداد به‌عنوان ترتیب پیش‌نیاز ثبت شد و failure محصول یا عبور خاموش تلقی نشد.

## Blast radius، مانع و نقطه ادامه

- فرم مرورگری و DOM به‌علت در دسترس نبودن `control-browser` اجرا نشد. متن، checkbox، focus، RTL، موبایل و چاپ مشاهده‌ای هنوز `NOT_RUN/BLOCKED` هستند.
- Worker، شبکه و D1 میزبانی‌شده استفاده نشدند؛ root فعال همچنان status/demo static است و پذیرش عملیاتی ایجاد نشد.
- A03 در سطح source/type/handler/SQLite محلی بسته شد، اما مسیر واقعی فرم برای دستگاه جدید هنوز blocker بعدی A04 را دارد: UI مقدار `previousDeviceId: null` می‌فرستد، در حالی که قرارداد strict باید این فیلد را برای دستگاه جدید حذف کند. بنابراین submit واقعی مرورگر تا قبض هنوز قابل ادعای پاس نیست.
- سپس A05 باید `expectedDeviceVersion` و `draftExpectedVersion` را از خواندن authoritative به submit وصل کند و A06 باید نسخه autosave/discard و conflict 409 را قابل مشاهده کند. `expectedVersion` پرونده، session/logout، capability POST، inventory simple/pro و چرخه تکنسین تا QC/مالی/تحویل نیز باز می‌مانند.

نقطه ادامه: A04 را محدود و مستقل اصلاح کن؛ برای دستگاه جدید `previousDeviceId` را حذف و برای سابقه فقط ID مثبت بفرست، با تست strict payload، مسیر مدیر/پذیرش، denial چهار نقش، retry و عدم write روی 400. سپس به نسخه‌های دستگاه و draft برو.
