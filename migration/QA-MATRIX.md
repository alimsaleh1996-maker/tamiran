# ماتریس تست پایلوت تعمیران

تمام موارد زیر هنوز نیاز به اجرای عملیاتی با fixture آزمایشی دارند. ۵۵ تست پایه موجود جای این موارد نیستند. برای هر سطر، scenario ID، نقش، fixture ID، نسخه، expected/actual، evidence و وضعیت passed/failed/blocked/not-run ثبت شود. تست‌های ناموفق باید با اصلاح و رگرسیون تکرار شوند.

| بخش | سناریوهای الزامی |
|---|---|
| هویت و نقش | ورود/خروج و یک نشست؛ انقضای نشست؛ CSRF؛ مجوز server-side؛ رد role spoofing؛ عدم دسترسی نقش به API ممنوع؛ جداسازی تعمیرگاه/شعبه و داده مشتری |
| پذیرش | ثبت مشتری/دستگاه/پرونده؛ داده ناقص؛ شماره موبایل/کدملی/سریال مطابق تنظیمات؛ اطلاعات ظاهری/لوازم/مجوز پاک‌کردن؛ تاریخ شمسی؛ پیش‌نویس و بازیابی؛ دوبارکلیک/قطع اتصال/retry؛ شماره قبض یکتا؛ rollback بدون مشتری/دستگاه/رویداد یتیم |
| تخصیص | تکنسین فعال/غیرفعال؛ شعبه دیگر؛ اصلی/همکار؛ عدم انتخاب پرونده بسته در لیست فعال؛ نقش ممنوع؛ Solo و Pro با قواعد متفاوت |
| تشخیص و برآورد | گزارش فنی و اعتبارسنجی؛ سقف پذیرش؛ مبلغ/مالیات ردیفی؛ نسخه برآورد؛ تأیید/رد مشتری؛ تغییر برآورد بعد از تأیید؛ آغاز تعمیر غیرمجاز قبل از تأیید |
| مشتری و OTP | نمایش فقط همان پرونده؛ token نامعتبر/منقضی؛ تأیید/رد معتبر؛ OTP درست/غلط/منقضی/تکرار؛ سقف تلاش و ماندگاری شمارنده شکست؛ عدم ارسال واقعی؛ هم‌زمانی تصمیم؛ نشت اطلاعات پرونده دیگر |
| قطعات | off/simple/pro؛ موجودی/رزرو/انقضا؛ فقط درخواست توسط تکنسین؛ درخواست/تحویل/مصرف/مرجوعی؛ موجودی منفی و صدور دوباره ممنوع؛ داغی باز؛ تعیین تکلیف قبل از عبور مرحله |
| QC | off/simple/independent؛ تخصیص نقش؛ pass/fail/rework؛ مشروط با پذیرش محدودیت توسط مشتری؛ رد عبور بدون نتیجه معتبر |
| مالی | جمع دقیق ردیف/مالیات/تخفیف؛ صورتحساب/پرداخت آزمایشی/مانده؛ دوبار پرداخت و retry؛ برگشت وجه/سند اصلاحی؛ اجرت درصد/ثابت تکنسین؛ جلوگیری از ویرایش مستقیم سند نهایی؛ audit و ثبت اتمیک |
| تحویل | آماده‌بودن واقعی؛ OTP مشتری/نماینده؛ شمارنده شکست؛ تحویل با مانده فقط اختیار مدیر؛ دوبار تحویل؛ closure/قفل؛ لغو/بازگشت تعمیرنشده با تسویه؛ پرونده مرتبط یا اصلاحی به‌جای بازنویسی سابقه |
| منوها و قابلیت | همه ۲۰ منوی واقعی؛ role/permission/entitlement؛ فعال/قفل/منقضی/تعلیق؛ Solo/Pro، چندشعبه، تغییر تنظیمات بدون تخریب پرونده‌های سابق؛ ۳۸ API مرجع و ۲۷ مسیر مصرف‌شده رابط |
| ظاهر و استفاده | موبایل و دسکتاپ واقعی؛ RTL؛ وزیرمتن؛ صفحه‌کلید/focus؛ خطا و empty/loading؛ modal و scroll؛ همه تاریخ‌ها/بازشوهای شمسی؛ عدم تغییر ناخواسته متن/منو/قواعد |
| چاپ و بازیابی | قبض حرارتی/چاپ A4؛ سریال/QR/خط‌شکست؛ تاریخ/مبلغ/فونت؛ پشتیبان و بازیابی واقعی داده آزمایشی؛ صحت ارتباط پرونده/رویداد/مالی بعد از بازیابی |
| پایداری | version conflict؛ UPDATE اتمیک؛ درخواست تکراری/idempotency؛ قطع ارتباط/شکست میانه عملیات؛ هم‌زمانی شماره قبض/رزرو/تسویه؛ نشت secret/PII در log؛ error code قابل رهگیری |
| E2E | پذیرش → تخصیص → تشخیص → برآورد → تأیید مشتری → قطعات → تعمیر → QC → مالی → تحویل، با بازیگران مجاز؛ همچنین رد برآورد، QC مردود، اتمام OTP، بدهی، لغو و پرونده بدون تعمیر |

## شرط عبور

همه مسیرهای حیاتی واقعاً اجرا و evidence داشته باشند؛ P0/P1 باز صفر؛ تست حیاتی blocked/not-run باقی نماند. نبود مرورگر یا دسترسی نقش، دلیل «پاس» نیست. صفر باگ مطلق یا تکمیل تا موعد، تضمین نشود.

