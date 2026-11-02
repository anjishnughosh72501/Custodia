import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute } from "../router";
import { isReducedMotion } from "../motion/anime";

export function CustomScrollbar() {
  const route = useRoute();
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(false);
  const [ariaValue, setAriaValue] = useState(0);

  // Dragging state tracking via refs to ensure zero stale closures during pointer capture
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  // Geometry cache updated on resize / layout changes
  const metricsRef = useRef({
    scrollHeight: 0,
    clientHeight: 0,
    trackHeight: 0,
    thumbHeight: 32,
    maxScroll: 0,
  });

  const rafIdRef = useRef<number | null>(null);

  const recalculateMetrics = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const trackHeight = clientHeight;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);

    if (maxScroll <= 1) {
      setVisible(false);
      metricsRef.current.maxScroll = 0;
      return;
    }

    setVisible(true);

    // Thumb height reflects viewport / content ratio (minimum 32px, capped at trackHeight)
    const ratio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(32, Math.min(trackHeight, Math.round(ratio * trackHeight)));

    metricsRef.current = {
      scrollHeight,
      clientHeight,
      trackHeight,
      thumbHeight,
      maxScroll,
    };

    if (thumbRef.current) {
      thumbRef.current.style.height = `${thumbHeight}px`;
    }

    renderThumbPosition();
  }, []);

  const renderThumbPosition = useCallback(() => {
    const { maxScroll, trackHeight, thumbHeight } = metricsRef.current;
    if (maxScroll <= 0 || !thumbRef.current) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));
    const maxThumbTop = trackHeight - thumbHeight;
    const thumbTop = Math.round(progress * maxThumbTop);

    thumbRef.current.style.transform = `translateY(${thumbTop}px)`;
    const roundedPercent = Math.round(progress * 100);
    setAriaValue(roundedPercent);
  }, []);

  // Passive scroll listener scheduling rAF
  useEffect(() => {
    const onScroll = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        renderThumbPosition();
        rafIdRef.current = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [renderThumbPosition]);

  // Recalculate on route changes, resize, and font loading
  useEffect(() => {
    recalculateMetrics();

    const onResize = () => {
      recalculateMetrics();
    };
    window.addEventListener("resize", onResize, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        recalculateMetrics();
      });
      resizeObserver.observe(document.documentElement);
      if (document.body) {
        resizeObserver.observe(document.body);
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        recalculateMetrics();
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [recalculateMetrics, route.path]);

  // Pointer drag handling on thumb
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = window.scrollY || document.documentElement.scrollTop || 0;

    if (thumbRef.current) {
      thumbRef.current.setPointerCapture(e.pointerId);
      thumbRef.current.classList.add("dragging");
    }
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const deltaY = e.clientY - dragStartYRef.current;
    const { maxScroll, trackHeight, thumbHeight } = metricsRef.current;
    const scrollableTrack = trackHeight - thumbHeight;

    if (scrollableTrack <= 0) return;

    const scrollRatio = deltaY / scrollableTrack;
    const newScrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTopRef.current + scrollRatio * maxScroll));

    window.scrollTo({
      top: newScrollTop,
      behavior: "instant" as ScrollBehavior,
    });
  };

  const handleThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (thumbRef.current) {
      try {
        thumbRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      thumbRef.current.classList.remove("dragging");
    }
  };

  // Jump scroll when clicking the track outside the thumb
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === thumbRef.current) return;

    const trackEl = trackRef.current;
    if (!trackEl) return;

    const rect = trackEl.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const { maxScroll, trackHeight, thumbHeight } = metricsRef.current;
    const scrollableTrack = trackHeight - thumbHeight;

    if (scrollableTrack <= 0) return;

    // Center the thumb at the click position
    const targetThumbTop = clickY - thumbHeight / 2;
    const progress = Math.max(0, Math.min(1, targetThumbTop / scrollableTrack));
    const targetScroll = Math.round(progress * maxScroll);

    window.scrollTo({
      top: targetScroll,
      behavior: isReducedMotion() ? "auto" : "smooth",
    });
  };

  if (!visible) return null;

  return (
    <div
      ref={trackRef}
      className="custom-scrollbar-track"
      role="scrollbar"
      aria-controls="main-content"
      aria-orientation="vertical"
      aria-valuenow={ariaValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page scroll progress"
      tabIndex={-1}
      onPointerDown={handleTrackPointerDown}
    >
      <div
        ref={thumbRef}
        className="custom-scrollbar-thumb"
        onPointerDown={handleThumbPointerDown}
        onPointerMove={handleThumbPointerMove}
        onPointerUp={handleThumbPointerUp}
        onPointerCancel={handleThumbPointerUp}
      />
    </div>
  );
}
