"use client";

import { useRef, useCallback, ReactNode } from "react";

interface InfoPopoverProps {
  /** Unique identifier for this popover instance */
  itemId: string;
  /** Which item is currently active (hovered or pinned) */
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  /** If true the popover stays open until explicitly closed */
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  /** Width in px (default 176) */
  width?: number;
  /** Height in px — omit for auto */
  height?: number;
  /** Called when the body of the popover is clicked (not the X) */
  onClickContent?: () => void;
  children: ReactNode;
}

/**
 * ⓘ trigger button + popover box with:
 * - hover to show, 200ms delay before hiding
 * - click to pin open (stays until X is clicked)
 * - mouse bridge: staying on popover cancels the hide timer
 * - X button top-right to close
 *
 * The popover is positioned to the LEFT of the dropdown panel via
 * `right: calc(100% + 8px); top: 0` on the parent container.
 * Caller must place this inside a `relative` element.
 */
export function InfoPopover({
  itemId,
  activeId,
  onActiveChange,
  pinned,
  onPinChange,
  width = 176,
  height,
  onClickContent,
  children,
}: InfoPopoverProps) {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = activeId === itemId;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      onActiveChange(null);
    }, 200);
  }, [clearHideTimer, onActiveChange]);

  const handleBtnMouseEnter = useCallback(() => {
    clearHideTimer();
    onActiveChange(itemId);
  }, [clearHideTimer, onActiveChange, itemId]);

  const handleBtnMouseLeave = useCallback(() => {
    if (!pinned) scheduleHide();
  }, [pinned, scheduleHide]);

  const handleBtnClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pinned && isActive) {
        onPinChange(false);
        onActiveChange(null);
      } else {
        onPinChange(true);
        onActiveChange(itemId);
      }
    },
    [pinned, isActive, onPinChange, onActiveChange, itemId]
  );

  const handleBoxMouseEnter = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const handleBoxMouseLeave = useCallback(() => {
    if (!pinned) scheduleHide();
  }, [pinned, scheduleHide]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      clearHideTimer();
      onPinChange(false);
      onActiveChange(null);
    },
    [clearHideTimer, onPinChange, onActiveChange]
  );

  return (
    <>
      {/* ⓘ trigger button */}
      <button
        type="button"
        onMouseEnter={handleBtnMouseEnter}
        onMouseLeave={handleBtnMouseLeave}
        onClick={handleBtnClick}
        className={`ml-auto shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-colors
          ${isActive
            ? "bg-gray-600 text-white"
            : "bg-gray-200 text-gray-500 hover:bg-gray-400 hover:text-white"
          }`}
        aria-label="Info"
        tabIndex={-1}
      >
        i
      </button>

      {/* Popover box — rendered into DOM always, visibility controlled by isActive */}
      {isActive && (
        <div
          className="absolute right-full top-0 mr-2 z-[70]"
          style={{ width }}
          onMouseEnter={handleBoxMouseEnter}
          onMouseLeave={handleBoxMouseLeave}
        >
          <div
            className="relative rounded-xl overflow-hidden shadow-xl border border-gray-200"
            style={height ? { height } : undefined}
          >
            {/* X close button */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white text-xs leading-none transition-colors"
              aria-label="Schließen"
            >
              ×
            </button>

            {/* Content area */}
            <div
              className={`w-full ${height ? "h-full" : ""} ${onClickContent ? "cursor-pointer" : ""}`}
              style={height ? { height } : undefined}
              onClick={onClickContent}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
