import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { type GameState, initialGameState, gameStateToPrompt } from "./game-state";
import { CallbackHandler as LangfuseHandler } from "langfuse-langchain";
import { type Scenario, scenarioToSystemPrompt } from "./scenario";
import { getScenarioById } from "./scenarios";

// --- Game State Annotation ---
const GameAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  gameState: Annotation<GameState>({
    default: () => ({ ...initialGameState }),
    reducer: (_, update) => update,
  }),
});

// --- Tools ---
const pickupItem = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    if (state.inventory.includes(input.item)) {
      return `이미 "${input.item}"을(를) 가지고 있습니다.`;
    }
    state.inventory.push(input.item);
    return `"${input.item}"을(를) 인벤토리에 추가했습니다.`;
  },
  {
    name: "pickup_item",
    description: "플레이어가 아이템을 주움. 열쇠, 일지 등 물건을 획득할 때 호출",
    schema: z.object({
      item: z.string().describe("획득할 아이템 이름"),
    }),
  }
);

const discoverClue = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    if (state.discoveries.includes(input.clue)) {
      return `이미 "${input.clue}"을(를) 발견했습니다.`;
    }
    state.discoveries.push(input.clue);
    return `"${input.clue}"을(를) 발견했습니다.`;
  },
  {
    name: "discover_clue",
    description: "새로운 단서나 정보를 발견했을 때 호출. 벽의 글씨, 숫자 등",
    schema: z.object({
      clue: z.string().describe("발견한 단서 설명"),
    }),
  }
);

const solvePuzzle = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    const label = `${input.puzzle} [${input.method}]`;
    if (state.puzzlesSolved.includes(input.puzzle)) {
      return `이미 "${input.puzzle}"을(를) 해결했습니다.`;
    }
    state.puzzlesSolved.push(label);
    return `퍼즐 "${input.puzzle}"을(를) ${input.method} 방식으로 해결했습니다!`;
  },
  {
    name: "solve_puzzle",
    description: `퍼즐을 해결했을 때 호출.
    method 종류:
    - "normal": 의도된 방법으로 해결 (단서를 찾아서 비밀번호 입력, 열쇠로 자물쇠 열기)
    - "creative": 의도하지 않았지만 합리적인 방법 (다른 도구로 따기, 우회 경로)
    - "brute": 무력으로 해결 (유리 깨기, 자물쇠 부수기, 문 때리기)`,
    schema: z.object({
      puzzle: z.string().describe("해결한 퍼즐 이름"),
      method: z
        .enum(["normal", "creative", "brute"])
        .describe("퍼즐 해결 방식"),
    }),
  }
);

const useItem = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    if (!state.inventory.includes(input.item)) {
      return `"${input.item}"을(를) 가지고 있지 않습니다.`;
    }
    if (input.consume) {
      state.inventory = state.inventory.filter((i) => i !== input.item);
      return `"${input.item}"을(를) "${input.target}"에 사용하고 소모했습니다.`;
    }
    return `"${input.item}"을(를) "${input.target}"에 사용했습니다.`;
  },
  {
    name: "use_item",
    description: "인벤토리의 아이템을 대상에 사용. 열쇠로 문 열기 등",
    schema: z.object({
      item: z.string().describe("사용할 아이템"),
      target: z.string().describe("사용 대상"),
      consume: z.boolean().describe("사용 후 소모되는지 여부"),
    }),
  }
);

const escapeRoom = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    state.escaped = true;
    state.escapeMethod = input.method;
    state.escapeDescription = input.description;
    return `탈출 방식: ${input.method} - ${input.description}`;
  },
  {
    name: "escape_room",
    description: `플레이어가 방에서 탈출하거나 게임이 종료될 때 호출.
    method 종류:
    - "normal": 퍼즐을 정상적으로 풀어서 탈출
    - "creative": 예상 밖의 창의적인 방법으로 탈출 (의도된 풀이가 아니지만 합리적)
    - "brute": 무력으로 탈출 (문을 부수기, 자물쇠 때려부수기 등)
    - "bizarre": 정말 이상한 방법 (말도 안 되는 방법인데 재미있어서 인정)
    - "death": 사망으로 인한 탈출 (숨 안 쉬기, 자해 등)`,
    schema: z.object({
      method: z
        .enum(["normal", "creative", "brute", "bizarre", "death"])
        .describe("탈출 방식 분류"),
      description: z
        .string()
        .describe("탈출 방식에 대한 짧은 설명 (예: '두 열쇠로 문을 열고 탈출')"),
    }),
  }
);

