import { useEffect, useRef, useState } from 'react';
import LeftSidebar from './components/LeftSidebar';
import MainContent from './components/MainContent';
import RightSidebar from './components/RightSidebar';
import AnalyzingView from './components/AnalyzingView';
import ProcessingRightSidebar from './components/ProcessingRightSidebar';
import TranscriptView from './components/TranscriptView';
import BackendTranscriptView from './components/BackendTranscriptView';
import TranscriptRightSidebar from './components/TranscriptRightSidebar';
import DashboardPage from './components/pages/DashboardPage';
import InsightsPage from './components/pages/InsightsPage';
import ExportsPage from './components/pages/ExportsPage';
import HistoryPage from './components/pages/HistoryPage';
import SettingsPage from './components/pages/SettingsPage';
import ProfilePage from './components/pages/ProfilePage';
import ProjectsPage from './components/pages/ProjectsPage';
import ProjectViewPage, { type ProjectTab } from './components/pages/ProjectViewPage';
import TodoPage from './components/pages/TodoPage';
import NotesPage from './components/pages/NotesPage';
import { ResearchPage } from './components/pages/ResearchPage';
import { ResearchBriefingPage } from './components/pages/ResearchBriefingPage';
import { ResearchCreatePage } from './components/pages/ResearchCreatePage';
import AdminPage from './components/pages/AdminPage';
import LandingPage from './components/pages/LandingPage';
import LoginPage from './components/pages/LoginPage';
import { getCurrentUser, loginWithPassword, logoutUser, registerUser } from './api/auth';
import { getAdminRoles } from './api/adminUsers';
import { getBillingBalance } from './api/adminBilling';
import { analyzeVideo, createTranscriptInsight, getTranscriptBySource, getWorkflowStatus } from './api';
import { getResearchTopic } from './api/research';
import { getYouTubePreview } from './api/youtube';
import { getCurrentUserId } from './config/currentUser';
import { clearAuthenticated, getStoredAuthState, isAuthenticated, setStoredAuthState } from './config/auth';
import type { NavItem, VideoMetadata, VideoRecord, WorkflowResponse, TranscriptInsightActionKey, TranscriptResponse } from './types';
import type { BillingBalanceResponse } from './api/adminBilling';
import type { LogEntry, ProcessingState, PipelineStep } from './types/pipeline';
import type { ResearchTopic, HistoryItem } from './api/types';

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatElapsedSince(iso: string | null | undefined): string {
  if (!iso) {
    return '00:00';
  }

  const startedAt = new Date(iso);
  if (Number.isNaN(startedAt.getTime())) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function fallbackThumbnail(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
    }

    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
    }
  } catch {
    // fallback below
  }

  return 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
}

function buildFallbackVideoMeta(url: string): VideoMetadata {
  return {
    title: 'YouTube video',
    channel: 'YouTube',
    views: '—',
    age: '—',
    duration: '—',
    language: '—',
    quality: '—',
    thumbnail: fallbackThumbnail(url),
  };
}

function buildAnalyzingVideoMeta(url: string, preview: Awaited<ReturnType<typeof getYouTubePreview>>): VideoMetadata {
  const base = buildFallbackVideoMeta(url);
  return {
    ...base,
    title: preview?.title ?? base.title,
    channel: preview?.channel ?? base.channel,
    thumbnail: preview?.thumbnail ?? base.thumbnail,
  };
}

function buildTranscriptVideoMeta(
  item: HistoryItem,
  transcript: TranscriptResponse,
  preview: Awaited<ReturnType<typeof getYouTubePreview>> | null,
): VideoMetadata {
  const base = buildFallbackVideoMeta(item.sourceUrl ?? item.url ?? '');
  return {
    ...base,
    title: preview?.title ?? item.title ?? base.title,
    channel: preview?.channel ?? item.channel ?? base.channel,
    thumbnail: preview?.thumbnail ?? item.thumbnail ?? base.thumbnail,
    duration: formatDuration(transcript.durationSeconds),
    language: transcript.language.toUpperCase(),
    age: item.date,
    quality: transcript.sourceFilePath ? 'Whisper transcript' : 'YouTube subtitles',
  };
}

