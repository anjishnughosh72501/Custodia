import { useEffect, useRef } from "react";
import { CHECKER_COPY } from "./copy.checker";

interface ShortcutSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutSheet({ isOpen, onClose }: ShortcutSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-dialog shortcut-sheet-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        <div className="shortcut-sheet-header">
          <h2 className="shortcut-sheet-title">{CHECKER_COPY.shortcuts.title}</h2>
          <button
            type="button"
            className="btn-icon close-dialog-btn"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        <ul className="shortcut-list">
          {CHECKER_COPY.shortcuts.items.map((item, idx) => (
            <li key={idx} className="shortcut-item">
              <span className="shortcut-desc">{item.desc}</span>
              <kbd className="shortcut-key">{item.key}</kbd>
            </li>
          ))}
        </ul>

        <div className="shortcut-sheet-footer">
          <button type="button" className="btn small" onClick={onClose}>
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