## اجرای 20261010A — زیرساخت دیتابیس، نه آزمون عملیاتی نقش‌ها

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| D1-SCHEMA-01…22 / TEST-TAMIRAN-1010A | نوشتن/خواندن SQLite با migration واقعی | passed 22/22 | محدود به پنج جدول؛ rollback دیتابیس، نه API پذیرش |
| تمام هفت role_code در seed محلی | ساخت رکورد نقش و عضویت + readback | passed | ورود و مجوز API این نقش‌ها هنوز not-run |
| Wrangler migration + ذخیره fixture | D1 محلی / خواندن فایل دیتابیس بدون تغییر | passed | دیتابیس میزبانی‌شده not-run |
| tests/d1-local.test.mjs | ادامه smoke از CLI D1 | incomplete_tool_access | بعد از seed قطع شد؛ رد نوشتن از طریق D1 API تأیید نشده |
| هویت سروری/نشست، مشتری/دستگاه/پذیرش، قبض یکتا/retry، تراکنش اتمیک workflow | API/DB عملیاتی | not-run | مرحله‌های بعد d1-core و reception |
| مرورگر/موبایل/چاپ | E2E و مشاهده | blocked | control-browser در دسترس نیست |

جزئیات، expected/actual و fingerprint ورودی‌ها: `runs/20261010A-d1-identity.md`. پنج جدول و ۷۷ ستون مرجع حفظ شده‌اند؛ کار d1-core کامل نشده است.

## اجرای 20261010B — پرونده، قبض و شواهد دیتابیس

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| D1-CASE-01…18 / TEST-TAMIRAN-1010B | migration واقعی و نوشتن/خواندن SQLite | passed 18/18 | ساختار و محدودیت؛ هنوز API پذیرش نیست |
| D1-SCHEMA-01…22 / TEST-TAMIRAN-1010A | رگرسیون پایه D1 | passed 22/22 | ورود و نشست نقش‌ها هنوز not-run |
| migration 0000 سپس 0001 و دو seed مجزا | Wrangler local D1 | passed؛ 24+53+5+10 statements | دیتابیس میزبانی‌شده not-run |
| readback گراف پرونده | D1 CLI | passed؛ 2 پرونده، 2 workflow، 1 event، 1 audit، 0 FK violation | داده کاملاً آزمایشی |
| اتصال مدل تعمیرگاه ب به دستگاه تعمیرگاه الف | D1 CLI denial + readback | passed؛ trigger رد کرد و model_id برابر 1 ماند | مجوز API هنوز جداگانه not-run |
| یکتایی قبض/retry و تغییرناپذیری هویت قبض | تست migration | passed | هم‌زمانی واقعی چند Worker هنوز not-run |
| rollback شمارنده+پرونده+workflow | تراکنش SQLite | passed | repository عملیاتی D1 هنوز ساخته نشده |
| API پذیرش، double-click شبکه، هویت server-side | application/API E2E | not-run | مرحله بعد d1-core/reception |
| مرورگر/موبایل/چاپ | E2E و مشاهده | blocked | control-browser در دسترس نیست |

جزئیات و اثر عملیاتی در `runs/20261010B-d1-case-core.md`. مجموع فعلی: ۱۵ جدول منتقل‌شده، ۴۰ تست دیتابیس و ۵۵ تست پایه پاس؛ آمادگی پایلوت تأیید نشده است.

## اجرای 20261010C — هویت سروری و batch اتمیک پذیرش محدود

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| D1-RECEPTION-01…08 / TEST-TAMIRAN-1010C | resolver هویت و repository با adapter اتمیک سازگار با D1 | passed 8/8 | فقط مشتری و دستگاه موجود؛ هنوز route شبکه نیست |
| حساب ناشناس، شعبه تعمیرگاه دیگر و نقش تکنسین | role/cross-shop denial | passed | نشست واقعی Site و E2E نقش هنوز not-run |
| success و double-click با idempotency یکسان | نوشتن و readback گراف | passed؛ فقط یک پرونده و یک افزایش sequence | هم‌زمانی واقعی چند Worker هنوز not-run |
| همان idempotency با payload متفاوت | conflict | passed؛ HTTP-equivalent 409 | API پاسخ واقعی هنوز not-run |
| عضویت غیرفعال بعد از resolve | authoritative guard داخل batch | passed؛ کل batch رد و sequence بدون تغییر | انقضای نشست واقعی هنوز not-run |
| خطای تزریقی هنگام workflow | rollback | passed؛ case/event/audit و sequence همگی بدون تغییر | قطع شبکه واقعی هنوز not-run |
| migrations 0000/0001 + seed A | Wrangler local D1 و readback | passed؛ 24+53 schema statements، 0 FK violation، cross-shop denial unchanged | repository مستقیماً روی hosted D1 اجرا نشده |
| TypeScript، build، lint فایل‌های مرحله، source/menu و Site foundation | رگرسیون | passed | lint کامل ۲۳ خطای قدیمی React hook/purity دارد |
| ساخت/به‌روزرسانی مشتری و دستگاه، validation کامل، route احرازشده | API/DB عملیاتی | not-run | نقطه ادامه بعدی |
| مرورگر/موبایل/چاپ | E2E و مشاهده | blocked | control-browser در دسترس نیست |

جزئیات و fingerprintها در `runs/20261010C-server-scope-reception-batch.md`. این مرحله آمادگی پایلوت یا تکمیل پذیرش را اثبات نمی‌کند.

