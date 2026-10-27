import {
  animate,
  createScope,
  onScroll,
  splitText,
  createDrawable,
  stagger,
} from "animejs";

/**
 * Returns true if the user prefers reduced motion or if window is unavailable.
 */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * React helper to create an anime.js Scope and automatically revert it on unmount.
 * Prevents leaks under React StrictMode.
 */
export function createAnimeScope(root?: HTMLElement | null) {
  if (isReducedMotion()) {
    return {
      add: (fn: () => void) => {
        try {
          fn();
        } catch {
          // ignore under reduced motion
        }
      },
      revert: () => {},
    };
  }
  return createScope({ root: root ?? undefined });
}

/**
 * Effect 1: Scroll progress bar
 * A 3 px ink bar under the marketing nav whose width follows page scroll,
 * driven by onScroll in sync mode. Landing only.
 */
export function initScrollProgressBar(barElement: HTMLElement | null): (() => void) | void {
  if (!barElement || typeof window === "undefined") return;

  if (isReducedMotion()) {
    barElement.style.width = "0%";
    return;
  }

  try {
    const observer = onScroll({
      sync: true,
      onUpdate: (self: any) => {
        const progress = typeof self.progress === "number" ? self.progress : 0;
        barElement.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
      },
    });

    return () => {
      try {
        observer.revert();
      } catch {
        // ignore revert error
      }
    };
  } catch {
    barElement.style.width = "0%";
  }
}

/**
 * Effect 2: Staggered section reveal
 * Elements with data-reveal fade and rise 12 px once when they enter,
 * with a 60 ms stagger among siblings.
 */
export function revealElement(
  el: HTMLElement | null,
  options: { delay?: number; staggerIndex?: number } = {}
): (() => void) | void {
  if (!el || typeof window === "undefined") return;

  if (isReducedMotion()) {
    el.style.opacity = "1";
    el.style.transform = "none";
    return;
  }

  const delayMs = (options.delay || 0) + (options.staggerIndex || 0) * 60;
  el.style.opacity = "0";
  el.style.transform = "translateY(12px)";

  try {
    const observer = onScroll({
      target: el,
      enter: "bottom 95%",
      onEnter: () => {
        animate(el, {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 450,
          delay: delayMs,
          ease: "out(2)",
        });
        observer.revert();
      },
    });

    return () => {
      try {
        observer.revert();
      } catch {
        // ignore
      }
      el.style.opacity = "1";
      el.style.transform = "none";
    };
  } catch {
    el.style.opacity = "1";
    el.style.transform = "none";
  }
}

/**
 * Effect 3: Heading split
 * Section h2s on the landing page reveal by word with splitText, 40 ms stagger, once.
 * The text stays in the DOM and selectable with aria-label preserved for screen readers.
 */
export function splitHeading(heading: HTMLElement | null): (() => void) | void {
  if (!heading || typeof window === "undefined") return;

  if (isReducedMotion()) {
    heading.style.opacity = "1";
    return;
  }

  // Preserve accessible label for screen readers
  if (!heading.getAttribute("aria-label")) {
    heading.setAttribute("aria-label", heading.textContent || "");
  }

  try {
    const splitter = splitText(heading, { words: true });
    if (!splitter.words || splitter.words.length === 0) return;

    // Initially hide words
    splitter.words.forEach((w: HTMLElement) => {
      w.style.opacity = "0";
      w.style.transform = "translateY(8px)";
      w.style.display = "inline-block";
    });

    const observer = onScroll({
      target: heading,
      enter: "bottom 95%",
      onEnter: () => {
        animate(splitter.words, {
          opacity: [0, 1],
          translateY: [8, 0],
          delay: stagger(40),
          duration: 400,
          ease: "out(2)",
        });
        observer.revert();
      },
    });

    return () => {
      try {
        observer.revert();
        splitter.revert?.();
      } catch {
        // ignore
      }
      heading.style.opacity = "1";
    };
  } catch {
    heading.style.opacity = "1";
  }
}

/**
 * Effect 4: How-it-works connector
 * The line between the three steps draws with svg.createDrawable as the section
 * scrolls through the viewport, scrubbed with onScroll sync, and step badges pop.
 */
export function initHiwConnector(
  sectionEl: HTMLElement | null,
  pathEl: SVGGeometryElement | null,
  badgeEls: HTMLElement[] = []
): (() => void) | void {
  if (!sectionEl || !pathEl || typeof window === "undefined") return;

  if (isReducedMotion()) {
    return;
  }

  try {
    const drawable = createDrawable(pathEl, 0, 0);
    let popped: boolean[] = [false, false, false];

    const observer = onScroll({
      target: sectionEl,
      enter: "top 80%",
      leave: "bottom 30%",
      sync: true,
      onUpdate: (self: any) => {
        const p = typeof self.progress === "number" ? self.progress : 0;
        // Animate drawable from 0 to 1
        if (drawable && drawable[0]) {
          drawable[0].draw = `0 ${p}`;
        }

        // Pop badges as line reaches each step
        badgeEls.forEach((badge, idx) => {
          const threshold = 0.15 + idx * 0.35;
          if (p >= threshold && !popped[idx]) {
            popped[idx] = true;
            animate(badge, {
              scale: [1, 1.25, 1],
              duration: 350,
              ease: "out(2)",
            });
          }
        });
      },
    });

    return () => {
      try {
        observer.revert();
      } catch {
        // ignore
      }
    };
  } catch {
    // fallback cleanly
  }
}

