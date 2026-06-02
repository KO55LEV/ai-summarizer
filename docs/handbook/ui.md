# UI

React frontend located in `ui/`. Serves as the user-facing interface for the AiSummarizer backend.

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19.1 + TypeScript 5.8 |
| Build tool | Vite 6.3 |
| Styling | Tailwind CSS v4.1 (`@tailwindcss/vite` plugin) |
| Icons | Lucide React + custom SVG system (`components/icons.tsx`) |
| Dev server | `http://localhost:5173` — proxies `/api` → `http://localhost:5000` |

## Running

```bash
cd ui
npm run dev
```

If the corporate Artifactory registry blocks installation:

```bash
npm install --registry https://registry.npmjs.org
```

## Source layout

```
ui/src/
  App.tsx                     ← root component, routing, global state
  types.ts                    ← NavItem, VideoRecord, API response types
  index.css                   ← Tailwind theme (@theme directive, CSS variables)
  api/                        ← typed async API functions
  mocks/
    api/                      ← mock implementations (250 ms fake delay)
    data/                     ← static JSON mock data files
  components/
    LeftSidebar.tsx
    MainContent.tsx            ← Summarizer home screen
    AnalyzingView.tsx          ← Summarizer processing screen
    TranscriptView.tsx         ← Summarizer completed/transcript screen
    RightSidebar.tsx           ← right panel shown on Summarizer home
    ProcessingRightSidebar.tsx ← right panel shown during processing
    TranscriptRightSidebar.tsx ← right panel shown on completed transcript
    AudioWaveform.tsx          ← animated waveform bar component
    icons.tsx                  ← custom 24×24 stroke-based SVG icon set
    pages/
      DashboardPage.tsx
      InsightsPage.tsx
      ExportsPage.tsx
      HistoryPage.tsx
      ResearchPage.tsx         ← research topic list and filters
      ResearchCreatePage.tsx   ← research topic create studio
      ResearchBriefingPage.tsx  ← briefing viewer and history
      SettingsPage.tsx
      ProfilePage.tsx
  hooks/
    useProcessingSimulation.ts ← fake processing state machine (~25 s)
  types/
    pipeline.ts                ← PipelineStep, LogEntry, ProcessingState
```

## Navigation

`NavItem` type controls the active page:

```
'dashboard' | 'summarizer' | 'transcript' | 'insights' | 'exports' | 'history' | 'settings' | 'profile'
```

`App.tsx` holds `activeNav` state and routes it to the correct center panel via `renderCenter()` and right panel via `renderRight()`.

### Summarizer page — three sub-states

The Summarizer route has three internal states controlled by `useProcessingSimulation`:

| State | Center component | Right component |
|---|---|---|
| Home (idle) | `MainContent` | `RightSidebar` |
| Analyzing (in-progress) | `AnalyzingView` | `ProcessingRightSidebar` |
| Complete | `TranscriptView` | `TranscriptRightSidebar` |

### Transcript page — selected video

When a user clicks a video in the sidebar or History page, `App.tsx` sets `selectedVideo: VideoRecord` and navigates to `'transcript'`. `buildCompletedState()` converts a `VideoRecord` into a fully-populated `ProcessingState` with all steps marked complete, and renders `TranscriptView` without going through the simulation.

## Layout structure

Every page uses a three-column layout:

```
┌──────────────┬───────────────────────────┬──────────────────┐
│ LeftSidebar  │  Center (renderCenter)     │  Right sidebar   │
│  230 px      │  flex-1, scrollable        │  (optional)      │
└──────────────┴───────────────────────────┴──────────────────┘
```

Right sidebar is `null` on all nav pages except Summarizer and Transcript.

## LeftSidebar

Props:

| Prop | Type | Purpose |
|---|---|---|
| `activeNav` | `NavItem` | highlights current nav item |
| `onNavChange` | `(nav: NavItem) => void` | navigate to a page |
| `onViewAll` | `() => void` | "View all" button → History page |
| `onVideoSelect` | `(idx: number) => void` | recent video click → TranscriptView |
| `recentVideos` | `VideoRecord[]` | list loaded from API |

The sidebar also shows a user card (avatar, name, plan badge, monthly usage bar) with a click handler to the Profile page.
Recent items are normalized from `/api/transcripts/history` into `VideoRecord` so the sidebar and transcript page use the same source of truth.

## Mock API layer

The app runs entirely against mock data when `VITE_USE_MOCK_API=true` (set in `ui/.env`).

### Flow

```
Component
  └─ calls api/history.ts → getHistory()
       ├─ VITE_USE_MOCK_API=true  → mocks/api/history.ts → mocks/data/history.json
       └─ VITE_USE_MOCK_API=false → fetch('/api/transcripts/history')
```

