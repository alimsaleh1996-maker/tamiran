import { useEffect, useRef, useState } from "react";
import { directAdminRequest } from "./directadmin-api";
export type TechnicalFile = {
  publicId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: string;
  purpose: string;
};
export function TechnicianFilesPage({
  caseId,
  allowed,
  busy,
  onUpload,
  date,
}: {
  caseId: number;
  allowed: boolean;
  busy: boolean;
  onUpload: (file: File) => void;
  date: (value: string | null) => string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<TechnicalFile[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void directAdminRequest<{ files: TechnicalFile[] }>(
      `/api/files-v2.php?caseId=${caseId}&technical=1`,
    )
      .then((d) => {
        if (alive) setFiles(d.files);
      })
      .catch(() => {
        if (alive) setError("دریافت تصاویر انجام نشد؛ صفحه را تازه کنید.");
      });
    return () => {
      alive = false;
    };
  }, [caseId]);
  return (
    <>
      <p>
        عکس یا فایل اختیاری است. فایل تازه به گزارش بعدی متصل می‌شود و در همین
        پرونده می‌ماند.
      </p>
      {allowed && (
        <div className="tech-file-picker">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            افزودن عکس یا فایل
          </button>
          <input
            ref={input}
            hidden
            aria-label="انتخاب عکس یا فایل"
            type="file"
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUpload(file);
            }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="tech-error">
          {error}
        </p>
      )}
      <h3>تصاویر و فایل‌های ثبت‌شده</h3>
      <ul className="tech-file-list">
        {files.map((f) => (
          <li key={f.publicId}>
            {f.mimeType.startsWith("image/") && (
              <img
                src={`/api/files-v2.php?id=${encodeURIComponent(f.publicId)}`}
                alt={f.originalName}
                loading="lazy"
                width={80}
                height={80}
              />
            )}
            <div>
              <a
                href={`/api/files-v2.php?id=${encodeURIComponent(f.publicId)}`}
                target="_blank"
                rel="noreferrer"
              >
                {f.originalName}
              </a>
              <p>
                {f.uploadedBy || "ثبت‌کنندهٔ پرونده"} · {date(f.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!files.length && !error && (
        <p className="tech-hint">تصویری ثبت نشده است.</p>
      )}
    </>
  );
}
