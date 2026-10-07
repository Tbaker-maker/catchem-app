import React from "react";

/** Mounted only when VITE_VIDEO_ENABLED === "true". Does not touch search ranking. */
export default function VideoEntry() {
  return (
    <a
      href="/video/studio.html?video=1"
      onClick={() => {
        try { sessionStorage.setItem("ce-video", "1"); } catch (e) { /* private mode */ }
      }}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 5,
        background: "#64a0ff",
        color: "#070910",
        borderRadius: 999,
        padding: "12px 16px",
        font: "600 14px Sora, system-ui, sans-serif",
        textDecoration: "none",
      }}
    >
      Make a Short
    </a>
  );
}