## اجرای 20261010D — customer upsert و دستگاه جدید در batch پذیرش

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| D1-RECEPTION-09…13 / TEST-TAM-1010D-* | repository با adapter تراکنشی سازگار با D1 | passed 5/5 | route شبکه و hosted D1 هنوز not-run |
| مشتری جدید + دستگاه جدید + پرونده/قبض/workflow/events/audit | نوشتن و readback گراف کامل | passed؛ یک تراکنش اتمیک | رنگ، ظاهر، رضایت و policy نشانی هنوز schema/settings ندارند |
| مشتری موجود با موبایل یکسان + دستگاه جدید | upsert در scope تعمیرگاه | passed؛ مشتری تکراری نشد و فیلدهای مجاز به‌روز شدند | update دستگاه موجود هنوز پوشش داده نشده |
| سریال فارسی/عربی نرمال‌شده تکراری | unique index دیتابیس + rollback | passed؛ مشتری، دستگاه، پرونده و sequence همگی بدون تغییر | رقابت واقعی چند Worker هنوز not-run |
| retry همان idempotency / payload متفاوت | replay خواندنی / conflict | passed | قطع شبکه واقعی و HTTP response هنوز not-run |
| خطای تزریقی پس از ایجاد device | rollback کل batch | passed؛ هیچ device/case/receipt یتیم نماند | فقط adapter محلی، نه hosted D1 |
| mobile، national code، postal code و مدل فعال همان تعمیرگاه | validation و preflight | passed در مجموعه repository | address-required، colors و appearance options هنوز not-run |
| migration 0000/0001/0002 روی D1 محلی تازه + readback | Wrangler local D1 | passed؛ 24+53+2 statements، 0 FK violation، cross-shop denial unchanged | دیتابیس میزبانی‌شده not-run |
| رگرسیون schema/repository و source/workflow | تست خودکار | passed؛ 53 DB/repository و 55 baseline | E2E عملیاتی همه نقش‌ها نیست |
| TypeScript، build، lint فایل مرحله و Site foundation | رگرسیون ساخت | passed | lint کامل هنوز ۲۳ خطای قدیمی UI دارد |
| existing-device update، route احرازشده، session/CSRF و role E2E | API/عملیاتی | not-run | نقطه ادامه بعدی |
| مرورگر/موبایل/چاپ | E2E و مشاهده | blocked | control-browser در دسترس نیست |

جزئیات expected/actual و fingerprintها در `runs/20261010D-customer-device-batch.md`. این مرحله فقط هسته داده پذیرش را جلو می‌برد و تکمیل پذیرش یا آمادگی پایلوت را اثبات نمی‌کند.

## اجرای 20261010H — سابقه مشتری و دستگاه

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| LOOKUP-01…10 / TEST-TAMIRAN-1010H + seed A/B | Request/Response + SQLite migration واقعی | passed 10/10 | نه شبکه/hosted D1/E2E |
| مدیر/پذیرش، همه نقش‌های ممنوع، حساب ناشناس/unbound، شعبه غیرمجاز، مجوز غیرفعال/منقضی | handler و scope DB | passed | ورود واقعی هر نقش not-run |
| یک موبایل در دو تعمیرگاه، سابقه آخر، دستگاه بدون مراجعه، نسخه دستگاه و no-secret/no-write | readback | passed | سابقه شعب همان تعمیرگاه مطابق مرجع shop-wide حفظ شد |
| schema/repository/reception/crypto و frozen workflow/source/API | رگرسیون محلی | passed 107 prior +55 baseline checks | browser/E2E نیست |
| TypeScript، lint محدود، Worker build و root foundation | ساخت/حفظ سورس | passed | lint کامل UI قبلی و browser limits برقرار |
| اتصال فرم، hosted GET/DB، نشست و تمام نقش‌ها | عملیاتی | not-run | قراردادهای تنظیمات و drafts در ادامه |

شواهد و expected/actual: `runs/20261010H-customer-lookup.md`. schema و شش migration تغییر نکردند؛ پایلوت هنوز تأیید نیست.

## اجرای 20261010L — پیش‌نویس و تنظیمات پذیرش

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| DRAFT-01…09، 15…16 / TEST-TAMIRAN-1010L | repository + SQLite migration و WebCrypto | passed | تداخل preflight/batch محلی؛ چند Worker not-run |
| DRAFT-HTTP-10…12،17 / seed roles A | Request/Response save/list/discard/create dispatcher | passed | نقش/مالک/شعبه/نسخه/مبدأ/rollback؛ hosted API not-run |
| SETTINGS-13…14 | تنظیمات، کاتالوگ، شرایط فعال و lookup | passed | GET فقط؛ ویرایش تنظیمات و اتصال UI هنوز not-run |
| D1-LOCAL-L / TEST-TAMIRAN-1010L-CLI | Wrangler local D1 هفت schema file + seed جدا | passed 1/1 | envelope مصنوعی storage؛ crypto واقعی جدا در repository؛ hosted D1 not-run |
| 117 prior +17 new inline tests و 55 baseline checks؛ TS/lint bounded/build/foundation | رگرسیون | passed | E2E/چاپ/موبایل نیست |
| draft-to-case و adapter version/terms/device | تراکنش پذیرش + UI | not-run | تبدیل draft هنوز 503؛ نقطه ادامه |

جزئیات علت، expected/actual و محدودیت در `runs/20261010L-drafts-settings.md`. ۲۱ جدول؛ شش migration قبلی بدون تغییر. آمادگی پایلوت تأیید نشده است.

## اجرای 20261010M — تبدیل اتمیک پیش‌نویس

