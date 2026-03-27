# AI Escape Room - 폐병원 수술실

AI 기반 텍스트 어드벤처 공포 방탈출 게임. 1987년 폐업한 병원의 수술실에서 탈출하세요.

## Features

- **LangGraph** 기반 게임 엔진 — 상태 관리 (인벤토리, 단서, 퍼즐)
- **Gemini 2.5 Flash** — AI 게임 마스터가 자연어를 이해하고 반응
- **Tool Calling** — AI가 도구를 호출해 게임 상태를 자동 업데이트
- **Langfuse** 연동 — LLM 호출/도구 사용 트레이싱
- 다크 터미널 스타일 UI + 스캔라인 효과
- 사이드바: 인벤토리, 발견한 단서, 해결한 퍼즐, 메모장
- 타이머로 탈출 시간 측정

## Tech Stack

- Next.js 16 (App Router)
- LangGraph + LangChain
- Google Gemini 2.5 Flash
- Langfuse (observability)
- Tailwind CSS

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.sample .env.local
```

`.env.local`을 열고 API 키를 입력하세요:

- **Google AI API Key** (필수): https://aistudio.google.com/apikey 에서 발급
- **Langfuse** (선택): https://langfuse.com 또는 셀프호스팅

### 3. Run dev server

```bash
npm run dev
```

http://localhost:3000 에서 게임을 시작하세요.

## How to Play

텍스트를 자유롭게 입력해서 방을 탈출하세요.

```
> 주위를 둘러본다
> 수술대를 조사한다
> 수도꼭지를 틀어본다
> 열쇠로 캐비닛을 연다
```

창의적인 행동도 가능합니다:

```
> 메스로 유리를 깨본다
> 수술대 위에 올라가서 천장을 확인한다
> 소리를 질러본다
```

## Architecture

```
src/
├── app/
│   ├── api/chat/route.ts   ← API 엔드포인트
│   ├── page.tsx             ← 게임 UI (타이틀 + 채팅 + 사이드바)
│   ├── layout.tsx           ← 다크 모노스페이스 레이아웃
│   └── globals.css          ← 공포 분위기 애니메이션
└── lib/
    ├── game-graph.ts        ← LangGraph 게임 엔진 (상태 그래프 + 도구)
    └── game-state.ts        ← 게임 상태 타입 정의
```

### LangGraph Flow

```
[User Input] → [Agent Node: LLM + System Prompt + Game State]
                    ↓
              Tool Calls? ──Yes──→ [Tool Node: pickup/discover/solve/use/escape]
                    │                        ↓
                    No               [Update Game State]
                    ↓                        ↓
                 [Response]          [Back to Agent Node]
```