const giveHint = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    state.hintCount += 1;
    return `힌트 제공 (${state.hintCount}회째): ${input.hint}`;
  },
  {
    name: "give_hint",
    description: `플레이어가 힌트를 요청했을 때 호출. "힌트", "도와줘", "모르겠어", "막혔어" 같은 요청에 반응.
    현재 게임 상태를 분석해서 다음에 할 수 있는 행동을 간접적으로 알려준다.
    너무 직접적으로 정답을 말하지 말고, 방향을 제시하라.
    예: "수술대 주변을 좀 더 자세히 살펴보는 건 어떨까요?" (O)
    예: "수술대 아래에 1987이 적혀있습니다" (X - 너무 직접적)`,
    schema: z.object({
      hint: z.string().describe("간접적인 힌트 내용"),
    }),
  }
);

const movePlayer = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    state.playerX = input.x;
    state.playerY = input.y;
    return `플레이어가 (${input.x}, ${input.y})로 이동했습니다.`;
  },
  {
    name: "move_player",
    description: `플레이어가 방 안에서 이동할 때 호출. 물건 조사 시 해당 물건 위치로 자동 이동.
    "오른쪽으로 이동", "문 쪽으로 간다", "세면대로 다가간다" 등에 반응.
    맵 좌표계: x=0(왼쪽)~6(오른쪽), y=0(위/앞)~4(아래/뒤). 물건의 mapPos 좌표를 참고.`,
    schema: z.object({
      x: z.number().describe("이동할 x 좌표 (0~6)"),
      y: z.number().describe("이동할 y 좌표 (0~4)"),
    }),
  }
);

const changeRoom = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    if (!state.unlockedRooms.includes(input.roomId)) {
      return `"${input.roomId}" 방은 아직 잠겨있습니다.`;
    }
    state.currentRoom = input.roomId;
    state.playerX = input.entryX ?? 3;
    state.playerY = input.entryY ?? 2;
    return `"${input.roomId}" 방으로 이동했습니다.`;
  },
  {
    name: "change_room",
    description: `플레이어가 다른 방으로 이동할 때 호출. 해금된 방만 이동 가능.
    문을 통과하거나, 시간여행 등으로 다른 방으로 갈 때 사용.`,
    schema: z.object({
      roomId: z.string().describe("이동할 방의 ID"),
      entryX: z.number().optional().describe("입장 X 좌표"),
      entryY: z.number().optional().describe("입장 Y 좌표"),
    }),
  }
);

const unlockRoom = tool(
  async (input, config) => {
    const state: GameState = config?.configurable?.gameState;
    if (state.unlockedRooms.includes(input.roomId)) {
      return `"${input.roomId}" 방은 이미 해금되어 있습니다.`;
    }
    state.unlockedRooms.push(input.roomId);
    return `"${input.roomId}" 방이 해금되었습니다!`;
  },
  {
    name: "unlock_room",
    description: "새로운 방이 해금될 때 호출. 퍼즐을 풀거나 열쇠를 사용해서 새 방에 접근 가능해질 때.",
    schema: z.object({
      roomId: z.string().describe("해금할 방의 ID"),
    }),
  }
);

const tools = [pickupItem, discoverClue, solvePuzzle, useItem, escapeRoom, giveHint, movePlayer, changeRoom, unlockRoom];

