"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { AnimatedCarLoader } from "@/components/layout/AnimatedCarLoader";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isInternalUrl(url: string) {
  try {
    const nextUrl = new URL(url, window.location.href);
    return nextUrl.origin === window.location.origin;
  } catch {
    return false;
  }
}

function getPathFromStateUrl(url: unknown) {
  if (typeof url !== "string") return null;

  try {
    const nextUrl = new URL(url, window.location.href);
    if (nextUrl.origin !== window.location.origin) return null;
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch {
    return null;
  }
}

export function RouteTransitionOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const startedAtRef = useRef(0);
  const startPathRef = useRef<string | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  function clearTimers() {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }

  function startTransition() {
    startedAtRef.current = Date.now();
    startPathRef.current = window.location.pathname;

    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
    }

    showTimerRef.current = window.setTimeout(() => {
      setVisible(true);
      showTimerRef.current = null;
    }, 0);

    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current);
    }

    fallbackTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      fallbackTimerRef.current = null;
    }, 4500);
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (!isInternalUrl(anchor.href)) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

      if (nextPath !== currentPath) {
        startTransition();
      }
    }

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function patchedPushState(...args) {
      const nextPath = getPathFromStateUrl(args[2]);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextPath && nextPath !== currentPath) {
        startTransition();
      }

      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const nextPath = getPathFromStateUrl(args[2]);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextPath && nextPath !== currentPath) {
        startTransition();
      }

      return originalReplaceState.apply(this, args);
    };

    function onPopState() {
      startTransition();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (startPathRef.current === pathname) return;

    const elapsed = Date.now() - startedAtRef.current;
    const delay = Math.max(520 - elapsed, 160);

    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      startPathRef.current = null;
      clearTimers();
    }, delay);
  }, [pathname, visible]);

  if (!visible) return null;

  return (
    <div
      className="route-transition-overlay"
      role="status"
      aria-live="polite"
      aria-label="Carregando destino"
    >
      <AnimatedCarLoader
        title="Indo para a proxima tela"
        description="Aguarde um instante enquanto o sistema carrega o destino."
        compact
      />
    </div>
  );
}
