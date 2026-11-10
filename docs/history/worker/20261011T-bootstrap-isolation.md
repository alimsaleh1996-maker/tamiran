# اجرای 20261011T — جداسازی bootstrap عملیاتی از followups

نسخه مبنا: `5588eaddad476f2628724c4ee85ef6b47061e34f`. دامنه این اجرا فقط رفع blocker شماره A02 بود: خطای endpoint منتقل‌نشده `followups.php` نباید پاسخ‌های موفق و واقعی `operations`، `catalog`، `settings` و `capabilities` را از state رابط حذف کند. منوها، قواعد نقش، schema و هشت migration تغییر نکردند. استیجینگ، داده مشتری واقعی، پیامک و پرداخت واقعی استفاده نشدند.

## علت و تغییر محدود

bootstrap قبلی پنج درخواست را در یک `Promise.all` اجرا می‌کرد. پاسخ صادقانه 503 از `followups.php` کل زنجیره را reject می‌کرد و داده‌های عملیاتی موفق نیز اعمال نمی‌شدند.

- helper خالص `app/software/operational-bootstrap.ts` اضافه شد. چهار منبع اصلی همچنان یک واحد الزامی‌اند؛ خرابی هرکدام به‌صورت failure واقعی باقی می‌ماند.
- `followups` هم‌زمان ولی در شاخه مستقل اجرا می‌شود. 503 آن به موفقیت یا آرایه خالی ساختگی تبدیل نمی‌شود.
- در موفقیت core، operations/catalog/settings/capabilities اعمال می‌شوند. در خرابی followups پیام صریح «اطلاعات اصلی بارگذاری شد؛ پیگیری مشتری در دسترس نیست» و کد رهگیری احتمالی نمایش داده می‌شود.
- guard عمر effect افزوده شد تا پاسخ دیرهنگام profile قبلی پس از unmount یا تغییر context، state را بازنویسی نکند.
- برای این اصلاح لازم بود یک فایل از ۱۹ فایل frozen، یعنی `app/tamiran/page.tsx`، عمداً و فقط در bootstrap تغییر کند. hash همان فایل در baseline به `4bbd62bdc84f684d4700d5a52f3c2ed7cf0af11ff1686057b7103df125e73d84` بازتأیید شد؛ ۱۸ فایل frozen دیگر، ۲۰ منو و ۲۷ قرارداد API تغییر نکردند.

## آزمون و شواهد

| Evidence | انتظار / نتیجه | وضعیت |
|---|---|---|
| BOOTSTRAP-01 | موفقیت هر پنج loader با همان payload حفظ شود | passed |
| BOOTSTRAP-02 | 503 پیگیری rejected بماند، اما core موفق دور ریخته نشود | passed |
| BOOTSTRAP-03 | خرابی core به partial/fake success تبدیل نشود و هر پنج loader فراخوانی شوند | passed |
| BOOTSTRAP-04 / `TEST-TAMIRAN-1010A-*` | مدیر تعمیرگاه، پذیرش، تکنسین، QC، انباردار و مالی با handler واقعی محلی و SQLite؛ auth/operations/catalog/settings/capabilities موفق و followups=503 | passed برای هر شش نقش |

- مجموعه رگرسیون محلی: ۱۸۷/۱۸۷ Node entry؛ شامل چهار سناریوی تازه. wrapper گردش‌کار ۵۵/۵۵ بررسی واحد/تطبیق/امنیت را پاس کرد.
- source preservation: ۶۷ hash معتبر، ۲۰ منوی اصلی، ۲۷ قرارداد frontend API و صفر درخواست staging. یک hash همان‌طور که بالا توضیح داده شد عمداً بازتأیید شد.
- TypeScript `--noEmit`، ESLint بدون هشدار برای helper و تست جدید، build رسمی Sites/Vinext و Site foundation پاس شدند.
- lint مستقیم `page.tsx` همان baseline قبلی ۱۰ خطای React hook/purity و یک هشدار dependency را گزارش می‌کند؛ خطای جدیدی به این baseline اضافه نشد. این بدهی رفع‌شده یا صفر اعلام نمی‌شود.
- schema/migration جدیدی وجود نداشت. integration شش‌نقشی، migrationهای واقعی SQLite و handlerهای واقعی محلی را استفاده کرد، اما شبکه، Worker و D1 میزبانی‌شده نبود.

## Blast radius و محدودیت

- پاسخ ناموفق followups همچنان 503 است و write یا داده جعلی ایجاد نمی‌شود. فقط اثر شکست آن از state اصلی رابط جدا شد.
- root فعال همچنان status/demo static است؛ Candidate عملیاتی روی root یا Worker میزبانی‌شده deploy نشده است.
- dispatch مرورگر، موبایل، چاپ، hosted API/D1 و پذیرش عملیاتی تا صدور قبض اجرا نشدند؛ ابزار کنترل مرورگر در دسترس نبود.
- اتصال `draftExpectedVersion`، شناسه و hash شرایط نمایش‌داده‌شده، `expectedDeviceVersion` و `expectedVersion` پرونده هنوز باز است. خطای autosave/discard نیز هنوز باید در رابط صریح شود.
- سیاست یک نشست فعال و logout/revocation، POST قابلیت، inventory simple/pro و چرخه تکنسین تا QC/مالی/تحویل همچنان باقی‌اند.

نقطه ادامه: نسخه‌های authoritative پیش‌نویس، شرایط پذیرش، دستگاه و پرونده را به state و submit رابط وصل کن؛ سپس خطاهای autosave/discard را قابل مشاهده کن. فقط پس از فعال‌شدن Candidate خصوصی، پذیرش آزمایشی تا قبض و همه نقش‌ها را در مرورگر و D1 میزبانی‌شده آزمون کن.