// --- System Prompt (legacy, replaced by scenario config) ---
const LEGACY_SYSTEM_PROMPT = `당신은 공포 텍스트 방탈출 게임의 게임 마스터입니다. 몰입감 있는 서사와 플레이어의 창의적인 행동을 존중하는 것이 핵심입니다.

## 설정
장소: 버려진 폐병원의 수술실. 1987년에 폐업한 후 아무도 들어오지 않았던 곳.
플레이어는 눈을 떴을 때 이 수술실에 갇혀 있음을 깨달았다.
문은 잠겨 있고, 창문은 없다. 오래된 형광등이 간헐적으로 깜빡인다.
이 병원에서는 의문의 환자 실종 사건이 반복되었고, 마지막 의사인 "박 원장"이 실종된 후 폐업되었다.

## 방 구조 (플레이어가 볼 수 있는 것들)
- **수술대**: 중앙에 녹슨 수술대. 가죽 끈이 달려있다. 마른 핏자국이 있다. 아래를 들여다보면 바닥에 숫자 "1987"이 긁혀있다. 가죽 끈을 풀거나 만지면 차가운 느낌. 수술대 위에는 얼룩진 천이 덮여있고, 천 아래에 녹슨 메스가 있다.
- **약품 캐비닛**: 벽에 달린 유리 캐비닛. 작은 자물쇠로 잠겨있다. 안에 열쇠 하나와 깨진 약병들, 붕대 뭉치가 보인다. 자물쇠를 열거나, 유리를 깨거나, 메스로 자물쇠를 따는 등 다양한 방법으로 열 수 있다.
- **세면대**: 구석에 있는 오래된 세면대. 거울이 금이 가 있다. 수도꼭지를 틀면 녹물이 나오다가 피처럼 붉은 물이 나온다. 배수구 안에 작은 열쇠가 걸려있다. 거울 뒤에는 아무것도 없지만 거울에 뭔가 글씨가 비쳐 보이기도 한다.
- **의사의 책상**: 벽 쪽 낡은 책상. 서랍에 4자리 디지털 잠금장치. (비밀번호: 1987) 책상 위에 먼지 쌓인 사진 액자(가족사진인데 얼굴이 긁혀있음), 펜꽂이(빈 펜꽂이, 안에 먼지). 서랍 안에는 의사의 일지가 있다.
- **출입문**: 튼튼한 철문. 잠겨있다. 열쇠 구멍이 두 개. 문틈으로 차가운 바람이 들어온다. 두드리면 메아리가 울린다. 문 옆 벽에 환자 차트가 걸려있는데 마지막 환자 이름이 검게 칠해져 있다.
- **벽**: 곳곳에 누군가 손톱으로 긁은 흔적. "그가 아직도 여기 있다", "나가게 해줘", "1987" 같은 글씨. 벽 한쪽에 색이 바랜 병원 평면도가 붙어있다.
- **천장**: 형광등이 깜빡인다. 천장 타일 하나가 살짝 들려있어서 밀어올릴 수 있다. 위에 먼지와 함께 무언가가 있다.
- **환기구**: 벽 위쪽 작은 환기구. 안에서 긁는 소리가 간간이 들린다. 나사가 느슨하다. 손이 들어갈 정도 크기.
- **바닥**: 타일 바닥. 한쪽 구석 타일이 깨져있고 그 아래 콘크리트가 보인다. 수술대 주변에 오래된 핏자국 얼룩.

## 핵심 퍼즐 (가이드라인 — 정해진 순서 아님)
탈출 조건: 출입문의 두 열쇠 구멍에 각각 열쇠를 꽂아야 함.

열쇠 1: 약품 캐비닛 안에 있음.
- 캐비닛을 여는 방법: (a) 세면대 배수구의 작은 열쇠로 열기, (b) 유리를 깨기(메스, 주먹 등), (c) 다른 창의적 방법
- 세면대 배수구 열쇠를 얻는 방법: 수도꼭지 틀기, 손 넣기, 도구로 꺼내기 등

열쇠 2: 천장 타일 위에 숨겨져 있음.
- 발견 힌트: 의사 일지("위를 봐라"), 벽 평면도의 표시, 환기구에서 나오는 바람 방향 등
- 천장에 접근하는 방법: 수술대 위에 올라가기, 책상 끌어오기, 직접 뛰어서 밀기 등

비밀번호 1987 단서: 수술대 아래 긁힌 숫자, 벽의 낙서, 사진 액자 뒤 등 여러 곳에서 발견 가능.

## 자유도 원칙 (매우 중요!)
1. 플레이어의 모든 합리적인 행동에 의미있게 반응하라. "안 됩니다"보다 "해봤지만 이런 결과가..."가 낫다.
2. 정해진 퍼즐 풀이 순서는 없다. 플레이어가 천장부터 볼 수도 있고, 문부터 조사할 수도 있다.
3. 창의적인 해결책을 인정하라. 메스로 캐비닛 유리를 깨는 것, 수술대를 끌어서 천장에 닿는 것 등.
4. 물건을 부수거나 조합하는 시도에 반응하라. 결과가 없더라도 묘사를 해줘라.
5. 방 안의 물건을 자유롭게 조사할 수 있다. 뒤집거나, 안을 들여다보거나, 냄새를 맡거나, 두드려보거나.
6. 플레이어가 소리를 지르거나, 노래를 부르거나, 눕거나 하는 이상한 행동에도 반응하라. 방탈출에는 도움이 안 되더라도 분위기 있게 묘사.
7. 불가능한 행동(벽을 부수고 나감, 초능력 등)만 부드럽게 거절하라. 물리적으로 가능하면 허용.

## 공포 연출
- 2~3번의 행동마다 으스스한 이벤트를 삽입하되, 매번 다른 종류로:
  - 형광등이 갑자기 꺼졌다 켜지며 위치가 다른 곳에서 그림자 비침
  - 환기구에서 숨소리, 또는 속삭이는 목소리
  - 복도 쪽에서 발자국 소리가 다가왔다가 멈춤
  - 세면대 거울에 잠깐 누군가의 얼굴이 비침
  - 수술대 가죽 끈이 저절로 조여지는 듯한 소리
  - 차가운 손이 목덜미를 스치는 느낌
  - "돌아와..." "왜 나를 버렸어..." 하는 속삭임
  - 바닥에서 긁는 소리
  - 환자 차트의 글씨가 바뀌어 있는 것 같은 느낌
- 공포 이벤트는 게임 상태나 플레이어의 위치에 따라 다르게. 캐비닛 근처면 약병 관련, 수술대 근처면 가죽 끈 관련.

## 도구 사용 규칙
- 아이템 획득 → pickup_item (아이템 이름은 일관되게)
- 단서 발견 → discover_clue (짧고 명확한 설명)
- 퍼즐 해결 → solve_puzzle
- 아이템 사용 → use_item (열쇠 같은 소모품은 consume: true)
- 탈출 → escape_room (두 열쇠 사용 후에만)
- 한 행동에서 여러 도구 동시 호출 가능

## 응답 규칙
1. 한국어, 2인칭("당신은~"), 감각적 묘사 (시각, 청각, 촉각, 후각, 때로는 미각)
2. 3~8문장. 중요한 발견이나 공포 이벤트 시에는 좀 더 길어도 됨.
3. 탈출 성공 시 분위기 있는 엔딩 나레이션 + "[탈출 성공]"
4. 게임오버 없음. 위험한 행동을 해도 다치는 묘사는 하되 죽지는 않음.
5. 같은 물건을 반복 조사하면 처음과 다른 디테일을 추가하거나, 이전과 달라진 점을 묘사.`;

