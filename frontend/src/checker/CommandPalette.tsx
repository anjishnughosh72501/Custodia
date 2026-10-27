import { useState, useEffect, useRef, useMemo } from "react";
import type { Example } from "../types";
import { CHECKER_COPY } from "./copy.checker";

interface CommandItem {
  id: string;
  category: "Actions" | "Navigation" | "Examples";
  label: string;
  detail?: string;
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewCheck: () => void;
  onCopyLink?: () => void;
  onCopyReport?: () => void;
  onOpenRecent?: () => void;
  onOpenShortcuts?: () => void;
  onLoadExample?: (example: Example) => void;
  examples: Example[];
  hasReview: boolean;
  onJumpToSection?: (sectionId: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNewCheck,
  onCopyLink,
  onCopyReport,
  onOpenRecent,
  onOpenShortcuts,
  onLoadExample,
  examples,
  hasReview,
  onJumpToSection,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: "new-check",
        category: "Actions",
        label: "New check",
        detail: "Clear inputs and return to empty draft",
        run: () => {
          onNewCheck();
          onClose();
        },
      },
    ];

    if (hasReview) {
      if (onCopyLink) {
        list.push({
          id: "copy-link",
          category: "Actions",
          label: "Copy share link",
          detail: "Copy persistent URL for this review",
          run: () => {
            onCopyLink();
            onClose();
          },
        });
      }
      if (onCopyReport) {
        list.push({
          id: "copy-report",
          category: "Actions",
          label: "Copy text report",
          detail: "Copy full markdown summary with notes to clipboard",
          run: () => {
            onCopyReport();
            onClose();
          },
        });
      }
    }

    if (onOpenRecent) {
      list.push({
        id: "recent-checks",
        category: "Actions",
        label: "Open recent checks",
        detail: "View local browser history of claims checked",
        run: () => {
          onOpenRecent();
          onClose();
        },
      });
    }

    if (onOpenShortcuts) {
      list.push({
        id: "shortcuts",
        category: "Actions",
        label: "Keyboard shortcuts",
        detail: "Show available hotkeys and navigation shortcuts",
        run: () => {
          onOpenShortcuts();
          onClose();
        },
      });
    }

    if (hasReview && onJumpToSection) {
      list.push(
        {
          id: "jump-verdict",
          category: "Navigation",
          label: "Jump to verdict",
          run: () => {
            onJumpToSection("verdict-card");
            onClose();
          },
        },
        {
          id: "jump-inspector",
          category: "Navigation",
          label: "Jump to inspector",
          run: () => {
            onJumpToSection("inspector");
            onClose();
          },
        },
        {
          id: "jump-findings",
          category: "Navigation",
          label: "Jump to findings",
          run: () => {
            onJumpToSection("findings");
            onClose();
          },
        },
        {
          id: "jump-risks",
          category: "Navigation",
          label: "Jump to language risks",
          run: () => {
            onJumpToSection("risks");
            onClose();
          },
        },
        {
          id: "jump-rewrite",
          category: "Navigation",
          label: "Jump to rewrite",
          run: () => {
            onJumpToSection("rewrite-section");
            onClose();
          },
        }
      );
    }

    if (examples && onLoadExample) {
      examples.forEach((ex) => {
        list.push({
          id: `example-${ex.id}`,
          category: "Examples",
          label: `Load example: ${ex.title}`,
          detail: ex.claim.slice(0, 70) + "…",
          run: () => {
            onLoadExample(ex);
            onClose();
          },
        });
      });
    }

    return list;
  }, [hasReview, onCopyLink, onCopyReport, onOpenRecent, onOpenShortcuts, onNewCheck, onClose, onJumpToSection, examples, onLoadExample]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.detail && c.detail.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].run();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(".command-item.active") as HTMLElement | null;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog command-palette-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-search-wrap">
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder={CHECKER_COPY.palette.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          <kbd className="command-esc-hint">Esc</kbd>
        </div>

        <ul className="command-list" ref={listRef} role="listbox" aria-label="Available commands">
          {filteredCommands.length === 0 ? (
            <li className="command-empty">No matching commands</li>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  key={cmd.id}
                  className={`command-item ${isSelected ? "active" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={cmd.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="command-main">
                    <span className="command-label">{cmd.label}</span>
                    {cmd.detail && <span className="command-detail">{cmd.detail}</span>}
                  </div>
                  <span className="command-category sticker small-sticker">{cmd.category}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
