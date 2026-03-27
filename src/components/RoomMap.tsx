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
  const map = scenario.map;
  if (!map) return null;

  const discovered = gameState?.discoveries ?? [];
  const inventory = gameState?.inventory ?? [];

  function isFound(obj: { hiddenItems?: string[]; hiddenClues?: string[] }) {
    return (
      obj.hiddenItems?.some((item) => inventory.includes(item)) ||
      obj.hiddenClues?.some((clue) =>
        discovered.some((d) => d.includes(clue) || clue.includes(d))
      )
    );
  }

  // Build grid cells
  const grid: (null | {
    type: "object" | "npc" | "player" | "exit";
    name: string;
    found?: boolean;
  })[][] = Array.from({ length: map.height }, () =>
    Array.from({ length: map.width }, () => null)
  );

  // Place objects
  for (const obj of scenario.objects) {
    if (obj.mapPos) {
      grid[obj.mapPos.y][obj.mapPos.x] = {
        type: "object",
        name: obj.name,
        found: !!isFound(obj),
      };
    }
  }

  // Place NPCs
  if (map.npcPositions) {
    for (const [name, pos] of Object.entries(map.npcPositions)) {
      grid[pos.y][pos.x] = { type: "npc", name };
    }
  }

  // Place exit
  if (map.exitPos) {
    const cell = grid[map.exitPos.y][map.exitPos.x];
    if (!cell) {
      grid[map.exitPos.y][map.exitPos.x] = { type: "exit", name: "출구" };
    }
  }

  // Player position from game state (falls back to map start)
  const px = gameState?.playerX ?? map.playerStart.x;
  const py = gameState?.playerY ?? map.playerStart.y;

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1.5 border-b border-zinc-800/30 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 tracking-widest uppercase">
          맵
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-2">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${map.width}, 1fr)`,
            gridTemplateRows: `repeat(${map.height}, 1fr)`,
            width: "100%",
            aspectRatio: `${map.width} / ${map.height}`,
          }}
        >
          {grid.flatMap((row, y) =>
            row.map((cell, x) => {
              const isPlayer = x === px && y === py;

              if (isPlayer && !cell) {
                return (
                  <div
                    key={`${x}-${y}`}
                    className="bg-green-900/30 border border-green-800/40 rounded-[2px] flex items-center justify-center"
                    title="내 위치"
                  >
                    <span className="text-green-400 text-[10px] font-bold">
                      @
                    </span>
                  </div>
                );
              }

              if (!cell) {
                return (
                  <div
                    key={`${x}-${y}`}
                    className="bg-zinc-900/30 border border-zinc-800/20 rounded-[2px]"
                  />
                );
              }

              if (cell.type === "npc") {
                return (
                  <button
                    key={`${x}-${y}`}
                    onClick={() => onExamine(cell.name)}
                    disabled={disabled}
                    className="bg-red-950/30 border border-red-900/30 rounded-[2px] flex items-center justify-center cursor-pointer hover:bg-red-950/50 hover:border-red-800/50 transition-colors disabled:opacity-30 relative"
                    title={cell.name}
                  >
                    {isPlayer && (
                      <span className="absolute -top-0.5 -right-0.5 text-green-400 text-[7px] font-bold">
                        @
                      </span>
                    )}
                    <span className="text-red-500/70 text-[8px] leading-none truncate px-0.5">
                      {cell.name[0]}
                    </span>
                  </button>
                );
              }

              if (cell.type === "exit") {
                return (
                  <button
                    key={`${x}-${y}`}
                    onClick={() => onExamine("출입문")}
                    disabled={disabled}
                    className="bg-amber-950/20 border border-amber-900/30 rounded-[2px] flex items-center justify-center cursor-pointer hover:bg-amber-950/40 transition-colors disabled:opacity-30 relative"
                    title="출구"
                  >
                    {isPlayer && (
                      <span className="absolute -top-0.5 -right-0.5 text-green-400 text-[7px] font-bold">
                        @
                      </span>
                    )}
                    <span className="text-amber-600/60 text-[8px]">&#9747;</span>
                  </button>
                );
              }

              // Object
              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => onExamine(cell.name)}
                  disabled={disabled}
                  className={`
                    border rounded-[2px] flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 relative
                    ${
                      cell.found
                        ? "bg-green-950/20 border-green-900/30"
                        : "bg-zinc-900/50 border-zinc-800/40 hover:bg-zinc-800/50 hover:border-zinc-700/50"
                    }
                  `}
                  title={cell.name}
                >
                  {isPlayer && (
                    <span className="absolute -top-0.5 -right-0.5 text-green-400 text-[7px] font-bold">
                      @
                    </span>
                  )}
                  <span
                    className={`text-[7px] leading-none truncate px-0.5 ${
                      cell.found ? "text-green-600/60" : "text-zinc-500/80"
                    }`}
                  >
                    {cell.name.length > 3 ? cell.name.slice(0, 2) : cell.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-2 pb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-zinc-700">
        <span>
          <span className="text-green-400">@</span> 나
        </span>
        <span>
          <span className="text-red-500/70">&#9679;</span> NPC
        </span>
        <span>
          <span className="text-amber-600/60">&#9747;</span> 출구
        </span>
        <span>
          <span className="text-green-600/60">&#9632;</span> 조사완료
        </span>
      </div>
    </div>
  );
}
