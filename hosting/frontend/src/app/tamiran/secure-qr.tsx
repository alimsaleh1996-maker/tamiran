"use client";
import { useMemo } from "react";
import QRCode from "qrcode";
export function SecureQr({
  value,
  label = "پیگیری امن",
}: {
  value: string;
  label?: string;
}) {
  const code = useMemo(() => {
    try {
      return QRCode.create(value, { errorCorrectionLevel: "M" });
    } catch {
      return null;
    }
  }, [value]);
  if (!code)
    return (
      <div className="secure-qr-fallback">
        <strong>{label}</strong>
        <span dir="ltr">{value}</span>
      </div>
    );
  const quiet = 4,
    size = code.modules.size,
    dimension = size + quiet * 2;
  const path: string[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (code.modules.get(y, x))
        path.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
  return (
    <div className="secure-qr">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${dimension} ${dimension}`}
        role="img"
        aria-label={`QR ${label}`}
        shapeRendering="crispEdges"
      >
        <rect width={dimension} height={dimension} fill="#fff" />
        <path d={path.join("")} fill="#000" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