// --- Graph ---
function createGameGraph(scenario?: Scenario) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.8,
  }).bindTools(tools);

  const systemPrompt = scenario
    ? scenarioToSystemPrompt(scenario)
    : LEGACY_SYSTEM_PROMPT;

  const toolNode = new ToolNode(tools);

  // Agent node: call LLM
  async function agent(
    state: typeof GameAnnotation.State
  ): Promise<Partial<typeof GameAnnotation.State>> {
    const gamePrompt = gameStateToPrompt(state.gameState);
    const systemMsg = new SystemMessage(systemPrompt + "\n" + gamePrompt);
    const response = await model.invoke([systemMsg, ...state.messages]);
    return { messages: [response] };
  }

  // Tool execution node with state mutation
  async function executeTools(
    state: typeof GameAnnotation.State
  ): Promise<Partial<typeof GameAnnotation.State>> {
    // Clone game state for mutation
    const mutableState: GameState = JSON.parse(JSON.stringify(state.gameState));
    const config = { configurable: { gameState: mutableState } };

    // Run tool node with mutable state
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls ?? [];

    const { ToolMessage } = await import("@langchain/core/messages");
    const toolResults: BaseMessage[] = [];
    for (const tc of toolCalls) {
      const foundTool = tools.find((t) => t.name === tc.name);
      if (foundTool) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (foundTool as any).invoke(tc.args, config);
        toolResults.push(
          new ToolMessage({
            content: typeof result === "string" ? result : JSON.stringify(result),
            tool_call_id: tc.id!,
            name: tc.name,
          })
        );
      }
    }

    // Increment action count
    mutableState.actionCount += 1;

    return {
      messages: toolResults,
      gameState: mutableState,
    };
  }

  // Router
  function shouldContinue(state: typeof GameAnnotation.State): string {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }
    return "__end__";
  }

  const graph = new StateGraph(GameAnnotation)
    .addNode("agent", agent)
    .addNode("tools", executeTools)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      __end__: "__end__",
    })
    .addEdge("tools", "agent")
    .compile();

  return graph;
}

