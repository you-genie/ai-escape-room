export interface GameState {
  inventory: string[];
  discoveries: string[];
  puzzlesSolved: string[];
  notes: string[];
  escaped: boolean;
  actionCount: number;
}

export const initialGameState: GameState = {
  inventory: [],
  discoveries: [],
  puzzlesSolved: [],
  notes: [],
  escaped: false,
  actionCount: 0,
};

export function gameStateToPrompt(state: GameState): string {
  const inv =
    state.inventory.length > 0
      ? state.inventory.join(", ")
      : "없음";
  const disc =
    state.discoveries.length > 0
      ? state.discoveries.join(", ")
      : "없음";
  const puzzles =
    state.puzzlesSolved.length > 0
      ? state.puzzlesSolved.join(", ")
      : "없음";

  return `
## 현재 게임 상태
- 인벤토리: [${inv}]
- 발견한 것들: [${disc}]
- 해결한 퍼즐: [${puzzles}]
- 행동 횟수: ${state.actionCount}
- 탈출 여부: ${state.escaped ? "탈출 성공" : "아직 갇혀있음"}
`;
}
