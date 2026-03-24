"use client";

import { useEffect, useCallback } from "react";

interface FullscreenDocViewerProps {
  /** URL for the iframe src (e.g. /api/doc-gen/baukoordination) */
  url: string;
  onClose: () => void;
}

/**
 * Fullscreen document viewer modal.
 * Opens over the doc-gen page with a blurred, dark backdrop.
 * Displays the document in an iframe at near-full viewport size.
 * Closed via X button or Escape key.
 */
export function FullscreenDocViewer({ url, onClose }: FullscreenDocViewerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      {/* Dark overlay — click to close */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Document frame */}
      <div className="relative z-10 w-[calc(100vw-48px)] h-[calc(100vh-48px)] max-w-[1400px] rounded-xl overflow-hidden shadow-2xl border border-white/10">
        {/* X close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white text-lg leading-none transition-colors shadow-md"
          aria-label="Schließen"
        >
          ×
        </button>

        <iframe
          src={url}
          className="w-full h-full border-0 bg-white"
          title="Dokumentvorschau"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}
