import { useEffect, useRef, useState } from "react";
import { Camera, FileSearch, History, LoaderCircle } from "lucide-react";
import { directAdminRequest } from "./directadmin-api";
import { workflowV2Action } from "./v2-api";
import { queueTimestamp } from "./queue-search";
type Attachment = {
  publicId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
type Activity = {
  id: number;
  description: string;
  actorName: string;
  created_at: string;
};
export function CaseTools({
  caseId,
  locked,
  notify,
}: {
  caseId: number;
  locked: boolean;
  notify: (message: string) => void;
}) {
  const [files, setFiles] = useState<Attachment[]>([]),
    [events, setEvents] = useState<Activity[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reportOpen, setReportOpen] = useState(false),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const requestKey = useRef(crypto.randomUUID());
  const reload = async () => {
    const [f, e] = await Promise.all([
      directAdminRequest<{ files: Attachment[] }>(
        `/api/files-v2.php?caseId=${caseId}`,
      ),
      directAdminRequest<{ events: Activity[] }>(
        `/api/workflow-v2.php?caseId=${caseId}&activity=1`,
      ),
    ]);
    setFiles(f.files);
    setEvents(e.events);
  };
  useEffect(() => {
    let active = true;
    setFiles([]);
    setEvents([]);
    setMessage("");
    setReportOpen(false);
    setError("");
    requestKey.current = crypto.randomUUID();
    void Promise.all([
      directAdminRequest<{ files: Attachment[] }>(
        `/api/files-v2.php?caseId=${caseId}`,
      ),
      directAdminRequest<{ events: Activity[] }>(
        `/api/workflow-v2.php?caseId=${caseId}&activity=1`,
      ),
    ])
      .then(([f, e]) => {
        if (active) {
          setFiles(f.files);
          setEvents(e.events);
        }
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "دریافت سوابق انجام نشد.",
          );
      });
    return () => {
      active = false;
    };
  }, [caseId]);
  return (
    <section className="tech-case-tools" aria-label="عکس و گزارش پرونده">
      {error && (
        <p role="alert" className="identity-error">
          {error}
        </p>
      )}
      <div className="tech-tools-actions">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          hidden
          aria-label="انتخاب عکس پرونده"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              if (file.size > 15 * 1024 * 1024)
                throw new Error("حجم عکس باید حداکثر ۱۵ مگابایت باشد.");
              const form = new FormData();
              form.set("file", file);
              form.set("caseId", String(caseId));
              form.set("purpose", "other");
              await directAdminRequest(
                "/api/files-v2.php",
                { method: "POST", body: form },
                true,
              );
              await reload();
              notify("عکس در همین پرونده ثبت شد.");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "ثبت عکس انجام نشد.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        <button
          type="button"
          disabled={busy || locked}
          className="outline-action"
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <LoaderCircle className="is-spinning" size={17} />
          ) : (
            <Camera size={17} />
          )}{" "}
          ثبت عکس
        </button>
        <button
          type="button"
          disabled={busy || locked}
          className="outline-action"
          aria-expanded={reportOpen}
          onClick={() => setReportOpen((v) => !v)}
        >
          <FileSearch size={17} /> گزارش مشکل
        </button>
      </div>
      {reportOpen && (
        <div className="tech-problem-form">
          <label>
            <span>شرح مشکل پرونده</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                requestKey.current = crypto.randomUUID();
              }}
              placeholder="مشکل مشاهده‌شده یا نکتهٔ نیازمند پیگیری را بنویسید."
            />
          </label>
          <div className="identity-actions">
            <button
              type="button"
              className="primary-action"
              disabled={busy || !message.trim()}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await workflowV2Action({
                    action: "problem_report",
                    caseId,
                    message: message.trim(),
                    idempotencyKey: requestKey.current,
                  });
                  setMessage("");
                  setReportOpen(false);
                  requestKey.current = crypto.randomUUID();
                  await reload();
                  notify("گزارش مشکل در تاریخچهٔ همین پرونده ثبت شد.");
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "ثبت گزارش انجام نشد.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              ثبت گزارش مشکل
            </button>
            <button
              type="button"
              className="outline-action"
              disabled={busy}
              onClick={() => setReportOpen(false)}
            >
              انصراف
            </button>
          </div>
        </div>
      )}
      {files.length > 0 && (
        <details className="tech-attachments">
          <summary>
            عکس‌ها و پیوست‌ها ({files.length.toLocaleString("fa")})
          </summary>
          <div className="tech-photo-grid">
            {files.map((file) => (
              <a
                key={file.publicId}
                href={`/api/files-v2.php?id=${encodeURIComponent(file.publicId)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {file.mimeType.startsWith("image/") && (
                  <img
                    src={`/api/files-v2.php?id=${encodeURIComponent(file.publicId)}`}
                    alt={file.originalName}
                    loading="lazy"
                  />
                )}
                <span>{file.originalName}</span>
              </a>
            ))}
          </div>
        </details>
      )}
      <details className="tech-timeline">
        <summary>
          <History size={17} /> تاریخچهٔ پرونده (
          {events.length.toLocaleString("fa")})
        </summary>
        <div>
          {events.map((event) => (
            <div key={event.id}>
              <small>
                {new Intl.DateTimeFormat("fa-IR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(queueTimestamp(event.created_at))}{" "}
                · {event.actorName}
              </small>
              <p>{event.description}</p>
            </div>
          ))}
          {!events.length && <p>رویدادی برای نمایش نیست.</p>}
        </div>
      </details>
    </section>
  );
}
