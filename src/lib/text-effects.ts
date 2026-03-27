export type TextSegment =
  | { type: "text"; content: string }
  | { type: "pause"; duration: number }
  | { type: "slow"; content: string }
  | { type: "shake"; content: string }
  | { type: "glitch"; content: string }
  | { type: "size"; content: string; size: "xs" | "sm" | "lg" | "xl" | "2xl" };

/**
 * Parse AI response text with effect markers:
 * [pause:2]     — pause for 2 seconds
 * [slow]...[/slow] — type character by character
 * [shake]...[/shake] — shaking text
 * [glitch]...[/glitch] — glitchy corrupted text
 */
export function parseTextEffects(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern =
    /\[pause:(\d+(?:\.\d+)?)\]|\[slow\]([\s\S]*?)\[\/slow\]|\[shake\]([\s\S]*?)\[\/shake\]|\[glitch\]([\s\S]*?)\[\/glitch\]|\[size:(xs|sm|lg|xl|2xl)\]([\s\S]*?)\[\/size\]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: raw.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      segments.push({ type: "pause", duration: parseFloat(match[1]) });
    } else if (match[2] !== undefined) {
      segments.push({ type: "slow", content: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "shake", content: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "glitch", content: match[4] });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      segments.push({ type: "size", content: match[6], size: match[5] as "xs" | "sm" | "lg" | "xl" | "2xl" });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIndex) });
  }

  return segments;
}
