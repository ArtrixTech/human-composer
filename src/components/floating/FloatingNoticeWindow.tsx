import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function FloatingNoticeWindow() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void invoke<string>("get_floating_notice_message").then((pending) => {
      if (pending) {
        setMessage(pending);
        setVisible(true);
      }
    });

    let unlisten: (() => void) | undefined;
    void listen<string>("floating-notice-message", (event) => {
      const next = event.payload;
      setMessage(next);
      setVisible(next.length > 0);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  return (
    <div
      className={`floating-notice-window${visible && message ? " floating-notice-window--visible" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible || !message}
    >
      {message}
    </div>
  );
}
