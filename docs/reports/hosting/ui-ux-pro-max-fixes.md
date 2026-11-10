# نتیجهٔ اصلاحات رابط تعمیران

نسخهٔ **2.0.0-php.2**، ۲۴ اکتبر ۲۰۲۶. شش یافتهٔ [بررسی قبلی](ui-ux-pro-max-review.md) با حفظ نسخهٔ PHP/MySQL و ساختار SQL اصلاح شدند.

| یافته | تغییر و نتیجهٔ آزمون |
|---|---|
| خطای API به صفر تبدیل می‌شد | حالت داده، بارگذاری و خطا جدا شدند؛ در شکست اولیه آمار نامعلوم است، retry پایدار وجود دارد و در شکست تازه‌سازی snapshot قبلی با هشدار حفظ می‌شود. قطع و وصل واقعی درخواست خواندن در مرورگر آزموده شد. |
| محصول با کیبورد انتخاب نمی‌شد | combobox دارای گزینهٔ فعال، شناسهٔ یکتا و Arrow/Enter/Escape/Home/End است. Tab به کنترل بعدی می‌رود و فوکوس به BODY نمی‌افتد. |
| ورود فقط تصویری بود | label صریح برای پاسخ و پخش‌کنندهٔ صوت فارسی اضافه شد. تصویر و صوت یک جواب دارند؛ پخش مجدد چالش را عوض نمی‌کند. پس از ورود یا refresh قبلی، صوت قدیمی رد می‌شود. |
| فوکوس پنجره و منو گم می‌شد | hook مشترک برای فوکوس اولیه، محصورکردن Tab، Escape، inert و بازگرداندن فوکوس ساخته شد. پنجرهٔ مدیر، آدرس، کشوی موبایل و تقویم portal داخل پنجره آزموده شدند. |
| کنتراست متن‌ها پایین بود | متن‌های کم‌رنگ و کنترل‌های ثانویه با توکن خوانا اصلاح شدند؛ متن‌های عادی قابل‌اندازه‌گیری در داشبورد و پذیرش حداقل 4.5:1 دارند. اندازهٔ راهنماها و focus ring هم بازبینی شد. |
| اولین Back به خانه برنمی‌گشت | URL بدون view نیز fallback مجاز نقش دارد؛ Back و Forward عنوان و محتوای درست را برمی‌گردانند. |

۳۵ بررسی مرورگر، ۱۴ بررسی API صوت، ۱۶ بررسی فایل صوت/انقضا و ۷۸ تست اصلی API موفق بودند. TypeScript، ساخت، نحو PHP و حفظ مرجع نیز پاس شدند. [خلاصهٔ ماشین‌خوان](ui-ux-pro-max-fixes/summary.json).

پس از ساخت، ۴۹ بررسی دیگر روی سه ZIP، نصب تازه از فرم واقعی و ارتقای کپی نصب‌شدهٔ `php.1` پاس شد. SQL با نسخهٔ قبلی یکسان است و اعمال ZIP به‌روزرسانی، دیتابیس، config و کلیدهای موجود را تغییر نداد. مدیر قبلی پس از ارتقا وارد شد. [نتایج بسته‌ها](ui-ux-pro-max-fixes/package-results.json).

فایل‌های اصلی تغییرکرده:

- [page.tsx](../../../hosting/frontend/src/app/tamiran/page.tsx): وضعیت داده، retry، تاریخچه و کشوی موبایل.
- [modules.tsx](../../../hosting/frontend/src/app/tamiran/modules.tsx) و [use-modal-focus.ts](../../../hosting/frontend/src/app/shared/use-modal-focus.ts): combobox و مدیریت مشترک فوکوس؛ پنجرهٔ مدیر و date picker نیز از همین رفتار استفاده می‌کنند.
- [access.tsx](../../../hosting/frontend/src/app/tamiran/access.tsx)، [captcha.php](../../../hosting/public_html/api/captcha.php) و [captcha-audio.php](../../../hosting/private/captcha-audio.php): label و صوت فارسی وابسته به نشست.
- [accessibility.css](../../../hosting/frontend/public/assets/accessibility.css): توکن کنتراست، راهنماها و فوکوس.

تصاویر: [ورود صوتی در موبایل](ui-ux-pro-max-fixes/login-audio-mobile.png)، [داشبورد خواناتر](ui-ux-pro-max-fixes/dashboard-readable.png)، [خطا با retry و بدون صفر جعلی](ui-ux-pro-max-fixes/initial-load-error.png)، [پذیرش موبایل](ui-ux-pro-max-fixes/reception-mobile.png).

صوت‌های فارسی ضبط Afsham23 از Lingua Libre/Wikimedia Commons با مجوز CC BY-SA 4.0 هستند؛ انتساب در کنار پلیر و فایل notices حفظ شده است. در استفادهٔ روزمره هیچ درخواست TTS خارجی فرستاده نمی‌شود.

محدودیت: آزمون واقعی NVDA/VoiceOver، همهٔ بیست منو و هاست/SSL کاربر اجرا نشده است. اندازه‌گیری کنتراست، متن روی gradient نامطمئن و کنترل غیرفعال را شامل نمی‌شود. این نسخه گواهی کامل دسترس‌پذیری یا ورود بدون آزمون شناختی نیست.
