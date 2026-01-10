import React, { useRef, useEffect, useMemo } from "react";
import { Button } from "../components/Button";
import { HelpIcon } from "../components/HelpIcon";
import { HELP_TEXT } from "../../shared/helpText";

const renderColoredLog = (log: string): React.ReactNode => {
  const lines = log.split("\n");
  const parts: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (line.trim() === "") {
      parts.push(<span key={`line-${lineIndex}`}>{line}</span>);
      return;
    }

    const timestampMatch = line.match(/^(\[[\d.]+?\])/);
    if (timestampMatch) {
      const timestamp = timestampMatch[1];
      const rest = line.slice(timestamp.length);
      parts.push(
        <span key={`timestamp-${lineIndex}`} className="text-neutral-300/30">
          {timestamp}
        </span>
      );
      parts.push(<span key={`rest-${lineIndex}`}>{rest}</span>);
      return;
    }

    if (line.startsWith("  ")) {
      const labelMatch = line.match(/^  ([A-Za-z]+):\s*(.*)$/);
      if (labelMatch) {
        const [, label, value] = labelMatch;
        parts.push(
          <span key={`indent-${lineIndex}`}> </span>,
          <span key={`label-${lineIndex}`} className="text-neutral-300/60">
            {label}:
          </span>
        );

        if (label === "Method") {
          parts.push(
            <span key={`value-${lineIndex}`} className="text-neutral-300">
              {" "}
              <span className="text-[rgba(255,150,150,0.9)] font-medium">
                {value}
              </span>
            </span>
          );
        } else if (label === "Track" || label === "Module") {
          parts.push(
            <span key={`value-${lineIndex}`} className="text-neutral-300">
              {" "}
              <span className="text-neutral-300">{value}</span>
            </span>
          );
        } else {
          parts.push(
            <span key={`value-${lineIndex}`} className="text-neutral-300">
              {" "}
              {value}
            </span>
          );
        }
      } else {
        parts.push(<span key={`line-${lineIndex}`}>{line}</span>);
      }
    } else {
      const eventTypeMatch = line.match(/^(MIDI Event|Method Execution)/);
      if (eventTypeMatch) {
        const eventType = eventTypeMatch[1];
        const rest = line.slice(eventType.length);
        parts.push(
          <span key={`event-${lineIndex}`} className="text-neutral-300/80">
            {eventType}
          </span>
        );
        if (rest) {
          parts.push(<span key={`rest-event-${lineIndex}`}>{rest}</span>);
        }
      } else {
        parts.push(<span key={`line-${lineIndex}`}>{line}</span>);
      }
    }
  });

  return <>{parts}</>;
};

const LogItem = React.memo(({ log, index }: { log: string; index: number }) => {
  return (
    <div className="flex flex-wrap gap-x-2 mb-1">{renderColoredLog(log)}</div>
  );
});

LogItem.displayName = "LogItem";

export interface DebugOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  debugLogs: string[];
}

export const DebugOverlayModal = React.memo<DebugOverlayModalProps>(
  ({ isOpen, onClose, debugLogs }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    const visibleLogs = useMemo(() => {
      return debugLogs.slice(-200);
    }, [debugLogs]);

    useEffect(() => {
      if (!isOpen || !logContainerRef.current) return;

      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop =
            logContainerRef.current.scrollHeight;
        }
      });

      return () => {
        if (scrollTimeoutRef.current) {
          cancelAnimationFrame(scrollTimeoutRef.current);
        }
      };
    }, [visibleLogs, isOpen]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] bg-[#101010] font-mono flex flex-col">
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center">
          <span className="relative uppercase text-neutral-300">
            DEBUG
            <HelpIcon helpText={HELP_TEXT.debugOverlay} />
          </span>
          <Button onClick={onClose} type="secondary">
            CLOSE
          </Button>
        </div>
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 text-neutral-300 text-[11px] leading-[1.5] [scrollbar-width:none] [-ms-overflow-style:none] hide-scrollbar"
        >
          {visibleLogs.length === 0 ? (
            <div className="text-neutral-300/30">
              No debug logs yet. MIDI events will appear here.
            </div>
          ) : (
            visibleLogs.map((log, index) => (
              <LogItem
                key={`${index}-${log.slice(0, 20)}`}
                log={log}
                index={index}
              />
            ))
          )}
        </div>
      </div>
    );
  }
);

DebugOverlayModal.displayName = "DebugOverlayModal";
