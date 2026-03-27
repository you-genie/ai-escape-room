import { NextResponse } from "next/server";
import { runGame } from "@/lib/game-graph";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { sessionId, message, scenarioId } = await req.json();

  try {
    const result = await runGame(sessionId, message, scenarioId);
    console.log("[GAME RESPONSE]", JSON.stringify({ text: result.text.slice(0, 100), textLen: result.text.length, gameState: result.gameState }));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Game error:", error);
    return NextResponse.json(
      { text: "오류가 발생했습니다. 다시 시도해주세요.", gameState: null },
      { status: 500 }
    );
  }
}