### API functions

| File | Function | Returns |
|---|---|---|
| `api/dashboard.ts` | `getDashboardData()` | `DashboardData` |
| `api/history.ts` | `getHistory()` | `HistoryItem[]` |
| `api/insights.ts` | `getInsightsData()` | `InsightsData` |
| `api/exports.ts` | `getExports()` | `ExportRecord[]` |
| `api/profile.ts` | `getProfileData()` | `ProfileData` |
| `api/recentVideos.ts` | `getRecentVideos()` | `VideoRecord[]` |

All types are defined in `api/types.ts`.

### Switching to real API

1. Set `VITE_USE_MOCK_API=false` in `ui/.env`
2. Implement the corresponding REST endpoints in the backend (`/api/dashboard`, `/api/transcripts/history`, etc.)
3. No changes are needed in page components or the API function files

### Mock data files

| File | Used by |
|---|---|
| `mocks/data/dashboard.json` | `DashboardPage` |
| `mocks/data/history.json` | `HistoryPage` |
| `mocks/data/insights.json` | `InsightsPage` |
| `mocks/data/exports.json` | `ExportsPage` |
| `mocks/data/profile.json` | `ProfilePage` |
| `mocks/data/recentVideos.json` | `LeftSidebar` (via `App.tsx`) |

## Pages

### DashboardPage

Stats grid (4 cards), recent videos list, usage breakdown panel, quick actions. All data from `getDashboardData()`.

### InsightsPage

Six insight-type cards with counts and colors (Quick Summary, Chapters, Key Takeaways, Key Quotes, Q&A, Study Guides). Recent insights list with chip-style buttons per video. Data from `getInsightsData()`.

### ExportsPage

Four format cards (TXT / JSON / PDF / SRT). Export history table with hover-reveal download button. Data from `getExports()`.

### HistoryPage

Search + status filter toolbar. Columnar table with thumbnails, source badges, lifecycle status, date, and hover actions. Clicking a completed row calls `onVideoOpen(VideoRecord)` which navigates to `TranscriptView`. Data from `getHistory()`.

Props: `onVideoOpen?: (v: VideoRecord) => void`

### Research pages

The Research flow is split into three views:

- `ResearchPage` for list/filter/status overview
- `ResearchCreatePage` for topic setup and output selection
- `ResearchBriefingPage` for generated briefing history and source review

The frontend keeps the display model separate from the API contract:

- backend returns raw topic/briefing records
- `api/research.ts` maps them into dashboard-friendly strings and cards
- create actions always attach `requestedByUserId` from the demo/current user id

### SettingsPage

Left-nav sub-sections: Account, Notifications, Language & region, Privacy & data, Billing & plan, Keyboard shortcuts. Interactive toggles (controlled `useState`). No external data — fully static UI.

### ProfilePage

Avatar with initials, stats row (4 cards), subscription card with usage bar, language breakdown bars, recent activity list, quick settings links. Data from `getProfileData()`.

Props: `onNavChange: (nav: NavItem) => void`

## Processing simulation

`useProcessingSimulation` in `hooks/useProcessingSimulation.ts` drives the fake pipeline used when a URL is submitted through the Summarizer page.

- 7 steps, ~25 s total
- Returns: `{ isAnalyzing, state: ProcessingState, startAnalysis(url), cancelAnalysis }`
- `ProcessingState.isComplete` flips to `true` after the final step
- Uses a hardcoded fake video (`FAKE_VIDEO`) — title, channel, thumbnail, duration, language

## Design tokens

Defined as CSS custom properties in `ui/src/index.css` under `@theme`:

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#0c1221` | page background |
| `bg-card` | `#131c30` | card/panel background |
| `bg-card-hover` | `#182440` | card hover state |
| `bg-input` | `#182440` | input and pill background |
| `border` | `#1e2d4a` | all borders |
| `accent` | `#00d4aa` | primary action color |
| `accent-hover` | `#00eabc` | accent hover |
| `text-primary` | `#f1f5f9` | primary text |
| `text-secondary` | `#94a3b8` | secondary text |
| `text-muted` | `#5a6b83` | muted/placeholder text |
| `danger` | `#ef4444` | destructive actions |
| `youtube` | `#ff0000` | YouTube logo tint |
| `pro-badge` | `#f59e0b` | PRO plan badge |

## Icons

`components/icons.tsx` exports custom 24×24 stroke-based SVG icons used in `MainContent` and `AnalyzingView`:

- `CloudFetchIcon`, `TranscriptWaveformIcon`, `InsightSparkleIcon`
- `YouTubeLogoIcon`, `CaptionBarsIcon`, `WaveformBarsIcon`
- `SummarySparklesIcon`, `CloudDownloadIcon`

All other icons use Lucide React.
