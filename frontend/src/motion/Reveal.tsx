import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { revealElement } from "./anime";

interface RevealProps {
  children: ReactNode;
  delay?: number; // ms
  staggerIndex?: number;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

export function Reveal({
  children,
  delay = 0,
  staggerIndex = 0,
  className = "",
  style = {},
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const Component = as as any;

  useEffect(() => {
    return revealElement(ref.current, { delay, staggerIndex });
  }, [delay, staggerIndex]);

  return (
    <Component
      ref={ref}
      data-reveal="true"
      className={`reveal-item ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
}
