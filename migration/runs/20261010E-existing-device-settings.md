# 20261010E — دستگاه قبلی و قواعد تنظیمات پذیرش

مبنا: `10d86fe01553c341245741c48d76065fbff94bc9` از checkout تازه مخزن همان Site خصوصی.

## علت و دامنه

مسیر انتقال مشتری/دستگاه فقط دستگاه جدید می‌ساخت؛ ثبت دستگاه قبلی و سیاست‌های تنظیمات baseline/API operations ناقص بودند. این مرحله فقط repository و schema را تکمیل می‌کند. UI، ۲۰ منو، گردش‌کار و فایل‌های frozen تغییر نکرده‌اند؛ هیچ استیجینگ، داده واقعی، پیامک یا پرداخت استفاده نشد.

- دستگاه قبلی فقط متعلق به همان مشتری و تعمیرگاه انتخاب می‌شود. مدل/رنگ به‌روز و سریال ورودی خالی حفظ می‌شود. snapshot پرونده قدیمی بازنویسی نمی‌شود.
- lock_version افزوده شد؛ timestamp به‌تنهایی برای دو درخواست در یک ثانیه کافی نبود. UPDATE شرطی و بررسی changes() در همان batch، stale-write را به rollback کامل تبدیل می‌کند.
- canonical SHA-256 درخواست ثبت می‌شود؛ نام/نشانی مشتری، مدل/رنگ/سریال، رضایت و تمام ورودی‌های محدود این repository در retry بررسی می‌شوند. شناسه‌های تولیدی سرور در fingerprint نیستند. کلید متفاوت با نسخه قدیمی دستگاه conflict است.
- repair_shop_settings با schema-only migration رسمی، JSON معتبر، کلید یکتا و editor داخل همان تعمیرگاه منتقل شد. نشانی و کدملی اجباری، رنگ فعال و ظاهر از تنظیمات همان تعمیرگاه خوانده می‌شوند. نبود appearance config از defaults عین baseline استفاده می‌کند.
- انتخاب مجوز حذف اطلاعات الزامی و سه مقدار baseline مجاز است؛ در workflow ثبت می‌شود. اعتبار enum روش پذیرش به معنی اثبات رضایت/OTP یا نسخه شرایط نیست.
- snapshot تنظیمات در batch دوباره کنترل می‌شود؛ تغییر بعد از validation به rollback منجر می‌شود. مشتری بایگانی‌شده و آرایه/طول نامعتبر رد می‌شوند.
- migrations 0003/0004 توسط Drizzle تولید شدند؛ SQL، snapshotها و journal قبلی دست‌نخورده‌اند.

## شواهد واقعی

| آزمون | نتیجه |
|---|---|
| reception-settings-device | 13/13 passed؛ update/retry/stale/cross-customer/cross-shop/rollback/settings/consent/serial/snapshot |
| regressions schema/case/repository/new-device | 53/53 passed |
| workflow/parity/security | 55/55 baseline passed |
| source preservation | 67 hashes، 20 menus و 27 API paths preserved |
| TypeScript | exit 0 |
| targeted eslint implementation/tests | exit 0 |
| Worker build با helper رسمی | passed |
| root Site foundation | passed 1/1 |
| official Wrangler local D1 migrations/readback | 0000–0004 applied; 7 roles/7 memberships; zero FK violations; cross-shop write denied and readback unchanged |

Fixtureها ساختگی‌اند؛ tests repository از adapter اتمیک SQLite سازگار با D1 استفاده می‌کنند و hosted D1 یا E2E نیستند. آزمون هم‌زمانی با تغییر تزریقی بین read و batch انجام شد، نه چند Worker واقعی.

## اثر و حدود

پذیرش: انتخاب دستگاه قبلی تکرار داده نمی‌سازد؛ ورودی ناقص مطابق تنظیمات رد می‌شود. مشتری: مجوز حذف اطلاعات صریح ثبت می‌شود؛ هنوز مدرک امضای شرایط/OTP فعال نیست. تکنسین: snapshot دستگاه/مجوز آماده است ولی API کارهای تکنسین هنوز منتقل نشده. مدیر: تنظیمات موجود مبنای validation است؛ صفحه تنظیمات اجرایی هنوز متصل نیست. مالی/انبار: تغییری ندارد. توسعه: schema سازگار با ستون‌های مرجع به‌اضافه دو ستون داخلی lock/fingerprint؛ migrationهای قبلی ثابت ماندند.

## ادامه

قبل از route create_case، نسخه فعال شرایط پذیرش و مدرک قبول آن، portal tokens، تخصیص اولیه، preapproved amount، diagnostic policy، promised date و رمز موقت رمزنگاری‌شده باید از baseline منتقل شوند. helper مرحله3 برای دستگاه موجود یک primitive ناقص است و نباید به endpoint عمومی متصل شود. route فقط به repository کامل با هویت سرور و محافظ origin متصل شود؛ نقش از ورودی رابط معتبر نیست.

API شبکه، hosted D1، ورود و مجوزهای همه نقش‌ها، E2E مشتری/تکنسین، چاپ/موبایل و recovery هنوز آزموده نشده‌اند. نسخه آماده پایلوت نیست؛ انتشار این مرحله فقط گزارش خصوصی پیشرفت و source checkpoint است.
