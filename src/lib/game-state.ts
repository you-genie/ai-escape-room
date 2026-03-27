export type EscapeMethod = "normal" | "creative" | "brute" | "bizarre" | "death";

export interface GameState {
  inventory: string[];
  discoveries: string[];
  puzzlesSolved: string[];
  notes: string[];
  escaped: boolean;
  escapeMethod: EscapeMethod | null;
  escapeDescription: string | null;
  actionCount: number;
}

export const initialGameState: GameState = {
  inventory: [],
  discoveries: [],
  puzzlesSolved: [],
  notes: [],
  escaped: false,
  escapeMethod: null,
  escapeDescription: null,
  actionCount: 0,
};

export interface EscapeResult {
  method: EscapeMethod;
  rank: string;
  score: number;
  title: string;
  comment: string;
}

export function calculateEscapeResult(state: GameState): EscapeResult {
  const method = state.escapeMethod ?? "normal";

  // Score puzzles by their solve method
  let puzzleScore = 0;
  for (const p of state.puzzlesSolved) {
    if (p.includes("[normal]")) puzzleScore += 20;
    else if (p.includes("[creative]")) puzzleScore += 25; // bonus for creative
    else if (p.includes("[brute]")) puzzleScore += 8; // reduced for brute
    else puzzleScore += 15; // fallback
  }

  const discoveryScore = state.discoveries.length * 10;
  const inventoryBonus = state.inventory.length * 5;

  // Action efficiency (fewer actions = better)
  const efficiencyBonus = Math.max(0, 50 - state.actionCount * 2);

  // Escape method multiplier
  const methodMultipliers: Record<EscapeMethod, number> = {
    normal: 1.0,
    creative: 1.3,
    brute: 0.5,
    bizarre: 0.3,
    death: 0.1,
  };

  const rawScore = puzzleScore + discoveryScore + inventoryBonus + efficiencyBonus;
  const score = Math.round(rawScore * methodMultipliers[method]);
  const clampedScore = Math.min(100, Math.max(0, score));

  const { rank, title, comment } = getRankInfo(method, clampedScore);

  return { method, rank, score: clampedScore, title, comment };
}

function getRankInfo(
  method: EscapeMethod,
  score: number
): { rank: string; title: string; comment: string } {
  // Special endings for non-normal methods
  if (method === "death") {
    return {
      rank: "F",
      title: "사망 엔딩",
      comment: "탈출은... 했다. 영혼이 되어서.",
    };
  }
  if (method === "bizarre") {
    return {
      rank: "?",
      title: "???",
      comment: "개발자도 예상 못한 방법. 어떻게 한 거야?",
    };
  }
  if (method === "brute") {
    return {
      rank: score >= 40 ? "C" : "D",
      title: "무력 탈출",
      comment: "퍼즐? 그런 건 필요 없다. 힘이 정의다.",
    };
  }
  if (method === "creative") {
    return {
      rank: score >= 80 ? "S" : "A",
      title: "천재적 탈출",
      comment: "예상 밖의 방법으로 우아하게 탈출했다.",
    };
  }

  // Normal method - rank by score
  if (score >= 90) {
    return {
      rank: "S",
      title: "완벽한 탈출",
      comment: "모든 단서를 찾고 효율적으로 탈출했다.",
    };
  }
  if (score >= 70) {
    return {
      rank: "A",
      title: "훌륭한 탈출",
      comment: "대부분의 퍼즐을 풀고 탈출에 성공했다.",
    };
  }
  if (score >= 50) {
    return {
      rank: "B",
      title: "무난한 탈출",
      comment: "놓친 것들이 있지만 탈출에는 성공.",
    };
  }
  if (score >= 30) {
    return {
      rank: "C",
      title: "아슬아슬한 탈출",
      comment: "간신히 탈출했다. 더 꼼꼼하게 살펴보자.",
    };
  }
  return {
    rank: "D",
    title: "겨우 탈출",
    comment: "살아서 나온 게 어디야...",
  };
}

export function gameStateToPrompt(state: GameState): string {
  const inv =
    state.inventory.length > 0 ? state.inventory.join(", ") : "없음";
  const disc =
    state.discoveries.length > 0 ? state.discoveries.join(", ") : "없음";
  const puzzles =
    state.puzzlesSolved.length > 0 ? state.puzzlesSolved.join(", ") : "없음";

  return `
## 현재 게임 상태
- 인벤토리: [${inv}]
- 발견한 것들: [${disc}]
- 해결한 퍼즐: [${puzzles}]
- 행동 횟수: ${state.actionCount}
- 탈출 여부: ${state.escaped ? "탈출 성공" : "아직 갇혀있음"}
`;
}
