import { useState, useRef, useEffect } from "react";
import { Link, navigate } from "../router";
import { useAuth } from "./AuthContext";

interface UserMenuProps {
  onOpenMyChecks?: () => void;
}

export function UserMenu({ onOpenMyChecks }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <div className="auth-nav-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Link href="/login" className="btn small subtle auth-link-login" aria-label="Log in to your account">
          Log in
        </Link>
        <Link href="/signup" className="btn small auth-link-signup" aria-label="Sign up for an account">
          Sign up
        </Link>
      </div>
    );
  }

  const handleMyChecks = () => {
    setOpen(false);
    if (onOpenMyChecks) {
      onOpenMyChecks();
    } else {
      navigate("/my-checks");
    }
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <div className="user-menu-container" ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn small user-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`User menu for ${user.email}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          maxWidth: "200px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span
          className="user-avatar-badge"
          aria-hidden="true"
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: "var(--teal, #2F7F79)",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {user.email.charAt(0).toUpperCase()}
        </span>
        <span className="user-email-label" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.email}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="user-menu-dropdown panel"
          role="menu"
          aria-label="User account options"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: "180px",
            zIndex: 1000,
            padding: "6px",
            backgroundColor: "var(--card-bg, #fff)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            borderRadius: "8px",
            border: "1px solid var(--border, #E5E0D8)",
          }}
        >
          <div
            className="user-menu-header"
            style={{
              padding: "8px 10px",
              fontSize: "12px",
              color: "var(--ink-muted, #666)",
              borderBottom: "1px solid var(--border, #E5E0D8)",
              marginBottom: "4px",
            }}
          >
            Signed in as
            <div style={{ fontWeight: 650, color: "var(--ink, #14213D)", wordBreak: "break-all" }}>
              {user.email}
            </div>
          </div>

          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={handleMyChecks}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              background: "none",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--ink, #14213D)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            My checks
          </button>

          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={handleLogout}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              background: "none",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--ink, #14213D)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