/**
 * Effect 5: Hero demo parallax
 * The demo card drifts at most 24 px against the scroll, transform only,
 * desktop and fine pointers only.
 */
export function initHeroParallax(
  heroSection: HTMLElement | null,
  demoCard: HTMLElement | null
): (() => void) | void {
  if (!heroSection || !demoCard || typeof window === "undefined") return;

  if (isReducedMotion()) return;

  const isDesktopFine = window.matchMedia(
    "(min-width: 960px) and (pointer: fine)"
  ).matches;
  if (!isDesktopFine) return;

  try {
    const observer = onScroll({
      target: heroSection,
      sync: true,
      onUpdate: (self: any) => {
        const p = typeof self.progress === "number" ? self.progress : 0;
        const offset = Math.round(-p * 24);
        demoCard.style.transform = `translateY(${offset}px)`;
      },
    });

    return () => {
      try {
        observer.revert();
      } catch {
        // ignore
      }
      demoCard.style.transform = "none";
    };
  } catch {
    demoCard.style.transform = "none";
  }
}

/**
 * Effect 6a: Counter animation
 * The benchmark number counts up when visible.
 */
export function animateCounter(
  targetEl: HTMLElement | null,
  targetValue: number,
  duration = 1.2
): (() => void) | void {
  if (!targetEl || typeof window === "undefined") return;

  if (isReducedMotion()) {
    targetEl.textContent = String(targetValue);
    return;
  }

  const obj = { val: 0 };
  try {
    const observer = onScroll({
      target: targetEl,
      enter: "bottom 95%",
      onEnter: () => {
        animate(obj, {
          val: [0, targetValue],
          round: 1,
          duration: duration * 1000,
          ease: "out(3)",
          onUpdate: () => {
            targetEl.textContent = String(obj.val);
          },
        });
        observer.revert();
      },
    });

    return () => {
      try {
        observer.revert();
      } catch {
        // ignore
      }
      targetEl.textContent = String(targetValue);
    };
  } catch {
    targetEl.textContent = String(targetValue);
  }
}

/**
 * Effect 6b: Bento cards staggered entrance
 */
export function initBentoEntrance(gridEl: HTMLElement | null): (() => void) | void {
  if (!gridEl || typeof window === "undefined") return;

  if (isReducedMotion()) return;

  const cards = Array.from(gridEl.querySelectorAll(".catch-bento-card")) as HTMLElement[];
  if (!cards.length) return;

  cards.forEach((c) => {
    c.style.opacity = "0";
    c.style.transform = "translateY(16px)";
  });

  try {
    const observer = onScroll({
      target: gridEl,
      enter: "bottom 95%",
      onEnter: () => {
        animate(cards, {
          opacity: [0, 1],
          translateY: [16, 0],
          delay: stagger(60),
          duration: 450,
          ease: "out(2)",
        });
        observer.revert();
      },
    });

    return () => {
      try {
        observer.revert();
      } catch {
        // ignore
      }
      cards.forEach((c) => {
        c.style.opacity = "1";
        c.style.transform = "none";
      });
    };
  } catch {
    cards.forEach((c) => {
      c.style.opacity = "1";
      c.style.transform = "none";
    });
  }
}

/**
 * Checker entrance animation:
 * Animates verdict card, then seven findings 45ms apart.
 * Ensures the end state is fully visible if interrupted by navigation.
 */
export function animateResultEntrance(
  verdictEl: HTMLElement | null,
  findingEls: HTMLElement[] = []
): () => void {
  if (typeof window === "undefined") return () => {};

  const ensureVisible = () => {
    if (verdictEl) {
      verdictEl.style.opacity = "1";
      verdictEl.style.transform = "none";
    }
    findingEls.forEach((f) => {
      if (f) {
        f.style.opacity = "1";
        f.style.transform = "none";
      }
    });
  };

  if (isReducedMotion()) {
    ensureVisible();
    return () => {};
  }

  try {
    if (verdictEl) {
      verdictEl.style.opacity = "0";
      verdictEl.style.transform = "translateY(10px)";
      animate(verdictEl, {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 320,
        ease: "out(2)",
      });
    }

    if (findingEls.length > 0) {
      findingEls.forEach((f) => {
        if (f) {
          f.style.opacity = "0";
          f.style.transform = "translateY(8px)";
        }
      });

      animate(findingEls, {
        opacity: [0, 1],
        translateY: [8, 0],
        delay: stagger(45, { start: 80 }),
        duration: 350,
        ease: "out(2)",
      });
    }

    return ensureVisible;
  } catch {
    ensureVisible();
    return () => {};
  }
}