// Session storage (in-memory)
const sessions = new Map<
  string,
  {
    gameState: GameState;
    messages: BaseMessage[];
  }
>();

export async function runGame(
  sessionId: string,
  userInput: string,
  scenarioId?: string
): Promise<{ text: string; gameState: GameState }> {
  const scenario = scenarioId ? getScenarioById(scenarioId) : undefined;
  const graph = createGameGraph(scenario);

  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    const startPos = scenario?.map?.playerStart ?? { x: 3, y: 2 };
    const firstRoom = scenario?.rooms?.[0]?.id ?? "main";
    const unlockedRooms = scenario?.rooms
      ? scenario.rooms.filter((r) => !r.locked).map((r) => r.id)
      : ["main"];
    session = {
      gameState: {
        ...initialGameState,
        playerX: startPos.x,
        playerY: startPos.y,
        currentRoom: firstRoom,
        unlockedRooms,
      },
      messages: [],
    };
    sessions.set(sessionId, session);
  }

  // Add user message
  const userMessage = new HumanMessage(userInput);
  session.messages.push(userMessage);

  // Langfuse tracing
  const langfuseHandler = new LangfuseHandler({
    sessionId,
    metadata: { gameState: session.gameState },
  });

  // Run graph
  const result = await graph.invoke(
    {
      messages: session.messages,
      gameState: session.gameState,
    },
    { callbacks: [langfuseHandler] }
  );

  // Extract AI response — find the last AI message with actual text content
  const aiMessages = result.messages.filter((m: BaseMessage) => {
    if (m._getType() !== "ai") return false;
    if (typeof m.content === "string") return m.content.length > 0;
    if (Array.isArray(m.content)) {
      return m.content.some(
        (part: Record<string, unknown>) => part.type === "text" && part.text
      );
    }
    return false;
  });
  const lastAI = aiMessages[aiMessages.length - 1];
  let text = "";
  if (lastAI) {
    if (typeof lastAI.content === "string") {
      text = lastAI.content;
    } else if (Array.isArray(lastAI.content)) {
      text = lastAI.content
        .filter((part: Record<string, unknown>) => part.type === "text")
        .map((part: Record<string, unknown>) => part.text)
        .join("");
    }
  }
  if (!text) {
    text = "(응답을 생성하지 못했습니다. 다시 시도해주세요.)";
  }

  // Update session
  session.messages = result.messages;
  session.gameState = result.gameState;

  // Flush Langfuse traces
  await langfuseHandler.flushAsync();

  return { text, gameState: result.gameState };
}

export { type GameState };
