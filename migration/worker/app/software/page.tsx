import Home from '../tamiran/page';
import { requireChatGPTUser } from '../chatgpt-auth';
import { BranchContextBoundary } from './branch-context-boundary';
export const dynamic = 'force-dynamic';
export default async function OriginalSoftware() {
  await requireChatGPTUser('/software');
  return <><aside dir="rtl" role="status" style={{padding:16, background:'#fff3cd', color:'#473900', fontFamily:'Tahoma'}}>رابط اصلی حفظ‌شده است؛ تا تکمیل APIها ورود و ثبت عملیاتی غیرفعال هستند. این نسخه برای داده واقعی آماده نیست.</aside><BranchContextBoundary><Home /></BranchContextBoundary></>;
}