SUBMIT-01…05 passed: مالک/شعبه/کلید/نسخه/TTL، ثبت و retry بدون تغییر، fingerprint و جلوگیری از استفاده مجدد، شکست submit با rollback کل graph/receipt، تغییر هم‌زمان edit/discard و HTTP dispatcher. ۱۳۹ سناریو inline + ۲ wrapper = ۱۴۱ Node entries؛ ۵۵ baseline checks در wrapper. D1-LOCAL-L با هفت migration قبلی روی DB محلی تازه، 1/1 passed؛ شبکه/E2E نیست. گزارش `runs/20261010M-draft-submit.md`.

## اجرای 20261010N — CSRF پذیرش

CSRF-01…09: passed؛ GET scoped/no-store، random token، expiry boundary، tamper/foreign key، account/user/shop/branch isolation، forged/anonymous/forbidden GET، نبود کلید پایدار، missing/invalid token denial on all writes، valid CRUD/create/replay و revoked membership. ۱۴۸ سناریو inline + ۲ wrapper = ۱۵۰ Node entries، ۵۵ baseline checks. TS/build/lint/foundation passed؛ هفت migration و UI ثابت؛ hosted/شبکه/E2E not-run. گزارش `runs/20261010N-reception-csrf.md`.

## اجرای 20261010O — خواندن عملیات و فهرست پرونده

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| OPERATIONS-01…08 / TEST-TAMIRAN-1010A/B | Request/Response + SQLite adapter با migration واقعی | passed 8/8 | شبکه و hosted D1 نیست |
| مدیر، پذیرش، تکنسین، QC، انباردار و مالی | نقش/PII/تخصیص/summary/users | passed | ورود واقعی هر نقش و یک نشست فعال not-run |
| دو تعمیرگاه، دو شعبه، انتخاب شعبه چندعضوی و role/shop spoofing | جداسازی tenant و branch | passed | هم‌زمانی چند Worker not-run |
| لغو عضویت میان resolve/query، user/branch/license غیرفعال | revalidation و denial | passed | revoke نشست dispatch جداگانه منتقل نشده |
| نبود کلید draft و inventoryMode simple/pro | fail-closed 503 بدون پاسخ موفق ناقص | passed | قابلیت و انبار گام بعدی‌اند |
| timeline دو منبع، expectedVersion پرونده، عدم نشت token/ciphertext و no-write readback | projection و امنیت | passed | tracking URL هنوز عمداً خالی؛ پرتال متصل نیست |
| ۱۵۶ سناریو inline + دو wrapper، workflow 55/55، TS، lint محدود، build و source hashes | رگرسیون | passed | browser/E2E نیست |
| هفت migration تازه‌اعمال‌شده + identity/terms/token/draft storage/denial | Wrangler D1 محلی | passed | hosted DB/API not-run |
| capability/module، UI branch/CSRF/draft/terms/device/case version | API/UI | not-run | نقطه ادامه |

جزئیات expected/actual و blast radius در `runs/20261010O-operations-read.md`. schema، هفت migration، ۲۰ منو و فایل‌های frozen رابط تغییر نکردند؛ آمادگی پایلوت تأیید نشده است.

## اجرای 20261010Q — کاتالوگ قابلیت و entitlement

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| CAPABILITY-DB-01 / TEST-TAMIRAN-1010Q | دو جدول frozen، tenant FK، enum/JSON/unique | passed | schema و fixture محلی؛ backfill/hosted نیست |
| CAPABILITY-GET-02…09 | Request/Response + SQLite migration واقعی | passed 8/8 | شبکه/hosted D1/E2E نیست |
| مدیر، پذیرش، تکنسین، QC، انباردار و مالی | permission/navigation/catalog/access | passed | ورود واقعی نقش‌ها و یک نشست فعال not-run |
| Solo/Pro، دو تعمیرگاه، active/trial/expired/suspended/locked، feature flag | scope و entitlement | passed | کاتالوگ hosted seed نشده است |
| لغو عضویت میان resolve/read، حساب ناشناس/unbound، branch و role spoof | revalidation و denial بدون write | passed | dispatch شبکه واقعی not-run |
| D1-LOCAL-Q؛ 0000…0007 + 11 module/17 entitlement | Wrangler local D1 readback و denial | passed 1/1 | دیتابیس میزبانی‌شده not-run |
| ۱۶۷ entry محلی، workflow 55/55، TS، lint محدود، build و frozen source | رگرسیون | passed | browser/mobile/print نیست |
| POST event/request_activation | تراکنش/audit/idempotency | not-run؛ 503 fail-closed | گام جداگانه بعدی |
| actor/context، UI adapter، hosted API/DB، مرورگر | عملیاتی | not-run / blocked | نقطه ادامه actor و شعبه |

جزئیات expected/actual و blast radius در `runs/20261010Q-capabilities-read.md`. مجموع schema اکنون ۲۳ جدول و هشت migration است؛ تکمیل یا آمادگی پایلوت تأیید نشده است.

