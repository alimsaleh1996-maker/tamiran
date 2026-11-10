# اجرای 20261011X — autosave و حذف نسخه‌دار پیش‌نویس

نسخه مبنا: `6d902b44ef05e6b18d95c6e06d2dda85ee07b787`. دامنه این اجرا فقط blocker شماره A06 از ممیزی `20261010P` بود: ذخیره خودکار و حذف پیش‌نویس باید نسخه authoritative جاری را بفرستند، نسخه بازگشتی را نگه دارند و تعارض 409 را به‌جای نادیده‌گرفتن به اپراتور نشان دهند. schema، هشت migration، منوها، قواعد نقش و endpointها تغییر نکردند. هیچ استیجینگ، داده مشتری واقعی، پیامک یا پرداخت واقعی استفاده نشد.

## علت ریشه‌ای و اصلاح محدود

- adapter رابط در `save_reception_draft` و `discard_reception_draft` فیلد `expectedVersion` را نمی‌فرستاد. بنابراین اولین ذخیره می‌توانست موفق شود اما ویرایش یا حذف بعدی با قرارداد optimistic-lock بک‌اند ناسازگار بود.
- `catch(() => undefined)` خطای autosave را مخفی می‌کرد؛ اپراتور نمی‌توانست ذخیره ناموفق یا تعارض را تشخیص دهد.
- debounce به‌تنهایی مانع هم‌پوشانی دو درخواست نمی‌شد. صف نسخه‌دار جدید درخواست‌های همان فرم را ترتیبی می‌کند؛ هر mutation فقط بعد از دریافت نسخه قبلی شروع می‌شود و همان نسخه برگشتی را برای درخواست بعد نگه می‌دارد.
- بدنه ذخیره جدید عمداً `expectedVersion` ندارد؛ ویرایش بعدی نسخه جاری را می‌فرستد. حذف نیز جفت `publicId`/`expectedVersion` جاری را پس از تمام‌شدن صف مصرف می‌کند.
- خطای API اکنون status واقعی HTTP و کد رهگیری را حفظ می‌کند. 409 صف autosave را متوقف می‌کند تا هیچ بازنویسی بعدی رخ ندهد و هشدار صریح «تعارض نسخه پیش‌نویس» با اقدام «بازیابی نسخه ذخیره‌شده» نمایش داده می‌شود. خطای غیرتعارضی نیز دیگر مخفی نیست.
- دکمه محدود «حذف پیش‌نویس» فقط برای پیش‌نویس ذخیره‌شده ظاهر می‌شود، تأیید کاربر می‌گیرد و نسخه جاری را می‌فرستد. موفقیت حذف صفحه را از منبع authoritative دوباره بارگذاری می‌کند؛ تعارض حذف همان مسیر بازیابی را نشان می‌دهد.
- دو فایل frozen یعنی `directadmin-api.ts` و `modules.tsx` عمداً تغییر و hash آن‌ها بازتأیید شد. ۱۷ فایل frozen رابط دیگر، هر ۲۰ منو و ۲۷ قرارداد API مصرف‌شده بدون تغییر ماندند.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| UI-DRAFT-01 | ذخیره جدید بدون نسخه، دو ویرایش هم‌پوشان به‌ترتیب نسخه‌های `0→1→2` را مصرف کنند؛ pause پس از تعارض mutation بعدی را اجرا نکند | passed |
| UI-DRAFT-02 | سازنده بدنه adapter فقط برای ویرایش نسخه بفرستد؛ حذف جفت کامل ID/version بسازد؛ فقط status 409 تعارض نسخه شناخته شود | passed |
| UI-DRAFT-03 / `TEST-TAMIRAN-1011X-A06-301` | save، edit، retry خواندنی، stale save و stale discard با 409 و snapshot ثابت، حذف جاری و retry حذف بدون write در handler واقعی محلی + SQLite | passed |
| UI-DRAFT-04 / `TEST-TAMIRAN-1011X-A06-*` | مدیر و پذیرش save/edit/discard نسخه‌دار انجام دهند؛ تکنسین، QC، انبار و مالی 403 و بدون write؛ retry حذف خواندنی باشد | passed |
| رگرسیون race قبلی | DRAFT-15/DRAFT-16 ایجاد هم‌زمان، update/discard مداخله‌گر، جلوگیری از audit تکراری و رد mutation stale را دوباره اجرا کنند | passed |
| رگرسیون Node | ۲۰۱ سناریوی inline، شامل ۴ سناریوی تازه و workflow wrapper | passed؛ workflow برابر ۵۵/۵۵ |
| Wrangler local D1 | draft، identity/readback، receipt/token و capability به‌ترتیب و روی state آزمایشی تازه | passed 5/5؛ hosted/network/E2E اجرا نشد؛ smoke قدیمی D1 API در readback همچنان `INCOMPLETE_tool_access` است |
| TypeScript و build رسمی Sites/Vinext | `tsc --noEmit` و ساخت routeهای `/`، `/software` و API | passed |
| lint محدود | controller، adapter و تست A06 بدون خطا یا هشدار | passed |
| lint مستقیم UI | `modules.tsx` همان ۳ خطا/۲ هشدار و `page.tsx` همان ۱۰ خطا/۱ هشدار شناخته‌شده | بدون افزایش؛ بدهی قدیمی صفر اعلام نمی‌شود |
| source preservation | ۶۷ hash، ۲۰ منوی اصلی، ۲۷ قرارداد frontend API و صفر staging request | passed؛ دو hash عمداً بازتأیید شد |
| Site foundation | شناسه Site، هشدار demo/status، جداسازی asset و نبود overlay تأییدنشده | passed |

سه چرخه پیش‌نویس کاملاً مصنوعی در SQLite حافظه‌ای ایجاد، ویرایش و حذف شد: یکی برای مسیر کامل stale/current/retry و دو مورد برای مدیر/پذیرش در ماتریس نقش. چهار نقش دیگر هیچ write نداشتند. پرونده پذیرش، داده عملیاتی یا دیتابیس میزبانی‌شده ساخته نشد.

## Blast radius، محدودیت و نقطه ادامه

- فرم مرورگری و DOM به‌علت در دسترس نبودن `control-browser` اجرا نشد. بنابراین مشاهده واقعی هشدار 409، کلیک بازیابی/حذف، focus، RTL، موبایل و چاپ هنوز `NOT_RUN/BLOCKED` هستند؛ موفقیت source/type/handler محلی به‌عنوان E2E مرورگر گزارش نمی‌شود.
- Worker، شبکه و D1 میزبانی‌شده استفاده نشدند؛ root فعال همچنان status/demo static است و پذیرش عملیاتی ایجاد نشد.
- A06 در سطح source/type/queue/Request-Response/SQLite محلی بسته شد. این نتیجه «آماده پایلوت» یا «صفر باگ» نیست.
- نقطه ادامه محدود بعدی A08 است: `expectedVersion` پرونده را از operations به mutationهای پرونده وصل کن و stale/retry/race را برای نقش‌های مجاز و ممنوع آزمون کن. A07 adapter شعبه/CSRF قبلاً در اجرای `20261011S` بسته شده است.
- پس از آن single-active-session/logout، capability POST activation/event، inventory simple/pro و چرخه تکنسین تا QC/مالی/تحویل باز می‌مانند.

نقطه ادامه: A08 را مستقل و بدون تغییر منو اجرا کن؛ نسخه authoritative پرونده را در mutationهای واقعی حمل و 409 را بدون overwrite یا fallback نمایشی مدیریت کن.
