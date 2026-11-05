# 20261010C — هویت سروری و batch اتمیک پذیرش

Source HEAD at opening: `805d3a38504275a667ad7618e875226c206c007a`.

## دامنه و علت

مرحله سوم محدود از `d1-core`: اتصال هویت تأییدشده Site به عضویت فعال تعمیرگاه/شعبه و ساخت repository پذیرش برای مشتری و دستگاه موجود. علت ریشه‌ای این بود که schema و قیود مرحله قبل، مسیر نوشتن اتمیک و نقش معتبر سمت سرور نداشتند؛ در نتیجه endpoint واقعی نمی‌توانست بدون خطر role spoofing، شماره قبض تکراری یا گراف نیمه‌کاره فعال شود.

این تغییر endpoint یا UI را فعال نمی‌کند، migrationهای 0000/0001 را تغییر نمی‌دهد و فقط در Candidate سایت‌ساز است. استیجینگ، hosted D1، مشتری واقعی، پیامک و پرداخت فراخوانی نشدند.

## تغییر

- `server-scope.ts` فقط `account_user_id` سروری را می‌پذیرد و role، shop، branch، policy و permission را از عضویت فعال دیتابیس می‌خواند. حساب ناشناس، شعبه نامعتبر/متعلق به shop دیگر، عضویت غیرفعال، شعبه غیرفعال و مجوز تعمیرگاه منقضی/تعلیق‌شده fail-closed هستند.
- `reception-repository.ts` در این مرحله عمداً فقط مشتری و دستگاه موجود را می‌پذیرد. نقش مجاز مطابق baseline فقط `repair_manager` و `reception` است.
- تخصیص sequence، ساخت پرونده، workflow، stage event، case event و audit در یک `D1 batch` انجام می‌شود. شماره قبض داخل SQL از sequence تازه ساخته می‌شود تا نتیجه یک statement لازم نباشد در JavaScript به statement بعدی تزریق شود.
- guard عضویت/نقش/شعبه/مجوز در خود batch و هنگام افزایش sequence دوباره ارزیابی می‌شود. عضویت stale خطای SQL می‌دهد و کل batch rollback می‌شود.
- idempotency یکسان و payload یکسان replay خواندنی است؛ همان کلید برای payload متفاوت conflict است. خطای uniqueness هم پس از readback فقط در صورت تطابق payload replay می‌شود.

## شواهد

| اجرا | انتظار | نتیجه |
|---|---|---|
| `node --test tests/reception-repository.test.mjs` | scope معتبر، anonymous/cross-shop/role denial، success، double-click، payload conflict، stale membership و rollback | passed 8/8 |
| `node --test tests/d1-schema.test.mjs tests/d1-case-core.test.mjs` | رگرسیون schema و قیود | passed 40/40 |
| `node --test tests/source-preservation.test.mjs tests/workflow.test.mjs` | frozen source/20 menu/27 API paths و قواعد | 67 hash و 55/55 baseline checks passed |
| `node --test tests/site-foundation.test.mjs` در root | هشدار static و جداسازی assets | passed 1/1 |
| `tsc --noEmit` | typecheck | exit 0 |
| build Candidate | تولید Worker و `wrangler.json` | passed |
| migration 0000 و 0001 روی Wrangler local D1 | schema محلی تازه | 24+53 statements passed |
| `d1-local.test.mjs` و readback | seed، FK، cross-shop denial و عدم تغییر | passed؛ 7 role، 7 membership، 0 FK violation |
| eslint فقط فایل‌های مرحله | بدون خطای تازه | exit 0 |
| eslint کامل Candidate | ثبت بدهی موجود | failed؛ 23 خطای قدیمی React hook/purity و 17 warning خارج از دامنه این مرحله |

Fixtureهای این مرحله `TEST-TAMIRAN-1010C-*`، نام‌های «آزمایشی — …»، IP مستندات `192.0.2.103` و token غیرواقعی دارند. هیچ داده واقعی یا مقصد ارتباطی وجود ندارد.

اولین اجرای مجموعه کامل، دو تست D1 محلی را قبل از build/migration اجرا کرد و به‌علت نبود `dist/server/wrangler.json` و state شکست خورد. ترتیب طبق runbook اصلاح شد: build، apply دو migration، سپس smoke/readback؛ هر دو پاس شدند. این شکست محصول نبود و در نتیجه نهایی passed محاسبه نشده است.

## محدودیت و نقطه ادامه

Repository هنوز ساخت/به‌روزرسانی مشتری و دستگاه، قواعد کدملی/سریال/رنگ/مجوز داده، شرایط قبض و route احرازشده شبکه را پوشش نمی‌دهد. hosted D1، هم‌زمانی واقعی چند Worker، session/CSRF، API مرورگر، موبایل، چاپ و role E2E اجرا نشده‌اند. lint کامل ۲۳ خطای قدیمی UI دارد. بنابراین پذیرش عملیاتی و آمادگی پایلوت تأیید نمی‌شود.

گام بعدی: با حفظ batch و guard فعلی، customer upsert و device create/update را با validationهای baseline به تراکنش اضافه کن؛ سپس فقط action واقعی create_case را پشت هویت Site و origin/CSRF معتبر route کن. success، existing/new customer/device، duplicate serial، branch/role denial، retry پس از failure و readback باید اجرا شوند.

## Fingerprint

- `migration/worker/lib/server-scope.ts`: `c1bf7dca55d8fab57424b61389965d52a00957817e26610e432c723bbaa87127`
- `migration/worker/lib/reception-repository.ts`: `5eb38afd0c65b61b6dc923d63bdb7ffcfc7ea55714ae7585367083618720b7e9`
- `migration/worker/tests/reception-repository.test.mjs`: `edad7d4e12b39be6376a2f6432b6f1fa13520c5063961b299623efd0b8132db6`