## اجرای 20261010R — actor/context و انتخاب شعبه

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| ACTOR-01…08 / TEST-TAMIRAN-1010A/B | Request/Response + SQLite adapter با هشت migration واقعی | passed 8/8 | شبکه/hosted D1/E2E نیست |
| مدیر مرکزی و مدیر، پذیرش، تکنسین، QC، انباردار و مالی | binding و نقش authoritative | passed | ورود مرورگری و original single-active-session not-run |
| یک هویت چندشعبه/چندتعمیرگاه، انتخاب صریح و branch role | context و جداسازی tenant/branch | passed | adapter انتخاب context در UI هنوز not-run |
| ناشناس/unbound، role/shop/query spoof، شعبه بیگانه، revoke و suspended | fail-closed و revalidation | passed | dispatch شبکه واقعی not-run |
| read_only و expired، JSON خراب، no-secret/no-write | projection امن | passed | سیاست downstream برای عملیات محدود یک گام جداست |
| ۱۷۵ Node entry، workflow 55/55، TypeScript، lint محدود و build رسمی | رگرسیون | passed | browser/mobile/print نیست |
| هشت migration تازه‌اعمال‌شده + identity/terms/token/draft/capability readback | Wrangler D1 محلی | passed | hosted DB/API not-run |
| UI branch/CSRF/version adapter، POST/DELETE auth و session/logout | عملیاتی | not-run | نقطه ادامه ثبت‌شده |

جزئیات علت، expected/actual و blast radius در `runs/20261010R-actor-context.md`. schema، هشت migration، ۲۰ منو و baseline frozen تغییر نکردند؛ Worker/API میزبانی‌شده و آمادگی پایلوت تأیید نشده‌اند.

## اجرای 20261011S — adapter شعبه و CSRF رابط

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| UI-BRANCH-01…07 | unit قرارداد request/selection | passed 7/7 | اجرای DOM/مرورگر نیست |
| UI-BRANCH-08 / TEST-TAMIRAN-1010S-* | adapter + Request/Response handler + SQLite migration واقعی | passed 1/1 | شبکه/hosted D1 نیست |
| auth شعبه ۳، token شعبه ۱ و ۳، save draft هر شعبه | context/CSRF/write isolation | passed؛ token شعبه ۱ روی شعبه ۳ پاسخ 419، هر شعبه یک draft | چند Worker و مرورگر not-run |
| مدیر، پذیرش، تکنسین، QC، انباردار و مالی | حمل branch در قرارداد یکسان | passed در سطح adapter/handlerهای نقش قبلی | ورود واقعی هر نقش/E2E not-run |
| query/body تکراری یا متناقض، external URL و asset | fail-before-fetch / عدم تغییر | passed | CSP/browser instrumentation not-run |
| reload تعویض شعبه | reset دو cache سراسری CSRF با document جدید | پوشش ساختاری و contract passed | رفتار مرورگری blocked |
| ۱۸۳ Node entry، workflow 55/55، TS، lint محدود، build و frozen source | رگرسیون | passed | browser/mobile/print نیست |
| هشت schema file + پنج identity/terms/draft/capability readback/denial | Wrangler D1 محلی تازه | passed 5/5 | hosted DB/API not-run |
| bootstrap مستقل از followups، نسخه‌های draft/terms/device/case | UI پذیرش واقعی | not-run | نقطه ادامه؛ bootstrap فعلی all-or-nothing است |

جزئیات expected/actual و blast radius در `runs/20261011S-ui-branch-adapter.md`. ۱۹ فایل frozen رابط، ۲۰ منو، schema و هشت migration تغییر نکردند. root فعال همچنان status/demo static است؛ Worker/API میزبانی‌شده و آمادگی پایلوت تأیید نشده‌اند.

## اجرای 20261011T — جداسازی bootstrap از followups

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| BOOTSTRAP-01…03 | unit قرارداد شاخه core و followups | passed 3/3 | DOM/مرورگر نیست |
| BOOTSTRAP-04 / TEST-TAMIRAN-1010A-* | auth و چهار GET اصلی با handler واقعی محلی و SQLite | passed برای شش نقش | شبکه/hosted D1 نیست |
| followups.php منتقل‌نشده | fail-open فقط برای نمایش core؛ خود خطا 503 می‌ماند | passed؛ core fulfilled و followups rejected | عملیات پیگیری هنوز منتقل نشده |
| خرابی یکی از چهار منبع core | fail-closed بدون partial/fake success | passed | UX مرورگری not-run |
| مدیر، پذیرش، تکنسین، QC، انباردار و مالی | role/context و payload واقعی آزمایشی | passed | ورود واقعی هر نقش/E2E not-run |
| ۱۸۷ Node entry، workflow 55/55، TS، lint محدود، build و foundation | رگرسیون | passed | browser/mobile/print نیست |
| source preservation | ۶۷ hash، ۲۰ منو، ۲۷ API، صفر staging request | passed؛ hash یک فایل frozen عمداً بازتأیید شد | ۱۸ فایل frozen دیگر بدون تغییر |
| lint مستقیم page.tsx | baseline شناخته‌شده | ۱۰ خطا + ۱ هشدار، بدون افزایش | بدهی قدیمی رفع نشده |
| نسخه‌های draft/terms/device/case و autosave/discard | UI پذیرش واقعی | not-run | نقطه ادامه |

جزئیات expected/actual و blast radius در `runs/20261011T-bootstrap-isolation.md`. schema و هشت migration تغییر نکردند. root فعال همچنان status/demo static است؛ Worker/API میزبانی‌شده، D1 میزبانی‌شده و آمادگی پایلوت تأیید نشده‌اند.

