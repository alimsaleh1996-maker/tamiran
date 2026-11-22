# php.10 — اصلاح مسیر جاافتادهٔ مرکز عملیات

مبنای سورس: `b13022b9c3bd48c643e19e1d155ac43f336962cf` (php.9). این اصلاح مخصوص hosting و ورودی `?view=operations` است.

## علت ظاهر قدیمی

تصویر کاربر نسخهٔ php.9 و منوی «مرکز عملیات تعمیرات» را نشان می‌داد. در php.9 فقط TechnicianWorkbench به TechnicalCaseWorkspace وصل شده بود؛ WorkflowBoard در v2-workspace هنوز CaseActionDialog قبلی را می‌ساخت. بنابراین تست‌های ورودی «کارهای من» موفق بودند ولی ورودی دوم پوشش نداشت. نسبت‌دادن این تصویر به cache یا نصب ناقص، مبنای شواهد نداشت.

قبل از اصلاح، همان مسیر با PHP/MariaDB محلی و دادهٔ مصنوعی بازتولید شد: یک dialog و پنج details. [دسکتاپ قبل](operations-workspace-2026-11-22/before-1440.png) و [موبایل قبل](operations-workspace-2026-11-22/before-390.png).

## اصلاح

کارت مرکز عملیات اکنون همان TechnicalCaseWorkspace را در صفحهٔ مستقل باز می‌کند. بازکردن پرونده انتقال وضعیت نیست؛ شروع بررسی همچنان صریح و سروری است. ثبت گزارش، قطعات، اعلام هزینه، تصاویر، ارجاع و پایان تعمیر همان پیاده‌سازی آزمایش‌شدهٔ «کارهای من» را استفاده می‌کنند. سربرگ و تازه‌سازی تکراری مرکز عملیات در نمای پرونده حذف شده‌اند.

کارهای مدیریتی حذف نشده‌اند: دکمهٔ «مدیریت پرونده» صفحهٔ مستقل تخصیص، همکار/اجرت، تصمیم مستند مشتری و اقدام مدیریتی را باز می‌کند. هر بار فقط فرم همان کار دیده می‌شود. مجوزهای پیشین حفظ و نقش تکنسین به فرم تأیید مشتری دسترسی پیدا نکرده است. مسیر پیش‌فرض پذیرش بدون مجوز repair_operations.view همچنان وارد مرکز عملیات نمی‌شود؛ برای ساده‌کردن رابط هیچ مجوزی اضافه نشد.

پیش‌نویس گزارش مستقل از مدیریت حفظ می‌شود. علت تخصیص، مستند تصمیم مشتری و علت اقدام مدیریتی پیش‌نویس‌های جدا دارند؛ تست اولیه نشان داد استفاده از یک state مشترک می‌تواند فرم تصمیم مشتری را از علت تخصیص پر کند، و این ریشه اصلاح شد. ارجاع مدیر از idempotency موجود استفاده می‌کند و تا پذیرش مقصد مسئول پرونده عوض نمی‌شود. اجرت همکار در UI تومان است و به ریال صحیح ارسال می‌شود.

هیچ منطق Backend یا Schema جدیدی لازم نبود؛ فقط ثابت نسخهٔ bootstrap عوض شد. بخش‌های دیگر v2-workspace از InventoryBoard به بعد با php.9 بایت‌به‌بایت یکسان‌اند. SQL، Worker، مرجع منجمد، پذیرش، قبض و کاربران/نقش‌ها تغییر نکرده‌اند.

## فایل‌های تغییرکرده

- `hosting/frontend/src/app/tamiran/v2-workspace.tsx`: جایگزینی پنجرهٔ قدیمی در WorkflowBoard با میز مشترک؛ کارت مراحل و تحویل مسئولیت محفوظ.
- `hosting/frontend/src/app/tamiran/operations-case-workspace.tsx`: صفحه‌های مستقل مدیریت، پیش‌نویس هر کار و نقش‌های مجاز.
- `hosting/frontend/src/app/tamiran/technical-case-workspace.tsx`: پارامترهای اختیاری مدیریت، عنوان برگشت و اقدام تخصیص؛ رفتار پیش‌فرض تکنسین حفظ شد.
- `hosting/frontend/src/app/tamiran/technician-workspace.css`: عرض مشترک و فرم‌های مدیریتی واکنش‌گرا.
- `hosting/tests/operations_workspace_browser.py`: تست واقعی ورودی کارت مرکز عملیات و نقش‌های مختلف.
- `hosting/VERSION`، `hosting/frontend/package.json`، `package-lock.json`، `src/app/tamiran/version.ts` و `hosting/public_html/api/bootstrap.php`: نسخهٔ php.10.
- `hosting/public_html/index.php` و `assets/index-*.js/css`: build جدید.
- `hosting/scripts/package.py`: update از php.9 و timestamp جدید برای OPcache.
- `hosting/README.md`، `UI-FIXES-FA.md`، `UPGRADE-FA.md` و `VERIFICATION-FA.md`: توضیح اصلاح و ارتقا.
- `graphify-out/*`: AST هشت فایل مرتبط، هش سورس و نمایشگرهای آفلاین؛ اسناد معنایی تاریخی و ۲۲ رابطهٔ مستثنا حفظ شده‌اند.
- این گزارش و پوشهٔ شواهد آن.

