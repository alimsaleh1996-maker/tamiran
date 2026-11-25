import { useEffect, useId, useRef, type RefObject } from "react";

const selector = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const layers: HTMLElement[] = [];
const locks = new WeakMap<HTMLElement, { count: number; inert: boolean; hidden: string | null }>();
let scrollLocks = 0;
let previousOverflow = "";

function lock(element: HTMLElement) {
  const old = locks.get(element);
  if (old) { old.count++; return; }
  locks.set(element, { count: 1, inert: element.inert, hidden: element.getAttribute("aria-hidden") });
  element.inert = true;
  element.setAttribute("aria-hidden", "true");
}

function unlock(element: HTMLElement) {
  const state = locks.get(element);
  if (!state || --state.count > 0) return;
  element.inert = state.inert;
  if (state.hidden === null) element.removeAttribute("aria-hidden");
  else element.setAttribute("aria-hidden", state.hidden);
  locks.delete(element);
}

/** Modal focus, Escape, background isolation and restoration, shared by dialogs/drawers. */
export function useModalFocus(ref: RefObject<HTMLElement | null>, enabled: boolean, onClose: () => void) {
  const id = `modal-${useId().replace(/:/g, "")}`;
  // Capture before descendant autoFocus runs during the mounting commit.
  const mountedOpener = useRef<HTMLElement | null>(typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = active && !element.contains(active) ? active : mountedOpener.current;
    const portals = () => Array.from(document.querySelectorAll<HTMLElement>(`[data-modal-owner="${id}"]`));
    const contains = (node: Node) => element.contains(node) || portals().some((portal) => portal.contains(node));
    const focusable = () => [element, ...portals()].flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(selector)))
      .filter((item) => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden" && !item.closest("[inert]"));
    layers.push(element);
    (element.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0] ?? element).focus({ preventScroll: true });

    const background: HTMLElement[] = [];
    for (let node: HTMLElement | null = element; node?.parentElement; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.matches(`[data-modal-owner="${id}"],[data-modal-dismiss-for="${id}"]`)) {
          lock(sibling); background.push(sibling);
        }
      }
      if (node.parentElement === document.body) break;
    }
    if (scrollLocks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== element) return;
      if (event.key === "Escape") {
        if (event.target instanceof HTMLElement && event.target.closest('[role="combobox"][aria-expanded="true"]')) return;
        // An owned date popup handles its own first Escape before the parent dialog.
        if (portals().some((portal) => portal.getClientRects().length > 0)) return;
        event.preventDefault(); event.stopImmediatePropagation(); close.current();
      } else if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) { event.preventDefault(); element.focus(); return; }
        const active = document.activeElement;
        if (event.shiftKey && (active === items[0] || active === element || !active || !contains(active))) {
          event.preventDefault(); items.at(-1)!.focus();
        } else if (!event.shiftKey && (active === items.at(-1) || !active || !contains(active))) {
          event.preventDefault(); items[0].focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (layers.at(-1) === element && event.target instanceof Node && !contains(event.target)) {
        (focusable()[0] ?? element).focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      const index = layers.lastIndexOf(element);
      const wasTop = index === layers.length - 1;
      if (index >= 0) layers.splice(index, 1);
      background.forEach(unlock);
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
      if (wasTop && previous?.isConnected && !previous.closest("[inert]") && previous.getClientRects().length) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [enabled, id, ref]);
  return id;
}