## اجرای 20261011U — شرایط فعال پذیرش در رابط

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| UI-TERMS-01…02 | قرارداد خالص settings → نمایش → acceptance | passed 2/2 | DOM/مرورگر نیست |
| UI-TERMS-03 / `TEST-TAMIRAN-1011U-A03-*` | handler واقعی محلی + SQLite + CSRF + create_case | passed | دو write کاملاً آزمایشی برای مدیر/پذیرش؛ شبکه/hosted D1 نیست |
| مدیر، پذیرش، تکنسین، QC، انباردار و مالی | خواندن متن/ID/hash یکسان و role denial | passed؛ فقط مدیر/پذیرش 200، چهار نقش دیگر 403 و بدون write | ورود واقعی مرورگری هر نقش not-run |
| نبود/بدشکلی نسخه، hash نامعتبر، عدم تأیید و نسخه عوض‌شده | fail-closed بدون پذیرش خودکار/evidence ساختگی | passed | مشاهده پیام خطا در مرورگر blocked |
| ۱۹۰ سناریوی inline + پنج wrapper ترتیبی D1؛ workflow 55/55 | رگرسیون | passed | hosted/network/E2E نیست |
| TypeScript، lint محدود، build رسمی، foundation و source preservation | ساخت/حفظ سورس | passed | lint قدیمی UI: modules برابر ۳/۲ و page برابر ۱۰/۱ باقی است |
| source preservation | ۶۷ hash، ۲۰ منو، ۲۷ API، صفر staging request | passed؛ سه فایل frozen عمداً بازتأیید شد | ۱۶ فایل frozen دیگر بدون تغییر |
| ارسال فرم واقعی دستگاه جدید | قرارداد strict `previousDeviceId` | not-run/blocked by A04 | UI هنوز `null` می‌فرستد و باید فیلد را حذف کند |
| مرورگر/موبایل/چاپ و hosted API/D1 | E2E عملیاتی | blocked/not-run | ابزار مرورگر در دسترس نیست؛ هیچ fallback بداهه استفاده نشد |

جزئیات expected/actual و blast radius در `runs/20261011U-receipt-terms-ui.md`. A03 محلی بسته شد، اما آمادگی پایلوت و پذیرش واقعی تا قبض تأیید نشده است؛ نقطه ادامه A04 و سپس نسخه‌های device/draft است.

## اجرای 20261011V — قرارداد دستگاه جدید در رابط

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| UI-DEVICE-01 | قرارداد خالص انتخاب دستگاه | passed؛ انتخاب خالی JSON بدون `previousDeviceId`، ID مثبت حفظ و 0/منفی/اعشاری/NaN رد شد | DOM/مرورگر نیست |
| UI-DEVICE-02 / `TEST-TAMIRAN-1011V-A04-991` | handler واقعی محلی + CSRF + SQLite | passed؛ `null` پاسخ 400 و snapshot بدون تغییر، omission پاسخ 200 و یک پرونده، retry بدون write | شبکه/hosted D1 نیست |
| UI-DEVICE-03 / `TEST-TAMIRAN-1011V-A04-*` | مدیر، پذیرش، تکنسین، QC، انباردار و مالی | passed؛ هر شش نقش بدنه omitted-field ساختند؛ فقط مدیر/پذیرش دقیقاً دو write، چهار نقش دیگر 403 و بدون write | ورود مرورگری نقش‌ها not-run |
| 193 سناریوی inline + پنج wrapper ترتیبی D1؛ workflow 55/55 | رگرسیون | passed | hosted/network/E2E نیست |
| TypeScript، lint محدود، build رسمی، foundation و source preservation | ساخت/حفظ سورس | passed | lint قدیمی UI: modules برابر 3/2 و page برابر 10/1 باقی است |
| source preservation | 67 hash، 20 منو، 27 API، صفر staging request | passed؛ hash دو فایل frozen عمداً بازتأیید شد | 17 فایل frozen دیگر بدون تغییر |
| schema و migration | هشت migration و 23 جدول Candidate | بدون تغییر؛ پنج readback/denial محلی passed | دیتابیس میزبانی‌شده not-run |
| دستگاه قبلی و submit پیش‌نویس | `expectedDeviceVersion` / `draftExpectedVersion` | not-run/blocked by A05 | نقطه ادامه |
| مرورگر/موبایل/چاپ و hosted API/D1 | E2E عملیاتی | blocked/not-run | `control-browser` در دسترس نیست؛ fallback بداهه اجرا نشد |

جزئیات expected/actual و blast radius در `runs/20261011V-new-device-contract.md`. A04 در سطح source/type/serialization/handler/SQLite محلی بسته شد، اما آمادگی پایلوت و E2E پذیرش تأیید نشده است؛ نقطه ادامه A05 برای نسخه‌های authoritative دستگاه و پیش‌نویس است.

## اجرای 20261011W — submit نسخه‌دار دستگاه قبلی و پیش‌نویس

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| UI-VERSION-01 | قرارداد خالص شناسه/نسخه | passed؛ فقط جفت کامل دستگاه یا پیش‌نویس ساخته شد؛ missing/منفی/اعشاری/ناامن رد شد | DOM/مرورگر نیست |
| UI-VERSION-02 / `TEST-TAMIRAN-1011W-A05-*` | customer lookup + existing-device create + CSRF + SQLite | passed؛ مدیر/پذیرش نسخه authoritative را خواندند، دستگاه دوم نساختند، retry بدون write بود و stale با 409/snapshot ثابت رد شد | شبکه/hosted D1 نیست |
| UI-VERSION-03 / `TEST-TAMIRAN-1011W-A05-DRAFT-*` | save/list/submit پیش‌نویس + شش نقش | passed؛ مدیر/پذیرش دقیقاً دو write، تکنسین/QC/انبار/مالی 403 و بدون write | ورود مرورگری نقش‌ها not-run |
| UI-VERSION-04 / `TEST-TAMIRAN-1011W-A05-DRAFT-STALE` | جفت ناقص، stale/current و retry | passed؛ ناقص 400، stale 409 و بدون write، current 200 و retry خواندنی | پیام UI مرورگری blocked |
| 197 سناریوی inline + پنج wrapper ترتیبی D1؛ workflow 55/55 | رگرسیون | passed | hosted/network/E2E نیست |
| TypeScript، lint محدود، build رسمی، foundation و source preservation | ساخت/حفظ سورس | passed | lint قدیمی UI: modules برابر 3/2 و page برابر 10/1 باقی است |
| source preservation | 67 hash، 20 منو، 27 API، صفر staging request | passed؛ hash سه فایل frozen عمداً بازتأیید شد | 16 فایل frozen دیگر بدون تغییر |
| schema و migration | هشت migration و 23 جدول Candidate | بدون تغییر؛ پنج readback/denial محلی passed | دیتابیس میزبانی‌شده not-run |
| autosave/discard پیش‌نویس | `expectedVersion` و نمایش conflict 409 | not-run/blocked by A06 | نقطه ادامه |
| مرورگر/موبایل/چاپ و hosted API/D1 | E2E عملیاتی | blocked/not-run | `control-browser` در دسترس نیست؛ fallback بداهه اجرا نشد |