## تصاویر واقعی پس از اصلاح

| نما | دسکتاپ | موبایل |
|---|---|---|
| ورود از مرکز عملیات | [۱۴۴۰](operations-workspace-2026-11-22/entry-1440.png) | [۳۹۰](operations-workspace-2026-11-22/entry-390.png) |
| ثبت گزارش مدیر | [۱۴۴۰](operations-workspace-2026-11-22/work-1440.png) | [۳۹۰](operations-workspace-2026-11-22/work-390.png) |
| اندازه‌های تکمیلی | [۷۶۸](operations-workspace-2026-11-22/work-768.png) | [۳۲۰](operations-workspace-2026-11-22/work-320.png) |

فرم‌های مستقل عرض ۳۲۰: [تخصیص](operations-workspace-2026-11-22/assignment-320.png)، [همکار](operations-workspace-2026-11-22/collaborator-320.png)، [تصمیم مشتری](operations-workspace-2026-11-22/approval-320.png)، [قطعات](operations-workspace-2026-11-22/parts-320.png)، [کارت‌های مراحل](operations-workspace-2026-11-22/stage-cards-320.png).

## آزمون‌های این اصلاح

| مجموعه | نتیجه |
|---|---|
| [مرورگر مرکز عملیات](operations-workspace-2026-11-22/operations-browser.json) | ۴۲ موفق، صفر خطای JS |
| [رگرسیون مرورگر کارهای من](operations-workspace-2026-11-22/technician-browser.json) | ۶۷ موفق، صفر خطای JS |
| [گردش فنی API](operations-workspace-2026-11-22/workflow.json) | ۱۱۰ موفق |
| [API گزارش/ارجاع/قفل](operations-workspace-2026-11-22/minimal-api.json) | ۳۴ موفق |
| TypeScript / Frontend build | موفق؛ هشدار قبلی chunk بزرگ باقی است |
| Node، شامل تومان/ریال | ۲۹ موفق |
| PHP lint | 60 فایل معتبر |
| واحد بسته‌بندی | ۲ موفق |
| [مرجع منجمد](operations-workspace-2026-11-22/preservation.json) | ۶۷ هش، ۲۰ منو و ۲۷ قرارداد حفظ شد |
| [نصب و ارتقای بسته](operations-workspace-2026-11-22/release-verification.json) | نصب تازه و ارتقای واقعی php.9 به php.10، همراه حفظ تنظیمات، کلیدها، عکس و پروندهٔ قبلی |

جمع این اجرا ۱۰۹ بررسی مرورگر و ۱۴۴ بررسی HTTP است. تعدادهای php.9 به این جمع اضافه نشده‌اند. آزمون تازه از کلیک واقعی روی کارت در مرحلهٔ «شروع بررسی» آغاز می‌شود؛ پیش‌تر همین ورودی جا افتاده بود. تست، بازکردن بدون تغییر وضعیت، شروع واقعی، دو گزارش مستقل با نویسندهٔ مدیر، پیش‌نویس پس از Refresh/Back، انتظار تأیید معتبر، خطای ۴۰۹ تخصیص و retry، اجرت همکار، ارجاع بدون جابه‌جایی زودهنگام مسئول و حفظ مجوز نقش‌ها را پوشش می‌دهد. فرم تأیید مشتری صرفاً مشاهده شد و هیچ تأیید ساختگی ثبت نشد.

اجرای دوباره: fixture مصنوعی خارج مخزن با فیلدهای base، managerMobile، password، tech، model و customerMobile بسازید؛ سپس `python3 hosting/tests/operations_workspace_browser.py --fixture /tmp/private-fixture.json --output /tmp/operations-browser` را روی loopback اجرا کنید. فایل fixture حاوی اعتبارنامه است و نباید commit شود.

## محدودیت و انتشار

Safari/Firefox، خوانش‌گر صفحه، تأیید واقعی مشتری/OTP و بازبین انسانی مستقل بررسی نشده‌اند. هیچ SMS، پرداخت یا درخواست آزمایشی به هاست واقعی ارسال نشد. رگرسیون‌های دیگر php.9 به‌عنوان تست اجراشدهٔ این اصلاح گزارش نشده‌اند.

بستهٔ `tamiran-2.0.0-php.10-update-from-php.9.zip` برای نصب فعلی php.9 آماده شده است. سورس طبق مجوز AGENTS با Commit/Push عادی منتشر می‌شود؛ SHA نهایی در پاسخ تحویل می‌آید. نسخهٔ عملیاتی خودکار Deploy نشده و Force Push انجام نمی‌شود.
