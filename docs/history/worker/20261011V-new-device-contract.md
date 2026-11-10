# اجرای 20261011V — قرارداد دستگاه جدید در رابط

نسخه مبنا: `938e316230febdb41082e21848c057115840ee82`. دامنه این اجرا فقط blocker شماره A04 از ممیزی `20261010P` بود: برای دستگاه جدید، بدنه رابط نباید `previousDeviceId: null` بفرستد؛ فیلد باید حذف شود، چون قرارداد strict سرور فقط عدد صحیح مثبت یا نبود فیلد را می‌پذیرد. schema، هشت migration، منوها، قواعد نقش و endpointها تغییر نکردند. هیچ استیجینگ، داده مشتری واقعی، پیامک یا پرداخت واقعی استفاده نشد.

## تغییر محدود و fail-closed

- helper خالص `buildPreviousDeviceSelection` در `app/software/reception-ui-contract.ts` برای انتخاب خالی `{}` برمی‌گرداند؛ در نتیجه `JSON.stringify` هیچ کلید `previousDeviceId` تولید نمی‌کند.
- اگر دستگاه قبلی انتخاب شود، فقط شناسه صحیح مثبت و safe پذیرفته می‌شود. صفر، مقدار منفی، اعشاری و `NaN` پیش از dispatch با خطای صریح رد می‌شوند.
- submit فرم به‌جای مقدار nullable، نتیجه helper را در payload پخش می‌کند و type مشترک `CreateRepairCaseInput` نیز دیگر `null` را مجاز نمی‌داند. schema سرور دست‌نخورده ماند و همچنان ورودی forged برابر `null` را 400 می‌کند.
- retry همان بدنه omitted-field همان پرونده را فقط read می‌کند و هیچ نوشتن دوم ندارد.
- برای این اصلاح دو فایل frozen یعنی `modules.tsx` و `operations.ts` عمداً تغییر و hash آن‌ها بازتأیید شد. ۱۷ فایل frozen دیگر، هر ۲۰ منو و ۲۷ قرارداد API مصرف‌شده رابط بدون تغییر ماندند.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| UI-DEVICE-01 | انتخاب خالی به `{}` و JSON بدون کلید تبدیل شود؛ ID مثبت حفظ و ID نامعتبر رد شود | passed |
| UI-DEVICE-02 / `TEST-TAMIRAN-1011V-A04-991` | handler strict مقدار صریح `null` را 400 و بدون کوچک‌ترین تغییر در snapshot رد کند؛ همان درخواست با حذف فیلد یک پرونده آزمایشی بسازد؛ retry دقیق read-only باشد | passed |
| UI-DEVICE-03 / `TEST-TAMIRAN-1011V-A04-*` | هر شش نقش بدنه بدون کلید بسازند؛ مدیر و پذیرش دقیقاً دو پرونده آزمایشی بسازند؛ تکنسین، QC، انبار و مالی 403 و بدون write بگیرند | passed |
| رگرسیون Node | ۱۹۳ سناریوی inline، شامل ۳ سناریوی تازه و workflow wrapper | passed؛ workflow برابر ۵۵/۵۵ |
| Wrangler local D1 | draft، identity/readback، receipt/token و capability به‌ترتیب و روی state آزمایشی تازه | passed 5/5؛ hosted/network/E2E اجرا نشد |
| TypeScript و build رسمی Sites/Vinext | `tsc --noEmit` و ساخت routeهای `/`، `/software` و API | passed |
| lint محدود | helper، تست و `operations.ts` بدون خطا/هشدار | passed |
| lint مستقیم UI | `modules.tsx` همان ۳ خطا/۲ هشدار و `page.tsx` همان ۱۰ خطا/۱ هشدار شناخته‌شده | بدون افزایش؛ بدهی قدیمی صفر اعلام نمی‌شود |
| source preservation | ۶۷ hash، ۲۰ منوی اصلی، ۲۷ قرارداد frontend API و صفر staging request | passed؛ دو hash عمداً بازتأیید شد |
| Site foundation | شناسه Site، هشدار demo/status، جداسازی asset و نبود overlay تأییدنشده | passed |

اجرای اول مجموعه رگرسیون، پس از پاس‌شدن ۱۹۲ سناریوی محصول، طبق انتظار روی hash قدیمی `modules.tsx` متوقف شد. پس از بازتأیید محدود دو فایل frozen مجاز، اجرای کامل دوباره انجام شد و ۱۹۳/۱۹۳ پاس شد. پنج wrapper رسمی D1 نیز پس از build و به‌ترتیب runbook اجرا شدند. این بازتأیید تغییر منو، schema یا API نبود.

## Blast radius، مانع و نقطه ادامه

- فرم مرورگری و DOM به‌علت در دسترس نبودن `control-browser` اجرا نشد. بنابراین کلیک واقعی، focus، پیام خطا، RTL، موبایل و چاپ هنوز `NOT_RUN/BLOCKED` هستند؛ موفقیت payload/handler محلی به‌عنوان E2E مرورگر گزارش نمی‌شود.
- Worker، شبکه و D1 میزبانی‌شده استفاده نشدند؛ root فعال همچنان status/demo static است و پذیرش عملیاتی ایجاد نشد. سه write این تست‌ها فقط پرونده‌های کاملاً مصنوعی در دیتابیس‌های حافظه‌ای جدا بودند.
- A04 در سطح source/type/serialization/handler/SQLite محلی بسته شد. مسیر دستگاه قبلی و submit پیش‌نویس هنوز blocker بعدی A05 را دارند: `expectedDeviceVersion` و `draftExpectedVersion` خوانده می‌شوند یا در قرارداد وجود دارند، اما رابط آن‌ها را به submit واقعی وصل نکرده است.
- سپس A06 باید نسخه autosave/discard و conflict 409 را به اپراتور نشان دهد. `expectedVersion` پرونده، session/logout، capability POST، inventory simple/pro و چرخه تکنسین تا QC/مالی/تحویل نیز باز می‌مانند.

نقطه ادامه: A05 را محدود و مستقل اجرا کن؛ نسخه authoritative دستگاه قبلی و پیش‌نویس انتخاب‌شده را بدون fallback ساختگی به `create_case` بفرست، stale/missing/mismatched version را بدون write رد کن، retry را read-only نگه دار و همان ماتریس شش نقش را با داده آزمایشی تکرار کن.