جزئیات expected/actual و blast radius در `runs/20261011W-versioned-submit-ui.md`. A05 در سطح source/type/serialization/handler/SQLite محلی بسته شد، اما آمادگی پایلوت و E2E پذیرش تأیید نشده است؛ نقطه ادامه A06 برای autosave/discard نسخه‌دار و conflict قابل‌مشاهده است.

## اجرای 20261011X — autosave و حذف نسخه‌دار پیش‌نویس

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| UI-DRAFT-01 | صف خالص mutation رابط | passed؛ ذخیره جدید بدون نسخه و دو ویرایش هم‌پوشان با توالی نسخه `0→1→2`؛ pause مانع mutation بعدی شد | DOM/مرورگر نیست |
| UI-DRAFT-02 | قرارداد خالص بدنه adapter و تشخیص status | passed؛ `expectedVersion` فقط برای edit، جفت کامل حذف و تشخیص انحصاری 409 | fetch واقعی مرورگر نیست؛ adapter با TypeScript/build نیز بررسی شد |
| UI-DRAFT-03 / `TEST-TAMIRAN-1011X-A06-301` | handler واقعی محلی + CSRF + SQLite | passed؛ create/edit، retry خواندنی، stale save/discard برابر 409 و snapshot ثابت، حذف جاری و retry حذف بدون write | شبکه/hosted D1 نیست |
| UI-DRAFT-04 / `TEST-TAMIRAN-1011X-A06-*` | مدیر، پذیرش، تکنسین، QC، انباردار و مالی | passed؛ مدیر/پذیرش هرکدام یک چرخه save/edit/discard؛ چهار نقش دیگر 403 و بدون write | ورود مرورگری نقش‌ها not-run |
| DRAFT-15/DRAFT-16 | race repository موجود | passed؛ ایجاد هم‌زمان و update/discard مداخله‌گر بدون audit تکراری یا overwrite | هم‌زمانی چند Worker میزبانی‌شده not-run |
| ۲۰۱ سناریوی inline + پنج wrapper ترتیبی D1؛ workflow ۵۵/۵۵ | رگرسیون | passed | hosted/network/E2E نیست؛ D1 API denial smoke قدیمی محدودیت tool access دارد |
| TypeScript، lint محدود، build رسمی، foundation و source preservation | ساخت/حفظ سورس | passed | lint قدیمی UI: modules برابر ۳/۲ و page برابر ۱۰/۱ باقی است |
| source preservation | ۶۷ hash، ۲۰ منو، ۲۷ API، صفر staging request | passed؛ hash دو فایل frozen عمداً بازتأیید شد | ۱۷ فایل frozen دیگر بدون تغییر |
| schema و migration | هشت migration و ۲۳ جدول Candidate | بدون تغییر؛ پنج readback/denial محلی passed | دیتابیس میزبانی‌شده not-run |
| نمایش و بازیابی conflict | alert و reload recovery در source/build | integrated locally | مشاهده واقعی مرورگر blocked؛ پاس E2E اعلام نمی‌شود |
| نسخه mutation پرونده | `expectedVersion` پرونده | not-run/next A08 | نقطه ادامه؛ A07 branch/CSRF قبلاً بسته شده است |

جزئیات expected/actual و blast radius در `runs/20261011X-draft-mutation-ui.md`. A06 در سطح source/type/queue/handler/SQLite محلی بسته شد، اما مشاهده مرورگری هشدار و بازیابی، API/D1 میزبانی‌شده و آمادگی پایلوت همچنان تأیید نشده‌اند.

