"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { type GameState, calculateEscapeResult, type EscapeResult } from "@/lib/game-state";
import { EffectText } from "@/components/EffectText";
import { RoomMap } from "@/components/RoomMap";
import type { Scenario } from "@/lib/scenario";
import { scenarios } from "@/lib/scenarios";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const moodLabels: Record<string, string> = {
  horror: "\u2620",
  mystery: "\uD83D\uDD0D",
  scifi: "\u2699",
  fantasy: "\u2729",
  comedy: "\u263A",
};

export default function EscapeRoom() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!startTime) return;
    if (gameState?.escaped) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, gameState?.escaped]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const sendMessage = useCallback(
    async (text: string) => {
      setIsLoading(true);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: text,
            scenarioId: selectedScenario?.id,
          }),
        });
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.text,
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (data.gameState) {
          setGameState(data.gameState);
        }
      } catch {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "연결 오류가 발생했습니다. 다시 시도해주세요.",
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [sessionId, selectedScenario]
  );

  const handleStart = () => {
    setStarted(true);
    setStartTime(Date.now());
    sendMessage(
      "게임을 시작합니다. 눈을 떠보니 어딘지 모를 곳에 있습니다. 주위를 둘러봅니다."
    );
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const addNote = () => {
    if (!noteInput.trim()) return;
    setNotes((prev) => [...prev, noteInput.trim()]);
    setNoteInput("");
  };

  const removeNote = (index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBack = () => {
    setSelectedScenario(null);
    setStarted(false);
    setMessages([]);
    setGameState(null);
    setNotes([]);
    setElapsed(0);
    setStartTime(null);
  };

  const isEscaped = gameState?.escaped ?? false;

  // Idle detection — if no input for 30s, NPC prompts the player
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCountRef = useRef(0);

  useEffect(() => {
    if (!started || isLoading || isEscaped) return;

    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (isLoading || isEscaped) return;
        idleCountRef.current += 1;
        if (idleCountRef.current <= 3) {
          sendMessage(
            "[시스템: 플레이어가 30초간 아무 행동도 하지 않았다. NPC가 있다면 NPC가 먼저 말을 걸거나 반응한다. NPC가 없다면 환경적 변화를 묘사한다. 이 메시지는 플레이어에게 보이지 않는다.]"
          );
        }
      }, 30000);
    };

    resetIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [started, isLoading, isEscaped, messages.length, sendMessage]);
  const [escapeResult, setEscapeResult] = useState<EscapeResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (isEscaped && gameState && !escapeResult) {
      const result = calculateEscapeResult(gameState);
      setEscapeResult(result);
      setTimeout(() => setShowResult(true), 2000);
    }
  }, [isEscaped, gameState, escapeResult]);

  if (!selectedScenario) {
    return <ScenarioSelect onSelect={setSelectedScenario} />;
  }

  if (!started) {
    return (
      <TitleScreen
        scenario={selectedScenario}
        onStart={handleStart}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Result overlay */}
      {showResult && escapeResult && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-6 max-w-sm px-6">
            <div
              className={`text-6xl font-mono font-bold ${
                escapeResult.rank === "S"
                  ? "text-amber-400"
                  : escapeResult.rank === "A"
                  ? "text-green-400"
                  : escapeResult.rank === "B"
                  ? "text-blue-400"
                  : escapeResult.rank === "?"
                  ? "text-purple-400 animate-pulse"
                  : escapeResult.rank === "F"
                  ? "text-red-600"
                  : "text-zinc-400"
              }`}
            >
              {escapeResult.rank}
            </div>
            <div className="space-y-1">
              <h2 className="text-lg text-zinc-200">{escapeResult.title}</h2>
              <p className="text-xs text-zinc-500">{escapeResult.comment}</p>
            </div>
            <div className="space-y-2 text-xs text-zinc-600">
              <div className="flex justify-between border-b border-zinc-800 pb-1">
                <span>점수</span>
                <span className="text-zinc-300">{escapeResult.score}/100</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-1">
                <span>탈출 방식</span>
                <span className="text-zinc-300">
                  {escapeResult.method === "normal" && "정상 탈출"}
                  {escapeResult.method === "creative" && "창의적 탈출"}
                  {escapeResult.method === "brute" && "무력 탈출"}
                  {escapeResult.method === "bizarre" && "???"}
                  {escapeResult.method === "death" && "사망"}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-1">
                <span>소요 시간</span>
                <span className="text-zinc-300">{formatTime(elapsed)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-1">
                <span>행동 횟수</span>
                <span className="text-zinc-300">{gameState?.actionCount ?? 0}회</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-1">
                <span>퍼즐 해결</span>
                <span className="text-zinc-300">{gameState?.puzzlesSolved.length ?? 0}개</span>
              </div>
              <div className="flex justify-between">
                <span>단서 발견</span>
                <span className="text-zinc-300">{gameState?.discoveries.length ?? 0}개</span>
              </div>
              <div className="flex justify-between">
                <span>힌트 사용</span>
                <span className={`${(gameState?.hintCount ?? 0) <= 3 ? "text-green-400" : "text-red-400"}`}>
                  {gameState?.hintCount ?? 0}회
                  {(gameState?.hintCount ?? 0) <= 3 ? "" : " (감점)"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => setShowResult(false)}
                className="px-4 py-2 text-xs border border-zinc-800 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                대화로 돌아가기
              </button>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-xs border border-zinc-800 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                다른 시나리오
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-50 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-[#0a0a0a]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="text-xs text-zinc-700 hover:text-zinc-400 cursor-pointer"
            >
              &larr; 목록
            </button>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="w-2 h-2 rounded-full bg-red-600 pulse-red" />
            <span className="text-xs text-zinc-500 tracking-widest uppercase">
              {selectedScenario.title}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`text-xs px-2 py-1 border transition-colors cursor-pointer ${
                showNotes
                  ? "border-amber-800/50 text-amber-500/80"
                  : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
              }`}
            >
              메모장 {notes.length > 0 && `(${notes.length})`}
            </button>
            <div className="font-mono text-xs">
              {isEscaped ? (
                <span className="text-green-500">
                  탈출 완료 - {formatTime(elapsed)}
                </span>
              ) : (
                <span className="text-red-500/70">{formatTime(elapsed)}</span>
              )}
            </div>
          </div>
        </header>

        {/* Room Map */}
        <RoomMap
          scenario={selectedScenario}
          gameState={gameState}
          onExamine={(name) => {
            if (!isLoading && !isEscaped) {
              sendMessage(`${name}을(를) 조사한다`);
            }
          }}
          disabled={isLoading || isEscaped}
        />

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-5"
        >
          {messages
            .filter((m) => !(m.role === "user" && m.content.startsWith("[시스템:")))
            .map((message) => (
            <div key={message.id} className="max-w-2xl mx-auto">
              {message.role === "user" ? (
                <div className="flex items-start gap-2 py-1">
                  <span className="text-green-600/60 text-xs shrink-0 mt-0.5 font-bold">
                    {">"}
                  </span>
                  <p className="text-green-600/70 text-xs">{message.content}</p>
                </div>
              ) : (
                <div className="text-[13px] leading-7 text-zinc-300 border-l-2 border-zinc-800/40 pl-3 py-1">
                  <EffectText text={message.content} />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="max-w-2xl mx-auto">
              <span className="text-zinc-600 text-sm animate-pulse">...</span>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800/50 bg-[#0a0a0a]/95 backdrop-blur px-4 py-4 z-10">
          <form
            onSubmit={handleSubmit}
            className="max-w-2xl mx-auto flex items-center gap-2"
          >
            <span className="text-green-600/60 text-sm shrink-0">{">"}</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || isEscaped}
              placeholder={
                isEscaped
                  ? "탈출에 성공했습니다..."
                  : "행동을 입력하세요..."
              }
              className="flex-1 bg-transparent text-sm text-green-600/80 placeholder-zinc-700 outline-none caret-green-600/60"
              autoFocus
            />
            {isLoading && (
              <span className="text-zinc-700 text-xs animate-pulse">
                처리중...
              </span>
            )}
          </form>
        </div>
      </div>

      <aside className="w-64 border-l border-zinc-800/50 bg-[#0a0a0a] flex flex-col z-10 shrink-0">
        <div className="p-3 border-b border-zinc-800/50">
          <h3 className="text-[10px] tracking-widest text-zinc-600 uppercase mb-2">
            인벤토리
          </h3>
          {gameState && gameState.inventory.length > 0 ? (
            <div className="space-y-1">
              {gameState.inventory.map((item, i) => (
                <div
                  key={i}
                  className="text-xs text-amber-500/80 flex items-center gap-1.5"
                >
                  <span className="text-amber-700">&#9670;</span> {item}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-700">비어있음</p>
          )}
        </div>

        <div className="p-3 border-b border-zinc-800/50">
          <h3 className="text-[10px] tracking-widest text-zinc-600 uppercase mb-2">
            발견한 단서
          </h3>
          {gameState && gameState.discoveries.length > 0 ? (
            <div className="space-y-1">
              {gameState.discoveries.map((clue, i) => (
                <div
                  key={i}
                  className="text-xs text-cyan-500/70 flex items-start gap-1.5"
                >
                  <span className="text-cyan-800 shrink-0">&#9679;</span>
                  <span>{clue}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-700">아직 없음</p>
          )}
        </div>

        <div className="p-3 border-b border-zinc-800/50">
          <h3 className="text-[10px] tracking-widest text-zinc-600 uppercase mb-2">
            해결한 퍼즐
          </h3>
          {gameState && gameState.puzzlesSolved.length > 0 ? (
            <div className="space-y-1">
              {gameState.puzzlesSolved.map((puzzle, i) => (
                <div
                  key={i}
                  className="text-xs text-green-500/70 flex items-center gap-1.5"
                >
                  <span className="text-green-800">&#10003;</span> {puzzle}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-700">아직 없음</p>
          )}
        </div>

        {/* Hint + Progress */}
        <div className="p-3 border-b border-zinc-800/50 space-y-2">
          <button
            onClick={() => {
              if (!isLoading && !isEscaped) sendMessage("힌트를 줘");
            }}
            disabled={isLoading || isEscaped}
            className="w-full text-xs py-1.5 border border-zinc-800 text-zinc-500 hover:text-amber-500/80 hover:border-amber-900/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            힌트 요청
            {gameState && gameState.hintCount > 0 && (
              <span
                className={`ml-1 ${
                  gameState.hintCount <= 3
                    ? "text-green-600/60"
                    : "text-red-500/60"
                }`}
              >
                ({gameState.hintCount}/3)
              </span>
            )}
          </button>
          <div className="text-[10px] text-zinc-700 space-y-0.5">
            <div className="flex justify-between">
              <span>진행도</span>
              <span className="text-zinc-500">
                {gameState
                  ? `${gameState.puzzlesSolved.length}개 퍼즐 / ${gameState.discoveries.length}개 단서`
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>행동</span>
              <span className="text-zinc-500">
                {gameState?.actionCount ?? 0}회
              </span>
            </div>
          </div>
        </div>

        {showNotes && (
          <div className="p-3 flex-1 flex flex-col min-h-0">
            <h3 className="text-[10px] tracking-widest text-zinc-600 uppercase mb-2">
              메모장
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1 mb-2">
              {notes.map((note, i) => (
                <div
                  key={i}
                  className="text-xs text-zinc-400 flex items-start gap-1 group"
                >
                  <span className="text-zinc-700">-</span>
                  <span className="flex-1">{note}</span>
                  <button
                    onClick={() => removeNote(i)}
                    className="text-zinc-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    x
                  </button>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-zinc-800">메모를 적어두세요...</p>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addNote();
              }}
              className="flex gap-1"
            >
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="메모 입력..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-700 outline-none focus:border-zinc-600"
              />
              <button
                type="submit"
                className="text-xs px-2 py-1 border border-zinc-800 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                +
              </button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}

function ScenarioSelect({
  onSelect,
}: {
  onSelect: (s: Scenario) => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] px-4">
      <div
        className={`w-full max-w-xl transition-all duration-700 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="text-center mb-12">
          <h1 className="text-2xl font-mono tracking-[0.3em] text-red-600/80 pulse-red mb-3">
            탈출
          </h1>
          <div className="w-12 h-px bg-zinc-800 mx-auto mb-3" />
          <p className="text-xs text-zinc-600">시나리오를 선택하세요</p>
        </div>

        <div className="space-y-3">
          {scenarios.map((scenario, i) => (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario)}
              className="w-full text-left p-4 border border-zinc-800/50 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all duration-300 group cursor-pointer"
              style={{
                transitionDelay: `${i * 100}ms`,
                opacity: show ? 1 : 0,
                transform: show ? "translateX(0)" : "translateX(-10px)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg text-zinc-600 group-hover:text-zinc-400 transition-colors mt-0.5">
                  {moodLabels[scenario.atmosphere] || "\u25CF"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
                      {scenario.title}
                    </h2>
                    <span className="text-[10px] px-1.5 py-0.5 border border-zinc-800 text-zinc-600 uppercase">
                      {scenario.atmosphere}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-zinc-700">
                    <span>
                      난이도{" "}
                      <span className="text-zinc-500">
                        {"\u25A0".repeat(scenario.ratings.difficulty)}
                        {"\u25A1".repeat(5 - scenario.ratings.difficulty)}
                      </span>
                    </span>
                    <span>
                      문제{" "}
                      <span className="text-zinc-500">
                        {"\u25A0".repeat(scenario.ratings.puzzleCount)}
                        {"\u25A1".repeat(5 - scenario.ratings.puzzleCount)}
                      </span>
                    </span>
                    <span>
                      공포{" "}
                      <span className={scenario.ratings.horror >= 4 ? "text-red-600/60" : "text-zinc-500"}>
                        {"\u25A0".repeat(scenario.ratings.horror)}
                        {"\u25A1".repeat(5 - scenario.ratings.horror)}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 group-hover:text-zinc-500 transition-colors">
                    {scenario.subtitle}
                  </p>
                </div>
                <span className="text-zinc-800 group-hover:text-zinc-500 transition-colors text-sm">
                  &rarr;
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TitleScreen({
  scenario,
  onStart,
  onBack,
}: {
  scenario: Scenario;
  onStart: () => void;
  onBack: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)",
          }}
        />
      </div>

      <div
        className={`flex flex-col items-center gap-8 transition-all duration-1000 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-mono tracking-[0.3em] text-red-600/80 pulse-red">
            {scenario.title}
          </h1>
          <div className="w-16 h-px bg-zinc-800 mx-auto" />
          <p className="text-xs tracking-[0.2em] text-zinc-600">
            {scenario.subtitle}
          </p>
        </div>

        <div className="max-w-sm text-center space-y-2 px-6">
          {scenario.titleDescription.map((line, i) => (
            <p key={i} className="text-xs leading-6 text-zinc-500">
              {line}
            </p>
          ))}
          <p className="text-xs text-zinc-700 pt-2">나가야 한다.</p>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 text-xs tracking-widest text-zinc-600 border border-zinc-800 hover:text-zinc-400 transition-all duration-500 uppercase cursor-pointer"
          >
            &larr; 돌아가기
          </button>
          <button
            onClick={onStart}
            className="px-8 py-3 text-xs tracking-widest text-zinc-400 border border-zinc-800 hover:border-red-900/50 hover:text-red-500/80 transition-all duration-500 uppercase cursor-pointer"
          >
            시작하기
          </button>
        </div>

        <div className="mt-8 text-center space-y-1">
          <p className="text-[10px] text-zinc-700">행동을 직접 입력하세요</p>
          <p className="text-[10px] text-zinc-800">
            자유롭게 탐색하고 상호작용하세요
          </p>
        </div>
      </div>
    </div>
  );
}
