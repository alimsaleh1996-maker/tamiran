# 20261010H — سابقه مشتری و دستگاه، مسیر خواندنی احرازشده

Base HEAD: `958bd108dac92c7ae8830bb583011657d887d386`؛ همان Site و دسترسی مالک‌خصوصی، بدون استیجینگ یا داده واقعی.

## دامنه و دلیل

اولین کار آماده d1-core: انتقال قرارداد customerMobile در operations.php از baseline واقعی. سه فایل candidate (handler، route، تست) و checkpoint/status تغییر کردند؛ schema، شش migration، UI و منوها تغییر نکردند. GETهای منتقل‌نشده fail-closed می‌مانند.

هویت از حساب Sites و نقش/شعبه فعال دیتابیس خوانده می‌شود؛ مدیر تعمیرگاه و پذیرش مجازند. مشتری و دستگاه فقط از همان تعمیرگاه انتخاب می‌شوند. سابقه دستگاه در سطح تعمیرگاه (شامل شعب دیگر همان تعمیرگاه) دقیقاً مطابق قرارداد frozen حفظ شده است؛ فهرست پرونده‌ها همچنان منتقل نشده است. expectedDeviceVersion خروجی افزوده برای guard دستگاه قبلی است. خروجی فقط فیلدهای قرارداد را دارد و توکن، secret و مدرک رضایت ندارد. mobile فارسی/عربی نرمال می‌شود. query ناشناخته یا تکراری برای جلوگیری از ابهام authority رد می‌شود. Cache-Control=no-store، error عمومی و tracking UUID برقرار است.

## شواهد آزمون

Fixture جدید: TEST-TAMIRAN-1010H-CASE/REQUEST/NOVISIT، نام «آزمایشی — مراجعه جدید»، پایه seed TEST-TAMIRAN-1010A/B. موبایل مصنوعی فقط برای SELECT محلی؛ هیچ پیامک یا پرداختی نیست.

- `node --experimental-strip-types --test tests/customer-lookup-http.test.mjs`: 10/10 passed. LOOKUP-01 success/readback/no-write/no-secret؛ 02 cross-shop با موبایل یکسان؛ 03 Persian/Arabic/absent؛ 04 همه نقش‌های ممنوع، ناشناس و unbound؛ 05 مدیر، branch denial و query spoof/duplicate؛ 06 غیرفعال/منقضی؛ 07 ورودی نامعتبر/SQL injection/unported/method؛ 08 DB unavailable/sanitized failure؛ 09 دستگاه بدون مراجعه و lock_version؛ 10 latest tie by ID و سابقه شعبه دیگر همان تعمیرگاه.
- رگرسیون 107 تست قبلی schema/repository/crypto/reception HTTP و 55 baseline checks passed. Node runner شامل دو فایل script-level، قبل از افزودن LOOKUP-10 عدد 118 را گزارش کرد؛ شمارش سناریو جدید 10 است، نه آزمون E2E.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- lint محدود سه فایل: passed.
- helper رسمی `build-site.mjs` در migration/worker: passed.
- `node tests/site-foundation.test.mjs` در root: passed.

دو اجرای fixture جدید ابتدا به‌علت تلاش حذف event تغییرناپذیر، سپس نبود فیلدهای اجباری token در case fixture شکست خوردند؛ fixture با INSERT دستگاه مستقل و hash/ciphertext واضحاً مصنوعی اصلاح شد. constraintها و سورس محصول برای دورزدن آزمون تغییر نکردند؛ اجرای نهایی 10/10 passed است.

## محدودیت و ادامه

این آزمون Request/Response + SQL محلی واقعی با adapter سازگار D1 است؛ آزمون Worker روی شبکه یا دیتابیس میزبانی‌شده نیست. صرفاً مسیر read اضافه شد؛ آزمون rollback/retry پذیرش از رگرسیون قبلی پاس است. بدون browser، چاپ، همه نقش‌های E2E، کلید runtime و hosted DB، آمادگی پایلوت تأیید نیست. Candidate جای دموی static را نگرفته؛ فقط گزارش خصوصی منتشر می‌شود.

Next: catalog/settings/capabilities/csrf، drafts رمزنگاری‌شده با owner/branch guard و اصلاح publicId/draftPublicId، case list و adapter فرم؛ پس از تکمیل قراردادها، hosted identity/API/DB و آزمون عملیاتی.