function buildTranscriptVideoMetaFromTranscript(
  transcript: TranscriptResponse,
  preview: Awaited<ReturnType<typeof getYouTubePreview>> | null,
  hints?: { sourceUrl?: string | null; title?: string | null; channel?: string | null },
): VideoMetadata {
  const base = buildFallbackVideoMeta(hints?.sourceUrl ?? transcript.sourceUrl ?? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  return {
    ...base,
    title: preview?.title ?? hints?.title ?? base.title,
    channel: preview?.channel ?? hints?.channel ?? base.channel,
    thumbnail: preview?.thumbnail ?? base.thumbnail,
    duration: formatDuration(transcript.durationSeconds),
    language: transcript.language.toUpperCase(),
    quality: transcript.sourceFilePath ? 'Whisper transcript' : 'YouTube subtitles',
  };
}

function buildProcessingState(
  videoMeta: VideoMetadata,
  workflow: WorkflowResponse | null,
  transcriptSource: string,
): ProcessingState {
  const stepKeys = [
    'fetch',
    'captions',
    'no-transcript',
    'extract-audio',
    'whisper',
    'language',
    'insights',
  ] as const;

  const workflowStepIndex = (() => {
    if (!workflow) return -1;
    if (workflow.status === 'succeeded') return 6;

    switch (workflow.currentStepKey) {
      case 'native_transcript_check':
        return 1;
      case 'download_video':
      case 'extract_audio':
        return 3;
      case 'transcribe_audio':
        return 4;
      case 'import_transcript':
        return 5;
      default:
        return workflow.status === 'queued' ? 0 : 1;
    }
  })();

  const manualFallback = transcriptSource.toLowerCase().includes('whisper');
  const stepTimes = ['00:02', '00:05', '00:07', '00:11', '00:18', '00:21', '00:25'];
  const workflowStart = workflow?.startedAt ?? workflow?.createdAt ?? null;
  const currentStepTime = formatElapsedSince(workflowStart);

  const steps: PipelineStep[] = stepKeys.map((key, index) => {
    if (!workflow) {
      return {
        key,
        label: ['Video fetched', 'Checking captions', 'No YouTube transcript found', 'Extracting audio', 'Whisper transcribing', 'Detecting language', 'Generating insights'][index],
        status: index === 0 ? 'running' : 'pending',
        time: index === 0 ? 'just now' : undefined,
        detail: index === 2 ? 'Falling back to Whisper' : undefined,
      };
    }

    if (workflow.status === 'succeeded') {
      return {
        key,
        label: ['Video fetched', 'Checking captions', 'No YouTube transcript found', 'Extracting audio', 'Whisper transcribing', 'Detecting language', 'Generating insights'][index],
        status: key === 'no-transcript' && !manualFallback ? 'completed' : 'completed',
        time: stepTimes[index],
      };
    }

    if (index === 0) {
      return {
        key,
        label: 'Video fetched',
        status: 'completed',
        time: stepTimes[index],
      };
    }

    if (index === 1) {
      return {
        key,
        label: 'Checking captions',
        status: workflowStepIndex === 1 ? 'running' : 'completed',
        time: workflowStepIndex === 1 ? currentStepTime : stepTimes[index],
      };
    }

    if (index === 2) {
      return {
        key,
        label: 'No YouTube transcript found',
        status: manualFallback ? 'warning' : workflowStepIndex > 2 ? 'completed' : 'pending',
        time: manualFallback ? stepTimes[index] : undefined,
        detail: manualFallback ? 'Falling back to Whisper' : undefined,
      };
    }

    if (index === 3) {
      return {
        key,
        label: 'Extracting audio',
        status: workflow.currentStepKey === 'download_video' || workflow.currentStepKey === 'extract_audio'
          ? 'running'
          : workflowStepIndex > 3 || manualFallback ? 'completed' : 'pending',
        time: workflow.currentStepKey === 'download_video' || workflow.currentStepKey === 'extract_audio'
          ? currentStepTime
          : undefined,
      };
    }

    if (index === 4) {
      return {
        key,
        label: 'Whisper transcribing',
        status: workflow.currentStepKey === 'transcribe_audio'
          ? 'running'
          : workflowStepIndex > 4 || manualFallback ? 'completed' : 'pending',
        time: workflow.currentStepKey === 'transcribe_audio'
          ? currentStepTime
          : undefined,
      };
    }

    if (index === 5) {
      return {
        key,
        label: 'Detecting language',
        status: workflow.currentStepKey === 'import_transcript' ? 'running' : workflowStepIndex > 5 ? 'completed' : 'pending',
        time: workflow.currentStepKey === 'import_transcript' ? currentStepTime : undefined,
      };
    }

    return {
      key,
      label: 'Generating insights',
      status: workflowStepIndex >= 6 ? 'completed' : 'pending',
      time: workflowStepIndex >= 6 ? stepTimes[index] : undefined,
    };
  });

  const logs: LogEntry[] = workflow
    ? [
        {
          time: 'now',
          message: workflow.progressMessage ?? (workflow.status === 'succeeded' ? 'Transcript ready' : 'Processing...'),
          status: workflow.status === 'failed' || workflow.status === 'dead'
            ? 'error'
            : workflow.status === 'queued'
              ? 'info'
              : 'running',
        },
      ]
    : [
        {
          time: 'now',
          message: 'Preparing transcript workflow',
          status: 'running',
        },
      ];

  const workflowInput = workflow?.input as Record<string, unknown> | undefined;
  const languageValue = workflowInput && typeof workflowInput.language === 'string'
    ? workflowInput.language
    : null;

  return {
    steps,
    logs,
    currentStepIndex: Math.max(0, workflowStepIndex),
    isComplete: workflow?.status === 'succeeded',
    videoMeta,
    processingMeta: {
      transcriptSource,
      languageStatus: languageValue
        ? `${languageValue} (${languageValue.toLowerCase()})`
        : 'Pending',
      estimatedTime: workflow?.status === 'succeeded' ? '00:00' : '~ 03:00',
      jobId: workflow?.id ?? 'PENDING',
      model: manualFallback ? 'Whisper Large-v3 (OpenAI)' : 'YouTube captions',
      mode: manualFallback ? 'Fallback transcription' : 'Native captions',
      audioSource: manualFallback ? 'YouTube audio stream' : 'N/A',
      files: workflow?.status === 'succeeded' ? 'Auto-deleted' : 'Temporary • Auto-deleted',
    },
  };
}

function buildCompletedState(video: VideoRecord): ProcessingState {
  const steps: PipelineStep[] = [
    { key: 'fetch', label: 'Video fetched', status: 'completed', time: '00:02' },
    { key: 'captions', label: 'Checking captions', status: 'completed', time: '00:05' },
    { key: 'no-transcript', label: 'No YouTube transcript found', status: video.source === 'Whisper' ? 'warning' : 'completed', time: '00:07', detail: video.source === 'Whisper' ? 'Falling back to Whisper' : undefined },
    { key: 'extract-audio', label: 'Extracting audio', status: 'completed', time: '00:10' },
    { key: 'whisper', label: 'Whisper transcribing', status: 'completed', time: '00:18' },
    { key: 'language', label: 'Detecting language', status: 'completed', time: '00:21' },
    { key: 'insights', label: 'Generating insights', status: 'completed', time: '00:25' },
  ];
  return {
    steps,
    logs: [],
    currentStepIndex: 6,
    isComplete: true,
    videoMeta: {
      title: video.title,
      channel: video.channel,
      views: video.views,
      age: video.age,
      duration: video.duration,
      language: video.language,
      quality: video.quality,
      thumbnail: video.thumbnail,
    },
    processingMeta: {
      transcriptSource: video.source,
      languageStatus: `${video.language} (${video.language.toLowerCase()})`,
      estimatedTime: '00:00',
      jobId: `JOB_${video.title.replace(/\W/g, '').slice(0, 12).toUpperCase()}`,
      model: video.source === 'Whisper' ? 'Whisper Large-v3 (OpenAI)' : 'YouTube captions',
      mode: video.source === 'Whisper' ? 'Fallback transcription' : 'Native captions',
      audioSource: video.source === 'Whisper' ? 'YouTube audio stream' : 'N/A',
      files: 'Auto-deleted',
    },
  };
}

type AppLocation =
  | { kind: 'landing' }
  | { kind: 'auth'; mode: 'login' | 'signup' }
  | { kind: 'admin'; section: 'users' | 'billing' | 'prompts' | 'search-providers' | 'runtime-settings' | 'email-templates' | 'billing-rules' | 'workflow-costs' }
  | {
      kind: 'app';
      nav: NavItem;
      summarizerView: 'history' | 'new';
      researchView: 'list' | 'briefing' | 'create' | 'edit';
      researchTopicId: string | null;
      researchBriefingId: string | null;
      projectId: string | null;
      projectName: string | null;
      projectTab: ProjectTab | null;
      transcriptSourceId: string | null;
      transcriptSourceUrl: string | null;
      transcriptTitle: string | null;
      transcriptChannel: string | null;
    };

const NAV_PATHS: Record<NavItem, string> = {
  dashboard: '/dashboard',
  summarizer: '/summarizer',
  transcript: '/transcript',
  insights: '/insights',
  exports: '/exports',
  history: '/history',
  research: '/research',
  projects: '/projects',
  todo: '/todo',
  notes: '/notes',
  settings: '/settings',
  profile: '/profile',
};

function isNavItem(value: string): value is NavItem {
  return value in NAV_PATHS;
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function getLocationFromPathname(pathname: string, search = ''): AppLocation {
  const path = normalizePathname(pathname);
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const projectId = params.get('projectId');
  const projectName = params.get('projectName');
  const projectTabParam = params.get('tab');
  const transcriptSourceId = params.get('sourceId');
  const transcriptSourceUrl = params.get('sourceUrl');
  const transcriptTitle = params.get('title');
  const transcriptChannel = params.get('channel');
  const projectTab: ProjectTab | null =
    projectTabParam === 'overview' ||
    projectTabParam === 'notes' ||
    projectTabParam === 'research' ||
    projectTabParam === 'videos' ||
    projectTabParam === 'tasks'
      ? projectTabParam
      : null;

  if (path === '/login' || path === '/signup') {
    return { kind: 'auth', mode: path === '/signup' ? 'signup' : 'login' };
  }

  if (path === '/admin') {
    return { kind: 'admin', section: 'users' };
  }

  if (path.startsWith('/admin/')) {
    const section = path.split('/')[2];
    if (section === 'prompts' || section === 'search-providers' || section === 'runtime-settings' || section === 'users' || section === 'billing' || section === 'email-templates' || section === 'billing-rules' || section === 'workflow-costs') {
      return { kind: 'admin', section };
    }

    return { kind: 'admin', section: 'users' };
  }

  if (path === '/') {
    return { kind: 'landing' };
  }

  if (path === '/summarizer') {
    return { kind: 'app', nav: 'summarizer', summarizerView: 'history', researchView: 'list', researchTopicId: null, researchBriefingId: null, projectId: null, projectName: null, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
  }

  if (path === '/summarizer/new') {
    return { kind: 'app', nav: 'summarizer', summarizerView: 'new', researchView: 'list', researchTopicId: null, researchBriefingId: null, projectId, projectName, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { kind: 'app', nav: 'summarizer', summarizerView: 'history', researchView: 'list', researchTopicId: null, researchBriefingId: null, projectId: null, projectName: null, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
  }

  const [first, second] = segments;
  if (!isNavItem(first)) {
    return { kind: 'app', nav: 'summarizer', summarizerView: 'history', researchView: 'list', researchTopicId: null, researchBriefingId: null, projectId: null, projectName: null, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
  }

  if (first === 'research') {
    if (second === 'create') {
      return { kind: 'app', nav: 'research', summarizerView: 'history', researchView: 'create', researchTopicId: null, researchBriefingId: null, projectId: null, projectName: null, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
    }

    if (second) {
      if (segments[2] === 'edit') {
        return {
          kind: 'app',
          nav: 'research',
          summarizerView: 'history',
          researchView: 'edit',
          researchTopicId: decodeURIComponent(second),
          researchBriefingId: null,
          projectId: null,
          projectName: null,
          projectTab: null,
          transcriptSourceId: null,
          transcriptSourceUrl: null,
          transcriptTitle: null,
          transcriptChannel: null,
        };
      }

      return {
        kind: 'app',
        nav: 'research',
        summarizerView: 'history',
        researchView: 'briefing',
        researchTopicId: decodeURIComponent(second),
        researchBriefingId: segments[2] === 'briefings' && segments[3] ? decodeURIComponent(segments[3]) : null,
        projectId: null,
        projectName: null,
        projectTab: null,
        transcriptSourceId: null,
        transcriptSourceUrl: null,
        transcriptTitle: null,
        transcriptChannel: null,
      };
    }

    return { kind: 'app', nav: 'research', summarizerView: 'history', researchView: 'list', researchTopicId: null, researchBriefingId: null, projectId: null, projectName: null, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
  }

  if (first === 'projects') {
    return {
      kind: 'app',
      nav: 'projects',
      summarizerView: 'history',
      researchView: 'list',
      researchTopicId: null,
      researchBriefingId: null,
      projectId: second ? decodeURIComponent(second) : null,
      projectName: null,
      projectTab,
      transcriptSourceId: null,
      transcriptSourceUrl: null,
      transcriptTitle: null,
      transcriptChannel: null,
    };
  }

  if (first === 'transcript') {
    return {
      kind: 'app',
      nav: 'transcript',
      summarizerView: 'history',
      researchView: 'list',
      researchTopicId: null,
      researchBriefingId: null,
      projectId: null,
      projectName: null,
      projectTab: null,
      transcriptSourceId: transcriptSourceId?.trim() || null,
      transcriptSourceUrl: transcriptSourceUrl?.trim() || null,
      transcriptTitle: transcriptTitle?.trim() || null,
      transcriptChannel: transcriptChannel?.trim() || null,
    };
  }

  return { kind: 'app', nav: first, summarizerView: first === 'summarizer' && second === 'new' ? 'new' : 'history', researchView: 'list', researchTopicId: null, researchBriefingId: null, projectId: null, projectName: null, projectTab: null, transcriptSourceId: null, transcriptSourceUrl: null, transcriptTitle: null, transcriptChannel: null };
}

function getPathForNav(nav: NavItem): string {
  return NAV_PATHS[nav];
}

export default function App() {
  const [location, setLocation] = useState<AppLocation>(() => getLocationFromPathname(window.location.pathname, window.location.search));
  const [authState, setAuthState] = useState(() => getStoredAuthState());
  const [authenticated, setAuthenticated] = useState<boolean>(() => isAuthenticated());
  const [authHydrating, setAuthHydrating] = useState<boolean>(() => Boolean(getStoredAuthState() && isAuthenticated()));
  const urlRef = useRef('');
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [selectedHistoryTranscript, setSelectedHistoryTranscript] = useState<{
    url: string;
    transcript: TranscriptResponse;
    videoMeta: VideoMetadata;
  } | null>(null);
  const [selectedTranscriptSource, setSelectedTranscriptSource] = useState<{
    url: string;
    transcript: TranscriptResponse;
    videoMeta: VideoMetadata;
  } | null>(null);
  const [selectedTranscriptSourceLoading, setSelectedTranscriptSourceLoading] = useState(false);
  const [selectedResearchTopic, setSelectedResearchTopic] = useState<ResearchTopic | null>(null);
  const [researchTopicLoading, setResearchTopicLoading] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'starting' | 'analyzing' | 'ready' | 'error'>('idle');
  const [analysisUrl, setAnalysisUrl] = useState('');
  const [analysisWorkflow, setAnalysisWorkflow] = useState<WorkflowResponse | null>(null);
  const [analysisTranscript, setAnalysisTranscript] = useState<TranscriptResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisVideoMeta, setAnalysisVideoMeta] = useState<VideoMetadata>(() => buildFallbackVideoMeta('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
  const [pollingWorkflowId, setPollingWorkflowId] = useState<string | null>(null);
  const [billingBalance, setBillingBalance] = useState<BillingBalanceResponse | null>(null);
  const [billingBalanceLoading, setBillingBalanceLoading] = useState(false);
  const [billingBalanceError, setBillingBalanceError] = useState<string | null>(null);
  const [insightState, setInsightState] = useState<{
    actionKey: TranscriptInsightActionKey;
    promptKey: string;
    estimatedCredits: number;
    workflowId: string | null;
    status: string;
    result: Record<string, unknown> | null;
    error: string | null;
  } | null>(null);
  const [activeInsightTab, setActiveInsightTab] = useState<TranscriptInsightActionKey>('quick-summary');
  const [pollingInsightWorkflowId, setPollingInsightWorkflowId] = useState<string | null>(null);
  const [adminAccess, setAdminAccess] = useState<boolean | null>(null);
  const isAdminRole = Boolean(authState?.user.roles?.some((role) => role.toLowerCase() === 'admin'));
  const isAdmin = isAdminRole || adminAccess === true;

  useEffect(() => {
    const handlePopState = () => {
      setLocation(getLocationFromPathname(window.location.pathname, window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const storedAuth = getStoredAuthState();
    if (!storedAuth || !isAuthenticated()) {
      clearAuthenticated();
      setAuthState(null);
      setAuthenticated(false);
      setAdminAccess(null);
      setAuthHydrating(false);
      return;
    }

    let cancelled = false;
    setAuthHydrating(true);
    getCurrentUser(storedAuth.session.accessToken)
      .then((user) => {
        if (cancelled) return;
        const nextAuth = {
          ...storedAuth,
          user: {
            ...storedAuth.user,
            ...user,
            roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : storedAuth.user.roles ?? [],
          },
        };
        setStoredAuthState(nextAuth);
        setAuthState(nextAuth);
        setAuthenticated(true);
        setAdminAccess(nextAuth.user.roles.some((role) => role.toLowerCase() === 'admin'));
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthenticated();
        setAuthState(null);
        setAuthenticated(false);
        setAdminAccess(null);
      })
      .finally(() => {
        if (!cancelled) setAuthHydrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (location.kind !== 'admin' || !authenticated || isAdminRole || adminAccess !== null) {
      return;
    }

    let cancelled = false;
    const accessToken = authState?.session.accessToken;
    if (!accessToken) {
      setAdminAccess(false);
      return;
    }

    getAdminRoles(accessToken)
      .then(() => {
        if (!cancelled) {
          setAdminAccess(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminAccess(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminAccess, authenticated, authState?.session.accessToken, isAdminRole, location.kind]);

  useEffect(() => {
    const normalizedPath = normalizePathname(window.location.pathname);

    if (authHydrating) {
      return;
    }

    if (authenticated && (location.kind === 'landing' || location.kind === 'auth')) {
      navigateToPath('/dashboard');
      return;
    }

    if (authenticated && location.kind === 'admin' && normalizedPath === '/admin') {
      navigateToPath('/admin/users');
      return;
    }

    if (location.kind === 'admin' && (!authenticated || !isAdmin)) {
      navigateToPath(authenticated ? '/dashboard' : '/');
      return;
    }

    if (!authenticated && location.kind === 'app' && normalizedPath !== '/') {
      navigateToPath('/');
    }
  }, [authenticated, authHydrating, isAdmin, location]);

  useEffect(() => {
    let cancelled = false;
    const userId = authState?.user.id?.trim();

    if (!authenticated || !userId) {
      setBillingBalance(null);
      setBillingBalanceError(null);
      setBillingBalanceLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBillingBalanceLoading(true);
    setBillingBalanceError(null);
    getBillingBalance(userId, authState?.session.accessToken)
      .then((balance) => {
        if (!cancelled) {
          setBillingBalance(balance);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBillingBalance(null);
          setBillingBalanceError(error instanceof Error ? error.message : 'Failed to load billing balance');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBillingBalanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authState?.session.accessToken, authState?.user.id, authenticated]);

  useEffect(() => {
    let cancelled = false;

    if (location.kind !== 'app' || location.nav !== 'research' || !['briefing', 'edit'].includes(location.researchView)) {
      setResearchTopicLoading(false);
      setSelectedResearchTopic(null);
      return () => {
        cancelled = true;
      };
    }

    if (!location.researchTopicId) {
      setSelectedResearchTopic(null);
      setResearchTopicLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setResearchTopicLoading(true);
    getResearchTopic(location.researchTopicId)
      .then((topic) => {
        if (cancelled) return;
        setSelectedResearchTopic(topic);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedResearchTopic(null);
      })
      .finally(() => {
        if (!cancelled) setResearchTopicLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location]);

  useEffect(() => {
    let cancelled = false;

    if (location.kind !== 'app' || location.nav !== 'transcript' || !location.transcriptSourceId) {
      setSelectedTranscriptSource(null);
      setSelectedTranscriptSourceLoading(false);
      setInsightState(null);
      setPollingInsightWorkflowId(null);
      return () => {
        cancelled = true;
      };
    }

    setSelectedTranscriptSource(null);
    setSelectedTranscriptSourceLoading(true);

    getTranscriptBySource(location.transcriptSourceId)
      .then(async (transcript) => {
        const previewSourceUrl = location.transcriptSourceUrl ?? transcript.sourceUrl ?? '';
        const preview = previewSourceUrl ? await getYouTubePreview(previewSourceUrl).catch(() => null) : null;
        if (cancelled) return;
        setSelectedTranscriptSource({
          url: previewSourceUrl || transcript.sourceUrl || '',
          transcript,
          videoMeta: buildTranscriptVideoMetaFromTranscript(transcript, preview, {
            sourceUrl: previewSourceUrl,
            title: location.transcriptTitle,
            channel: location.transcriptChannel,
          }),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedTranscriptSource(null);
      })
      .finally(() => {
        if (!cancelled) setSelectedTranscriptSourceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location]);

  useEffect(() => {
    if (!pollingWorkflowId || analysisPhase !== 'analyzing') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;

      try {
        const workflow = await getWorkflowStatus(pollingWorkflowId);
        if (cancelled) return;

        setAnalysisWorkflow(workflow);

        if (workflow.status === 'succeeded') {
          const sourceId = workflow.sourceId;
          if (!sourceId) {
            throw new Error('Workflow completed without a sourceId.');
          }

          const transcript = await getTranscriptBySource(sourceId);
          if (cancelled) return;

          setAnalysisTranscript(transcript);
          setAnalysisPhase('ready');
          setPollingWorkflowId(null);
          return;
        }

        if (workflow.status === 'failed' || workflow.status === 'dead' || workflow.status === 'cancelled') {
          throw new Error(workflow.errorMessage || `Workflow ${workflow.status}`);
        }

        timer = setTimeout(poll, 2000);
      } catch (error) {
        if (cancelled) return;
        setAnalysisError(error instanceof Error ? error.message : 'Something went wrong while polling workflow status');
        setAnalysisPhase('error');
        setPollingWorkflowId(null);
      }
    };

    timer = setTimeout(poll, 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [analysisPhase, pollingWorkflowId]);

  useEffect(() => {
    if (!pollingInsightWorkflowId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;

      try {
        const workflow = await getWorkflowStatus(pollingInsightWorkflowId);
        if (cancelled) return;

        setInsightState((current) => {
          if (!current || current.workflowId !== pollingInsightWorkflowId) {
            return current;
          }

          return {
            ...current,
            status: workflow.status,
            result: workflow.result as Record<string, unknown> | null,
            error: workflow.status === 'failed' || workflow.status === 'dead' || workflow.status === 'cancelled'
              ? workflow.errorMessage ?? current.error
              : null,
          };
        });

        if (workflow.status === 'succeeded' || workflow.status === 'failed' || workflow.status === 'dead' || workflow.status === 'cancelled') {
          setPollingInsightWorkflowId(null);
          return;
        }

        timer = setTimeout(poll, 2000);
      } catch (error) {
        if (cancelled) return;
        setInsightState((current) => current ? {
          ...current,
          status: 'error',
          error: error instanceof Error ? error.message : 'Something went wrong while polling insight workflow status',
        } : current);
        setPollingInsightWorkflowId(null);
      }
    };

    timer = setTimeout(poll, 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollingInsightWorkflowId]);

  const resetSummarizer = () => {
    setAnalysisPhase('idle');
    setAnalysisUrl('');
    setAnalysisWorkflow(null);
    setAnalysisTranscript(null);
    setAnalysisError(null);
    setPollingWorkflowId(null);
    setInsightState(null);
    setActiveInsightTab('quick-summary');
    setPollingInsightWorkflowId(null);
    setAnalysisVideoMeta(buildFallbackVideoMeta('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
  };

  const handleStartAnalysis = async (url: string) => {
    const normalizedUrl = url.trim();
    urlRef.current = normalizedUrl;
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setInsightState(null);
    setActiveInsightTab('quick-summary');
    setPollingInsightWorkflowId(null);
    setAnalysisUrl(normalizedUrl);
    setAnalysisError(null);
    setAnalysisTranscript(null);
    setAnalysisWorkflow(null);
    setAnalysisPhase('starting');

    const previewPromise = getYouTubePreview(normalizedUrl).catch(() => null);
    const analyzePromise = analyzeVideo({
      youtubeUrl: normalizedUrl,
      requestedByUserId: getCurrentUserId(),
      projectId: location.kind === 'app' ? location.projectId : null,
    });

    const preview = await previewPromise;
    setAnalysisVideoMeta(buildAnalyzingVideoMeta(normalizedUrl, preview));

    try {
      const response = await analyzePromise;

      if (response.transcript) {
        setAnalysisTranscript(response.transcript);
        setAnalysisPhase('ready');
        setPollingWorkflowId(null);
        return;
      }

      if (response.workflow) {
        setAnalysisWorkflow(response.workflow);
        setAnalysisPhase('analyzing');
        setPollingWorkflowId(response.workflow.id);
        return;
      }

      throw new Error('The API returned neither transcript nor workflow.');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Something went wrong');
      setAnalysisPhase('error');
      setPollingWorkflowId(null);
    }
  };

  const handleChangeUrl = () => {
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setSelectedResearchTopic(null);
    navigateToPath('/summarizer/new');
    resetSummarizer();
  };

  const handleNewSummarizer = () => {
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setSelectedResearchTopic(null);
    resetSummarizer();
    navigateToPath('/summarizer/new');
  };

  const handleRequestInsight = async (actionKey: TranscriptInsightActionKey, question?: string | null, conversationContext?: string | null) => {
    const sourceId =
      analysisTranscript?.sourceId
      ?? selectedHistoryTranscript?.transcript.sourceId
      ?? selectedTranscriptSource?.transcript.sourceId
      ?? null;

    if (!sourceId) {
      setInsightState({
        actionKey,
        promptKey: '',
        estimatedCredits: 0,
        workflowId: null,
        status: 'error',
        result: null,
        error: 'Transcript source is missing.',
      });
      return;
    }

    setActiveInsightTab(actionKey);

    let nextQuestion: string | null = question ?? null;
    if (actionKey === 'ask-this-video') {
      if (!nextQuestion?.trim()) {
        return;
      }

      nextQuestion = nextQuestion.trim();
    }

    setInsightState({
      actionKey,
      promptKey: '',
      estimatedCredits: 0,
      workflowId: null,
      status: 'starting',
      result: null,
      error: null,
    });

    try {
      const response = await createTranscriptInsight(sourceId, {
        requestedByUserId: getCurrentUserId(),
        actionKey,
        question: nextQuestion,
        conversationContext: conversationContext ?? null,
      });

      setInsightState({
        actionKey: response.actionKey,
        promptKey: response.promptKey,
        estimatedCredits: response.estimatedCredits,
        workflowId: response.workflow?.id ?? null,
        status: response.workflow?.status ?? response.status,
        result: response.result,
        error: null,
      });

      if (response.workflow && !['succeeded', 'failed', 'dead', 'cancelled'].includes(response.workflow.status)) {
        setPollingInsightWorkflowId(response.workflow.id);
      }
    } catch (error) {
      setInsightState({
        actionKey,
        promptKey: '',
        estimatedCredits: 0,
        workflowId: null,
        status: 'error',
        result: null,
        error: error instanceof Error ? error.message : 'Something went wrong',
      });
    }
  };

  const handleHistorySelect = async (item: HistoryItem) => {
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setInsightState(null);
    setActiveInsightTab('quick-summary');
    setPollingInsightWorkflowId(null);

    if (!item.sourceId) {
      navigateToPath('/history');
      return;
    }

    try {
      const [transcript, preview] = await Promise.all([
        getTranscriptBySource(item.sourceId),
        getYouTubePreview(item.sourceUrl ?? item.url ?? '').catch(() => null),
      ]);

      setSelectedHistoryTranscript({
        url: item.sourceUrl ?? item.url ?? '',
        transcript,
        videoMeta: buildTranscriptVideoMeta(item, transcript, preview),
      });
      navigateToPath('/transcript');
    } catch {
      navigateToPath('/history');
    }
  };

  const navigateToPath = (nextPath: string) => {
    const nextUrl = new URL(nextPath, window.location.origin);
    const normalizedNextPath = normalizePathname(nextUrl.pathname);
    if (normalizePathname(window.location.pathname) === normalizedNextPath && window.location.search === nextUrl.search) return;
    window.history.pushState({}, '', `${normalizedNextPath}${nextUrl.search}`);
    setLocation(getLocationFromPathname(normalizedNextPath, nextUrl.search));
  };

  const handleNavChange = (nav: NavItem) => {
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setSelectedResearchTopic(null);
    setActiveInsightTab('quick-summary');
    if (nav !== 'summarizer') {
      resetSummarizer();
    }
    navigateToPath(getPathForNav(nav));
  };

  const activeNav = location.kind === 'app' ? location.nav : 'summarizer';
  const researchView = location.kind === 'app' ? location.researchView : 'list';
  const summarizerView = location.kind === 'app' ? location.summarizerView : 'history';

  const summarizerProcessingState = buildProcessingState(
    analysisVideoMeta,
    analysisWorkflow,
    analysisTranscript?.sourceFilePath
      ? 'Whisper transcript'
      : analysisTranscript
        ? 'YouTube subtitles'
        : analysisWorkflow?.currentStepKey === 'download_video' || analysisWorkflow?.currentStepKey === 'extract_audio' || analysisWorkflow?.currentStepKey === 'transcribe_audio' || analysisWorkflow?.currentStepKey === 'import_transcript'
          ? 'Whisper transcript'
          : 'Checking native transcript',
  );

  const isSummarizerBusy = analysisPhase === 'starting' || analysisPhase === 'analyzing';

  // If a historical video is selected, build its completed state
  const selectedVideoState = selectedVideo ? buildCompletedState(selectedVideo) : null;
  const selectedVideoUrl = selectedVideo?.url ?? '';

  const renderCenter = () => {
    if (activeNav === 'summarizer') {
      if (summarizerView === 'history') {
        return <HistoryPage onVideoOpen={handleHistorySelect} onNew={handleNewSummarizer} />;
      }

      if (analysisPhase === 'ready' && analysisTranscript) {
        return (
          <BackendTranscriptView
            url={analysisUrl}
            transcript={analysisTranscript}
            videoMeta={{
              ...analysisVideoMeta,
              title: analysisVideoMeta.title,
              duration: formatDuration(analysisTranscript.durationSeconds),
              language: analysisTranscript.language.toUpperCase(),
              quality: analysisTranscript.sourceFilePath ? 'Whisper transcript' : 'YouTube subtitles',
            }}
            onChangeUrl={handleChangeUrl}
            insightState={insightState}
            activeInsightTab={activeInsightTab}
            onInsightTabChange={setActiveInsightTab}
            onRequestInsight={handleRequestInsight}
            billingBalance={billingBalance}
            billingBalanceLoading={billingBalanceLoading}
            billingBalanceError={billingBalanceError}
          />
        );
      }

      if (isSummarizerBusy) {
        return (
          <AnalyzingView
            url={analysisUrl || urlRef.current}
            projectName={location.kind === 'app' ? location.projectName : null}
            state={summarizerProcessingState}
            onCancel={handleChangeUrl}
          />
        );
      }

      return (
        <MainContent
          onStartAnalysis={handleStartAnalysis}
          errorMessage={analysisError}
          projectName={location.kind === 'app' ? location.projectName : null}
        />
      );
    }

    if (selectedHistoryTranscript && activeNav === 'transcript') {
      return (
        <BackendTranscriptView
          url={selectedHistoryTranscript.url}
          transcript={selectedHistoryTranscript.transcript}
          videoMeta={selectedHistoryTranscript.videoMeta}
          onChangeUrl={handleChangeUrl}
          insightState={insightState}
          activeInsightTab={activeInsightTab}
          onInsightTabChange={setActiveInsightTab}
          onRequestInsight={handleRequestInsight}
          billingBalance={billingBalance}
          billingBalanceLoading={billingBalanceLoading}
          billingBalanceError={billingBalanceError}
        />
      );
    }

    if (selectedTranscriptSource && activeNav === 'transcript') {
      return (
        <BackendTranscriptView
          url={selectedTranscriptSource.url}
          transcript={selectedTranscriptSource.transcript}
          videoMeta={selectedTranscriptSource.videoMeta}
          onChangeUrl={handleChangeUrl}
          insightState={insightState}
          activeInsightTab={activeInsightTab}
          onInsightTabChange={setActiveInsightTab}
          onRequestInsight={handleRequestInsight}
          billingBalance={billingBalance}
          billingBalanceLoading={billingBalanceLoading}
          billingBalanceError={billingBalanceError}
        />
      );
    }

    if (selectedTranscriptSourceLoading && activeNav === 'transcript') {
      return (
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
            Loading transcript...
          </div>
        </main>
      );
    }

    // Historical video selected → always show transcript view
    if (selectedVideoState && activeNav === 'transcript') {
      return <TranscriptView url={selectedVideoUrl} state={selectedVideoState} onChangeUrl={handleChangeUrl} />;
    }
    if (activeNav === 'dashboard') return <DashboardPage />;
    if (activeNav === 'insights') return <InsightsPage />;
    if (activeNav === 'exports') return <ExportsPage />;
    if (activeNav === 'history') return <HistoryPage onVideoOpen={handleHistorySelect} />;
    if (activeNav === 'projects') {
      if (location.kind === 'app' && location.projectId) {
        return (
          <ProjectViewPage
            projectId={location.projectId}
            currentUserDisplayName={authState?.user.displayName ?? null}
            currentUserEmail={authState?.user.email ?? null}
            initialTab={location.projectTab ?? 'overview'}
          />
        );
      }

      return <ProjectsPage />;
    }
    if (activeNav === 'todo') return <TodoPage />;
    if (activeNav === 'notes') return <NotesPage onNavigate={navigateToPath} />;
    if (activeNav === 'settings') return <SettingsPage />;
    if (activeNav === 'profile') return <ProfilePage onNavChange={handleNavChange} />;
    if (activeNav === 'research') {
      if (researchView === 'briefing') {
        if (researchTopicLoading) {
          return (
            <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
                Loading research topic...
              </div>
            </main>
          );
        }

        if (selectedResearchTopic) {
          return (
            <ResearchBriefingPage
              topic={selectedResearchTopic}
              briefingId={location.kind === 'app' ? location.researchBriefingId : null}
              onBack={() => navigateToPath('/research')}
              onEdit={() => navigateToPath(`/research/${encodeURIComponent(selectedResearchTopic.id)}/edit`)}
              onOpenBriefing={(briefingId) => navigateToPath(`/research/${encodeURIComponent(selectedResearchTopic.id)}/briefings/${encodeURIComponent(briefingId)}`)}
              onTopicChanged={(topic) => setSelectedResearchTopic(topic)}
            />
          );
        }

        return (
          <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
              Research topic not found.
            </div>
          </main>
        );
      }

      if (researchView === 'create')
        return <ResearchCreatePage onBack={() => navigateToPath('/research')} />;
      if (researchView === 'edit') {
        if (researchTopicLoading) {
          return (
            <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
                Loading research topic...
              </div>
            </main>
          );
        }

        if (selectedResearchTopic) {
          return (
            <ResearchCreatePage
              topic={selectedResearchTopic}
              onBack={() => navigateToPath(`/research/${encodeURIComponent(selectedResearchTopic.id)}`)}
            />
          );
        }

        return (
          <main className="flex-1 overflow-y-auto bg-[var(--color-bg-main)] p-6">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
              Research topic not found.
            </div>
          </main>
        );
      }
      return (
        <ResearchPage
          onTopicSelect={(t) => {
            setSelectedResearchTopic(t);
            navigateToPath(`/research/${encodeURIComponent(t.id)}`);
          }}
          onCreateNew={() => navigateToPath('/research/create')}
        />
      );
    }
    return <MainContent onStartAnalysis={handleStartAnalysis} errorMessage={analysisError} />;
  };

  const renderRight = () => {
    const transcriptSourceId =
      analysisTranscript?.sourceId
      ?? selectedHistoryTranscript?.transcript.sourceId
      ?? selectedTranscriptSource?.transcript.sourceId
      ?? null;

    if (selectedHistoryTranscript && activeNav === 'transcript') {
      return (
        <TranscriptRightSidebar
          sourceId={transcriptSourceId}
          requestedByUserId={getCurrentUserId()}
          insightState={insightState}
          billingBalance={billingBalance}
          billingBalanceLoading={billingBalanceLoading}
          billingBalanceError={billingBalanceError}
          onSelectInsightTab={setActiveInsightTab}
          onRequestInsight={handleRequestInsight}
        />
      );
    }
    if (selectedTranscriptSource && activeNav === 'transcript') {
      return (
        <TranscriptRightSidebar
          sourceId={transcriptSourceId}
          requestedByUserId={getCurrentUserId()}
          insightState={insightState}
          billingBalance={billingBalance}
          billingBalanceLoading={billingBalanceLoading}
          billingBalanceError={billingBalanceError}
          onSelectInsightTab={setActiveInsightTab}
          onRequestInsight={handleRequestInsight}
        />
      );
    }
    if (selectedVideoState && activeNav === 'transcript') {
      return (
        <TranscriptRightSidebar
          sourceId={transcriptSourceId}
          requestedByUserId={getCurrentUserId()}
          insightState={insightState}
          billingBalance={billingBalance}
          billingBalanceLoading={billingBalanceLoading}
          billingBalanceError={billingBalanceError}
          onSelectInsightTab={setActiveInsightTab}
          onRequestInsight={handleRequestInsight}
        />
      );
    }
    if (activeNav === 'summarizer') {
      if (analysisPhase === 'ready' && analysisTranscript) {
        return (
          <TranscriptRightSidebar
            sourceId={analysisTranscript.sourceId}
            requestedByUserId={getCurrentUserId()}
            insightState={insightState}
            billingBalance={billingBalance}
            billingBalanceLoading={billingBalanceLoading}
            billingBalanceError={billingBalanceError}
            onSelectInsightTab={setActiveInsightTab}
            onRequestInsight={handleRequestInsight}
          />
        );
      }
      if (isSummarizerBusy) return <ProcessingRightSidebar state={summarizerProcessingState} />;
      return <RightSidebar />;
    }
    return null;
  };

  const handleAuthSubmit = async (input: {
    mode: 'login' | 'signup';
    email: string;
    password: string;
    displayName: string;
    confirmPassword: string;
    agree: boolean;
  }) => {
    const response =
      input.mode === 'signup'
        ? await registerUser({
            email: input.email,
            password: input.password,
            displayName: input.displayName.trim() || null,
          })
        : await loginWithPassword({
            email: input.email,
            password: input.password,
          });

    setStoredAuthState(response);
    setAuthState(response);
    setAuthenticated(true);
    navigateToPath('/dashboard');
  };

  const handleLogout = async () => {
    const accessToken = authState?.session.accessToken ?? null;
    try {
      await logoutUser(accessToken);
    } finally {
      clearAuthenticated();
      setAuthState(null);
      setAuthenticated(false);
      setAdminAccess(null);
      navigateToPath('/');
    }
  };

  if (location.kind === 'admin' && (authHydrating || !authenticated || !isAdmin)) {
    return null;
  }

  if (location.kind === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => {
          navigateToPath('/signup');
        }}
        onLogIn={() => navigateToPath('/login')}
        onHome={() => navigateToPath('/')}
      />
    );
  }

  if (location.kind === 'auth') {
    return (
      <LoginPage
        mode={location.mode}
        onSubmit={handleAuthSubmit}
        onSwitchMode={() => navigateToPath(location.mode === 'login' ? '/signup' : '/login')}
        onHome={() => navigateToPath('/')}
      />
    );
  }

  if (location.kind === 'admin') {
    return (
      <AdminPage
        initialSection={location.section}
        onSectionChange={(section) => navigateToPath(`/admin/${section}`)}
        onBackToApp={() => navigateToPath('/dashboard')}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
      <div className="lg:hidden sticky top-0 z-40 border-b border-border bg-bg-secondary/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigateToPath('/')}
            className="inline-flex items-center gap-3 rounded-2xl border border-border bg-bg-card px-3 py-2 text-left"
          >
            <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <div className="text-[13px] font-semibold text-text-primary">Ai Summarizer</div>
              <div className="text-[10px] text-text-muted">Workspaces</div>
            </div>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-border bg-bg-card px-3 py-2 text-[12px] font-medium text-text-secondary"
          >
            Logout
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {(['dashboard', 'projects', 'summarizer', 'research', 'todo', 'notes'] as NavItem[]).map((nav) => {
            const active = activeNav === nav;
            return (
              <button
                key={nav}
                type="button"
                onClick={() => handleNavChange(nav)}
                className={`whitespace-nowrap rounded-full border px-3 py-2 text-[12px] transition-colors ${
                  active ? 'border-accent/30 bg-accent/10 text-text-primary' : 'border-border bg-bg-card text-text-secondary'
                }`}
              >
                {nav[0].toUpperCase() + nav.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden lg:block">
        <LeftSidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          onOpenAdmin={isAdmin ? () => navigateToPath('/admin/users') : undefined}
          onLogout={handleLogout}
          onHome={() => navigateToPath('/')}
          userName={authState?.user.displayName ?? authState?.user.email}
          userEmail={authState?.user.email}
          isAdmin={isAdmin}
          userInitials={(authState?.user.displayName ?? authState?.user.email ?? 'AI')
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        />
      </div>
      <div className="min-w-0 flex min-h-0 flex-1 flex-col">
        {renderCenter()}
      </div>
      <div className="hidden lg:block">{renderRight()}</div>
    </div>
  );
}
