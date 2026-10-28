import { useEffect, useState, type RefObject } from "react";
import { getPrefersReducedMotion } from "./viewTransition";

interface UseInViewOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useInView(
  ref: RefObject<Element | null>,
  options: UseInViewOptions = {}
): boolean {
  const { threshold = 0.15, rootMargin = "0px", triggerOnce = true } = options;

  // Safe SSR and reduced motion check
  const [inView, setInView] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (getPrefersReducedMotion()) return true;
    if (typeof window.IntersectionObserver === "undefined") return true;
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getPrefersReducedMotion() || typeof window.IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    let unmounted = false;

    // Fallback 1: if element is already in viewport on mount, reveal immediately
    try {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setInView(true);
      }
    } catch {
      // ignore
    }

    // Fallback 2: auto-reveal after 1200ms in case observer is throttled or does not fire
    const fallbackTimer = setTimeout(() => {
      if (!unmounted) setInView(true);
    }, 1200);

    // Fallback 3: visibility change or print
    const onVisibility = () => {
      if (!unmounted && document.visibilityState === "visible") {
        setInView(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!unmounted) setInView(true);
            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            if (!unmounted) setInView(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      unmounted = true;
      clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, [ref, threshold, rootMargin, triggerOnce]);

  return inView;
}
