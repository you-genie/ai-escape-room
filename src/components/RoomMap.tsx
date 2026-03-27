"use client";

import type { Scenario } from "@/lib/scenario";
import type { GameState } from "@/lib/game-state";

export function RoomMap({
  scenario,
  gameState,
  onExamine,
  disabled,
}: {
  scenario: Scenario;
  gameState: GameState | null;
  onExamine: (objectName: string) => void;
  disabled: boolean;
}) {
  const discovered = gameState?.discoveries ?? [];
  const inventory = gameState?.inventory ?? [];
  const puzzles = gameState?.puzzlesSolved ?? [];

  function getObjectStatus(obj: { name: string; hiddenItems?: string[]; hiddenClues?: string[] }) {
    const hasFoundItem = obj.hiddenItems?.some((item) => inventory.includes(item));
    const hasFoundClue = obj.hiddenClues?.some((clue) =>
      discovered.some((d) => d.includes(clue) || clue.includes(d))
    );
    if (hasFoundItem || hasFoundClue) return "found";
    return "unknown";
  }

  // Separate NPCs and objects
  const npcs = scenario.npcs ?? [];
  const objects = scenario.objects;

  return (
    <div className="border-b border-zinc-800/50 bg-zinc-950/50">
      {/* Room title bar */}
      <div className="px-3 py-1.5 border-b border-zinc-800/30 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 tracking-widest uppercase">
          방 구조
        </span>
        <span className="text-[10px] text-zinc-700">
          클릭하여 조사
        </span>
      </div>

      {/* Object grid */}
      <div className="p-2 flex flex-wrap gap-1.5">
        {objects.map((obj) => {
          const status = getObjectStatus(obj);
          return (
            <button
              key={obj.name}
              onClick={() => onExamine(obj.name)}
              disabled={disabled}
              className={`
                px-2.5 py-1.5 text-[11px] border rounded-sm transition-all cursor-pointer
                disabled:opacity-30 disabled:cursor-not-allowed
                ${
                  status === "found"
                    ? "border-green-900/40 text-green-600/70 bg-green-950/20"
                    : "border-zinc-800/60 text-zinc-500 bg-zinc-900/30 hover:border-zinc-700 hover:text-zinc-300 hover:bg-zinc-900/60"
                }
              `}
              title={status === "found" ? "조사 완료" : `"${obj.name}"을(를) 조사한다`}
            >
              {status === "found" && (
                <span className="text-green-700 mr-1">&#10003;</span>
              )}
              {obj.name}
            </button>
          );
        })}

        {/* NPCs */}
        {npcs.map((npc) => (
          <button
            key={npc.name}
            onClick={() => onExamine(npc.name)}
            disabled={disabled}
            className="px-2.5 py-1.5 text-[11px] border border-red-900/30 text-red-500/60 bg-red-950/10 rounded-sm hover:border-red-800/50 hover:text-red-400/80 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={`"${npc.name}"에게 말을 건다`}
          >
            &#9679; {npc.name}
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="px-2 pb-2 flex gap-1">
        <button
          onClick={() => onExamine("주위")}
          disabled={disabled}
          className="px-2 py-1 text-[10px] border border-zinc-800/40 text-zinc-600 hover:text-zinc-400 rounded-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          둘러보기
        </button>
        <button
          onClick={() => onExamine("바닥")}
          disabled={disabled}
          className="px-2 py-1 text-[10px] border border-zinc-800/40 text-zinc-600 hover:text-zinc-400 rounded-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          바닥
        </button>
        <button
          onClick={() => onExamine("천장")}
          disabled={disabled}
          className="px-2 py-1 text-[10px] border border-zinc-800/40 text-zinc-600 hover:text-zinc-400 rounded-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          천장
        </button>
      </div>
    </div>
  );
}
