"use client";

import { useState, useEffect, useRef } from "react";
import { parseTextEffects, type TextSegment } from "@/lib/text-effects";

export function EffectText({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) {
  const segments = parseTextEffects(text);
  const [visibleSegments, setVisibleSegments] = useState<
    { segment: TextSegment; displayText: string }[]
  >([]);
  const [done, setDone] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    let cancelled = false;

    async function render() {
      for (let i = 0; i < segments.length; i++) {
        if (cancelled) return;
        const seg = segments[i];

        if (seg.type === "pause") {
          await sleep(seg.duration * 1000);
        } else if (seg.type === "slow") {
          // Type character by character
          for (let j = 0; j <= seg.content.length; j++) {
            if (cancelled) return;
            const partial = seg.content.slice(0, j);
            setVisibleSegments((prev) => {
              const updated = [...prev];
              const existing = updated.findIndex(
                (_, idx) => idx === i
              );
              if (existing >= 0) {
                updated[existing] = { segment: seg, displayText: partial };
              } else {
                updated.push({ segment: seg, displayText: partial });
              }
              return updated;
            });
            await sleep(60);
          }
        } else {
          // text, shake, glitch — show immediately
          setVisibleSegments((prev) => [
            ...prev,
            { segment: seg, displayText: seg.content },
          ]);
        }
      }

      setDone(true);
      onComplete?.();
    }

    render();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If no markers found, show text directly
  const hasEffects = segments.some((s) => s.type !== "text");
  if (!hasEffects) {
    return (
      <span className="whitespace-pre-wrap">{text}</span>
    );
  }

  return (
    <span className={`whitespace-pre-wrap ${!done ? "effect-playing" : ""}`}>
      {visibleSegments.map((item, i) => {
        const { segment, displayText } = item;
        if (segment.type === "shake") {
          return (
            <span key={i} className="inline-block animate-shake">
              {displayText}
            </span>
          );
        }
        if (segment.type === "glitch") {
          return (
            <span key={i} className="inline-block animate-glitch">
              {displayText}
            </span>
          );
        }
        if (segment.type === "slow") {
          return (
            <span key={i} className="text-red-400/90">
              {displayText}
              {!done && i === visibleSegments.length - 1 && (
                <span className="animate-pulse">|</span>
              )}
            </span>
          );
        }
        return <span key={i}>{displayText}</span>;
      })}
    </span>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
