import { useState, useEffect } from "react";

export function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="banner warn offline-banner" role="status" aria-live="polite">
      <div className="offline-content">
        <span className="sticker warn small-sticker">Offline</span>
        <span>
          You are currently offline. Custodia needs a network connection to check claims and verify
          rewrites.
        </span>
      </div>
      <button
        type="button"
        className="btn small"
        onClick={() => setIsOffline(!navigator.onLine)}
      >
        Retry connection
      </button>
    </div>
  );
}
