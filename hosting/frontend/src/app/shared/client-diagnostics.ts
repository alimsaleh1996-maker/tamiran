/** Report bounded diagnostic metadata only; never send exception text or form data. */
export type ClientDiagnosticKind = 'runtime' | 'unhandled_rejection' | 'render' | 'network_failure' | 'operation_failure';

export function reportClientDiagnostic(kind: ClientDiagnosticKind, endpoint?: string): string {
  const bytes = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const reference = `UI-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const safeEndpoint = endpoint && /^\/api\/[a-z0-9_-]+\.php$/i.test(endpoint) ? endpoint : undefined;
  void fetch('/api/client-error.php', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ reference, kind, endpoint: safeEndpoint }),
  }).then((response) => response.arrayBuffer()).catch(() => { /* Reporting must never affect the application. */ });
  return reference;
}

export function installClientDiagnostics(): void {
  window.addEventListener('error', () => { reportClientDiagnostic('runtime'); });
  window.addEventListener('unhandledrejection', () => { reportClientDiagnostic('unhandled_rejection'); });
}

/** Preserve fetch behavior and report failures only for known local API routes. */
export async function diagnosticFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch (error) {
    if (!init?.signal?.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
      reportClientDiagnostic('network_failure', path.split('?', 1)[0]);
    }
    throw error;
  }
}