## اجرای 20261011Y — mutation نسخه‌دار پرونده

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| UI-CASE-01 | قرارداد خالص بدنه PATCH | passed؛ ID و `expectedVersion` صحیح الزامی؛ نسخه/مبلغ منفی، اعشاری، ناامن یا مفقود پیش از dispatch رد شد | fetch واقعی مرورگر نیست |
| UI-CASE-02 / `TEST-TAMIRAN-1011Y-A08-*` | handler واقعی محلی + CSRF + SQLite | passed؛ نسخه `0→1`، یک event و audit تازه؛ retry دقیق 409 و snapshot ثابت | شبکه/hosted D1 نیست |
| UI-CASE-03 | مدیر، پذیرش، تکنسین، QC، انباردار و مالی | passed؛ چهار نقش اول mutation مجاز و افزایش نسخه؛ انبار/مالی 403 و بدون write؛ توکن هر نقش فقط scoped است | ورود مرورگری نقش‌ها not-run |
| UI-CASE-04 | stale، race، scope، CSRF و قاعده V2 | passed؛ stale و writer مداخله‌گر 409؛ شعبه خارجی 403؛ جعل بدنه 400؛ تغییر وضعیت صریح یا ضمنی workflow برابر 409؛ evidence اضافه نشد | هم‌زمانی چند Worker میزبانی‌شده not-run |
| UI-CASE-05 | rollback و revoke race | passed؛ شکست event پرونده و audit را rollback کرد؛ لغو عضویت میان read/batch با 403 و بدون mutation برنده شد | fault injection محلی است |
| D1-LOCAL-Y | Wrangler D1 محلی | passed؛ case/version/event/audit پایدار، stale/cross-shop read-only و FK سالم | SQL/readback محلی؛ API میزبانی‌شده نیست |
| ۲۰۶ ورودی Node + شش wrapper ترتیبی D1؛ workflow ۵۵/۵۵ | رگرسیون | passed | hosted/network/E2E نیست؛ smoke قدیمی D1 API همچنان محدودیت tool access دارد |
| TypeScript، lint محدود، build رسمی، foundation و source preservation | ساخت/حفظ سورس | passed | بدهی شناخته‌شده lint UI صفر اعلام نمی‌شود |
| source preservation | ۶۷ hash، ۲۰ منو، ۲۷ API، صفر staging request | passed؛ hash چهار فایل frozen عمداً بازتأیید شد | ۱۵ فایل frozen دیگر بدون تغییر |
| schema و migration | هشت migration و ۲۳ جدول Candidate | بدون تغییر | دیتابیس میزبانی‌شده not-run |
| بازیابی conflict | handler مرکزی بعد از 409 snapshot عملیات را تازه می‌کند | integrated locally | مشاهده واقعی alert/toast و retry مرورگری blocked |
| POST/DELETE auth و single-active-session/logout | نشست authoritative | not-run/next | نقطه ادامه محدود بعدی |

جزئیات expected/actual و blast radius در `runs/20261011Y-case-mutation-version-ui.md`. A08 در سطح source/type/Request-Response/SQLite/Wrangler-local بسته شد؛ API/D1 میزبانی‌شده، مشاهده مرورگری و آمادگی پایلوت همچنان تأیید نشده‌اند.

## اجرای 20261011Z — نشست authoritative و خروج

| Evidence / fixture | نوع | وضعیت | محدودیت |
|---|---|---|---|
| AUTH-SESSION-01 / `TEST-TAMIRAN-1011Z-A09-*` | جدول frozen رویداد نشست و constraintهای D1 | passed؛ migration رسمی 0008 فقط schema و مجموع ۲۴ جدول | hosted D1 اجرا نشد |
| AUTH-SESSION-02 | مدیر مرکزی + مدیر، پذیرش، تکنسین، QC، انباردار و مالی | passed؛ هر شش نقش عملیاتی POST/خواندن محافظت‌شده/DELETE و 401 پس از خروج؛ مدیر مرکزی مطابق مرجع از hash تک‌نشست معاف | ورود واقعی مرورگری نقش‌ها not-run |
| AUTH-SESSION-03…05 | restore، ورود دوم و خروج | passed؛ restore cookie جاری بدون write، ورود دوم یک revoked و login، cookie قبلی 401، خروج فقط hash مطابق را پاک و تکرار آن read-only کرد | چند دستگاه/Worker میزبانی‌شده not-run |
| AUTH-SESSION-06…08 | CSRF، جعل حساب/شعبه، tamper، revoke، CAS race و rollback | passed؛ خطاهای 400/401/403/419/409 بدون نشست یا evidence نیمه‌کاره | fault/race محلی SQLite است |
| AUTH-SESSION-09 و UI-AUTH-01…02 | GET token هویت‌محور، قرارداد restore و sign-out متعلق به dispatch | passed در Request/Response و قرارداد TypeScript | مشاهده navigation/cookie در مرورگر blocked |
| D1-LOCAL-Z | Wrangler D1 محلی با fixture نشست | passed؛ login/revoked/login/logout، stale clear بدون تغییر و FK سالم | شبکه/API میزبانی‌شده نیست |
| ۲۱۷ ورودی Node + هفت wrapper ترتیبی D1؛ workflow ۵۵/۵۵ | رگرسیون | passed | hosted/network/E2E نیست؛ smoke قدیمی D1 API همچنان محدودیت tool access دارد |
| TypeScript، lint محدود، build رسمی، foundation و source preservation | ساخت/حفظ سورس | passed؛ ۶۷ hash، ۲۰ منو، ۲۷ API و صفر staging request | یک warning قدیمی schema و بدهی lint UI بدون افزایش باقی است |
| schema و migration | ۹ migration و ۲۴ جدول Candidate | passed محلی؛ جدول event، hash و evidence خام token را ذخیره نکردند | دیتابیس میزبانی‌شده not-run |
| انقضای idle/absolute و credential-change invalidation | parity نشست مرجع | not-run/next | نقطه ادامه محدود؛ تکمیل auth یا پایلوت ادعا نمی‌شود |
| مرورگر/موبایل/چاپ و hosted API/D1 | E2E عملیاتی | blocked/not-run | `control-browser` در دسترس نیست؛ fallback بداهه اجرا نشد |

جزئیات expected/actual، root cause و blast radius در `runs/20261011Z-auth-session.md`. A09 در سطح source/type/Request-Response/SQLite/Wrangler-local بسته شد؛ انقضای نشست، API/D1 میزبانی‌شده، مشاهده مرورگری و آمادگی پایلوت همچنان تأیید نشده‌اند.
