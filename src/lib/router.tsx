import { useEffect, useState, type AnchorHTMLAttributes } from "react";
import { flushSync } from "react-dom";

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function current() {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

export function useRoute() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const on = () => {
      const next = current();
      // Cross-fade between routes with the View Transitions API where supported; persistent chrome
      // (sidebar, header, active-nav indicator) is named in CSS so it morphs instead of fading.
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (doc.startViewTransition && !prefersReducedMotion()) doc.startViewTransition(() => flushSync(() => setPath(next)));
      else setPath(next);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}

export function navigate(to: string) {
  window.location.hash = to;
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={`#${to}`} {...rest} />;
}

/** Smooth-scroll to a section on the public site, honouring sticky-header offset via scroll-margin. */
export function scrollToId(id: string) {
  const go = () => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };
  if (current() !== "/") {
    navigate("/");
    setTimeout(go, 60);
  } else go();
}
