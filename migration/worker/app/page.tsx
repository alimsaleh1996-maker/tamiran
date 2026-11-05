import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function MigrationHome() {
  await requireChatGPTUser('/');
  return <main dir="rtl" style={{fontFamily:'Tahoma, sans-serif', maxWidth:900, margin:'48px auto', padding:24}}>
    <h1>انتقال تعمیران به سایت‌ساز</h1>
    <p>پایه انتقال در حال آزمون است. این نسخه هنوز نرم‌افزار آماده پایلوت نیست.</p>
    <p>سورس رابط اصلی و منوها حفظ شده‌اند؛ APIهای عملیاتی تا انتقال و آزمون تراکنش‌ها مسدود هستند.</p>
    <p>استیجینگ، مشتری واقعی، پیامک و پرداخت واقعی خارج از این کار هستند.</p>
    <a href="/software">رابط اصلی حفظ‌شده — APIها هنوز عملیاتی نیستند</a>
  </main>;
}
