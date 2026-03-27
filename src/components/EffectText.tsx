"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { parseTextEffects, type TextSegment } from "@/lib/text-effects";

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span className="block mb-2 last:mb-0">{children}</span>,
        strong: ({ children }) => (
          <strong className="text-zinc-100 font-bold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-zinc-400 italic">{children}</em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-red-800/50 pl-3 my-2 text-zinc-500 italic">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>
        ),
        hr: () => <hr className="border-zinc-800 my-3" />,
        code: ({ children }) => (
          <code className="text-red-400/80 bg-zinc-900 px-1 rounded text-xs">
            {children}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

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
          for (let j = 0; j <= seg.content.length; j++) {
            if (cancelled) return;
            const partial = seg.content.slice(0, j);
            setVisibleSegments((prev) => {
              const updated = [...prev];
              const existing = updated.findIndex((_, idx) => idx === i);
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

  // No markers — render as markdown directly
  const hasEffects = segments.some((s) => s.type !== "text");
  if (!hasEffects) {
    return <Markdown>{text}</Markdown>;
  }

  return (
    <span className={!done ? "effect-playing" : ""}>
      {visibleSegments.map((item, i) => {
        const { segment, displayText } = item;
        if (segment.type === "shake") {
          return (
            <span key={i} className="inline-block animate-shake">
              <Markdown>{displayText}</Markdown>
            </span>
          );
        }
        if (segment.type === "glitch") {
          return (
            <span key={i} className="inline-block animate-glitch">
              <Markdown>{displayText}</Markdown>
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
        return (
          <span key={i}>
            <Markdown>{displayText}</Markdown>
          </span>
        );
      })}
    </span>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
