export function migrationApiGate(request: Request): Response {
  const json = (status: number, message: string) => Response.json({ok:false,error:{message,tracking_code:crypto.randomUUID()}},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if (!request.headers.get('oai-authenticated-user-id')) return json(401,'ورود معتبر سایت‌ساز لازم است.');
  if (new URL(request.url).searchParams.has('testRole')) return json(403,'نقش با پارامتر مرورگر قابل تغییر نیست.');
  if (!['GET','HEAD'].includes(request.method) && request.headers.get('Origin')!==new URL(request.url).origin) return json(403,'درخواست از مبدأ معتبر ارسال نشده است.');
  return json(503,'این API هنوز به سایت‌ساز منتقل و آزمون نشده است؛ هیچ عملیات یا داده‌ای ثبت نشد.');
}
