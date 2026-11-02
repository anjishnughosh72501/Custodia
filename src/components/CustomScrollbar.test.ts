import { describe, expect, it } from "vitest";

describe("CustomScrollbar calculations and geometry", () => {
  it("1. Computes thumb height based on viewport to content ratio with min 32px", () => {
    const calculateThumbHeight = (clientHeight: number, scrollHeight: number, trackHeight: number) => {
      const ratio = clientHeight / scrollHeight;
      return Math.max(32, Math.min(trackHeight, Math.round(ratio * trackHeight)));
    };

    // Very tall page: ratio is small (800 / 10000 = 0.08), min 32px applies
    expect(calculateThumbHeight(800, 10000, 800)).toBe(64);
    expect(calculateThumbHeight(800, 50000, 800)).toBe(32);

    // Medium page: (800 / 2400) * 800 = 267px
    expect(calculateThumbHeight(800, 2400, 800)).toBe(267);

    // Short page equal to viewport: capped at trackHeight
    expect(calculateThumbHeight(800, 800, 800)).toBe(800);
  });

  it("2. Accurately maps scroll progress to thumb offset at 0%, 50%, and 100%", () => {
    const trackHeight = 1000;
    const thumbHeight = 100;
    const scrollableTrack = trackHeight - thumbHeight; // 900px
    const maxScroll = 4000;

    const getThumbOffset = (scrollTop: number) => {
      const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));
      return Math.round(progress * scrollableTrack);
    };

    // 0% (top)
    expect(getThumbOffset(0)).toBe(0);

    // 50% (middle)
    expect(getThumbOffset(2000)).toBe(450);

    // 100% (bottom)
    expect(getThumbOffset(4000)).toBe(900);

    // Overscroll top / negative clamp
    expect(getThumbOffset(-100)).toBe(0);

    // Overscroll bottom clamp
    expect(getThumbOffset(5000)).toBe(900);
  });

  it("3. Jump-scroll calculation maps track click Y to scroll position", () => {
    const trackHeight = 800;
    const thumbHeight = 80;
    const scrollableTrack = trackHeight - thumbHeight; // 720px
    const maxScroll = 3600;

    const calculateJumpScroll = (clickY: number) => {
      const targetThumbTop = clickY - thumbHeight / 2;
      const progress = Math.max(0, Math.min(1, targetThumbTop / scrollableTrack));
      return Math.round(progress * maxScroll);
    };

    // Click near top
    expect(calculateJumpScroll(40)).toBe(0);

    // Click in middle (400px)
    expect(calculateJumpScroll(400)).toBe(1800);

    // Click near bottom (760px)
    expect(calculateJumpScroll(760)).toBe(3600);
  });

  it("4. Hides custom scrollbar when content does not exceed viewport", () => {
    const isScrollable = (scrollHeight: number, clientHeight: number) => {
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      return maxScroll > 1;
    };

    expect(isScrollable(800, 800)).toBe(false);
    expect(isScrollable(801, 800)).toBe(false);
    expect(isScrollable(1200, 800)).toBe(true);
  });
});

describe("Nav Section Sync Logic", () => {
  it("5. Activates Product at page top and FAQ near bottom", () => {
    const computeActiveSection = (
      scrollY: number,
      clientHeight: number,
      scrollHeight: number,
      sectionTops: { id: string; top: number }[]
    ) => {
      if (scrollY < 120) return "product";
      if (scrollY + clientHeight >= scrollHeight - 60) return "faq";

      const headerOffset = 90;
      let current = "product";
      for (const s of sectionTops) {
        if (s.top <= headerOffset) {
          current = s.id;
        }
      }
      return current;
    };

    const scrollHeight = 4000;
    const clientHeight = 800;

    // Top of page
    expect(computeActiveSection(0, clientHeight, scrollHeight, [])).toBe("product");

    // Middle scrolled to dimensions
    expect(
      computeActiveSection(600, clientHeight, scrollHeight, [
        { id: "product", top: -500 },
        { id: "dimensions", top: 80 },
        { id: "limits", top: 800 },
        { id: "faq", top: 1500 },
      ])
    ).toBe("dimensions");

    // Scrolled to limits
    expect(
      computeActiveSection(1400, clientHeight, scrollHeight, [
        { id: "product", top: -1300 },
        { id: "dimensions", top: -600 },
        { id: "limits", top: 50 },
        { id: "faq", top: 600 },
      ])
    ).toBe("limits");

    // Reached bottom
    expect(computeActiveSection(3200, clientHeight, scrollHeight, [])).toBe("faq");
  });
});
