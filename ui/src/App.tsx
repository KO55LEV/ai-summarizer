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
import NotesPage from './components/pages/NotesPage';
import { ResearchPage } from './components/pages/ResearchPage';
import { ResearchBriefingPage } from './components/pages/ResearchBriefingPage';
import { ResearchCreatePage } from './components/pages/ResearchCreatePage';
import AdminPage from './components/pages/AdminPage';
import LandingPage from './components/pages/LandingPage';
import LoginPage from './components/pages/LoginPage';
import { getCurrentUser, loginWithPassword, logoutUser, registerUser } from './api/auth';
import { getAdminRoles } from './api/adminUsers';
import { getRecentVideos } from './api/recentVideos';
import { analyzeVideo, getTranscriptBySource, getWorkflowStatus } from './api';
import { getResearchList } from './api/research';
import { getYouTubePreview } from './api/youtube';
import { getCurrentUserId } from './config/currentUser';
import { clearAuthenticated, getStoredAuthState, isAuthenticated, setStoredAuthState } from './config/auth';
import type { NavItem, VideoMetadata, VideoRecord, WorkflowResponse, TranscriptResponse } from './types';
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
  | { kind: 'admin'; section: 'users' | 'prompts' | 'search-providers' | 'runtime-settings' | 'email-templates' }
  | {
      kind: 'app';
      nav: NavItem;
      researchView: 'list' | 'briefing' | 'create';
      researchTopicId: string | null;
    };

const NAV_PATHS: Record<NavItem, string> = {
  dashboard: '/dashboard',
  summarizer: '/',
  transcript: '/transcript',
  insights: '/insights',
  exports: '/exports',
  history: '/history',
  research: '/research',
  projects: '/projects',
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

function getLocationFromPathname(pathname: string): AppLocation {
  const path = normalizePathname(pathname);

  if (path === '/login' || path === '/signup') {
    return { kind: 'auth', mode: path === '/signup' ? 'signup' : 'login' };
  }

  if (path === '/admin') {
    return { kind: 'admin', section: 'users' };
  }

  if (path.startsWith('/admin/')) {
    const section = path.split('/')[2];
    if (section === 'prompts' || section === 'search-providers' || section === 'runtime-settings' || section === 'users' || section === 'email-templates') {
      return { kind: 'admin', section };
    }

    return { kind: 'admin', section: 'users' };
  }

  if (path === '/') {
    return { kind: 'landing' };
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { kind: 'app', nav: 'summarizer', researchView: 'list', researchTopicId: null };
  }

  const [first, second] = segments;
  if (!isNavItem(first)) {
    return { kind: 'app', nav: 'summarizer', researchView: 'list', researchTopicId: null };
  }

  if (first === 'research') {
    if (second === 'create') {
      return { kind: 'app', nav: 'research', researchView: 'create', researchTopicId: null };
    }

    if (second) {
      return {
        kind: 'app',
        nav: 'research',
        researchView: 'briefing',
        researchTopicId: decodeURIComponent(second),
      };
    }

    return { kind: 'app', nav: 'research', researchView: 'list', researchTopicId: null };
  }

  return { kind: 'app', nav: first, researchView: 'list', researchTopicId: null };
}

function getPathForNav(nav: NavItem): string {
  return NAV_PATHS[nav];
}

export default function App() {
  const [location, setLocation] = useState<AppLocation>(() => getLocationFromPathname(window.location.pathname));
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
  const [sidebarVideos, setSidebarVideos] = useState<VideoRecord[]>([]);
  const [selectedResearchTopic, setSelectedResearchTopic] = useState<ResearchTopic | null>(null);
  const [researchTopicLoading, setResearchTopicLoading] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'starting' | 'analyzing' | 'ready' | 'error'>('idle');
  const [analysisUrl, setAnalysisUrl] = useState('');
  const [analysisWorkflow, setAnalysisWorkflow] = useState<WorkflowResponse | null>(null);
  const [analysisTranscript, setAnalysisTranscript] = useState<TranscriptResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisVideoMeta, setAnalysisVideoMeta] = useState<VideoMetadata>(() => buildFallbackVideoMeta('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
  const [pollingWorkflowId, setPollingWorkflowId] = useState<string | null>(null);
  const [adminAccess, setAdminAccess] = useState<boolean | null>(null);
  const isAdminRole = Boolean(authState?.user.roles?.some((role) => role.toLowerCase() === 'admin'));
  const isAdmin = isAdminRole || adminAccess === true;

  useEffect(() => {
    const handlePopState = () => {
      setLocation(getLocationFromPathname(window.location.pathname));
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
        if (nextAuth.user.roles.some((role) => role.toLowerCase() === 'admin')) {
          setAdminAccess(true);
          return;
        }

        return getAdminRoles(storedAuth.session.accessToken)
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
    getRecentVideos().then(setSidebarVideos);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (location.kind !== 'app' || location.nav !== 'research' || location.researchView !== 'briefing') {
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
    getResearchList(getCurrentUserId())
      .then((data) => {
        if (cancelled) return;
        const topic = data.topics.find((item) => item.id === location.researchTopicId) ?? null;
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

  const resetSummarizer = () => {
    setAnalysisPhase('idle');
    setAnalysisUrl('');
    setAnalysisWorkflow(null);
    setAnalysisTranscript(null);
    setAnalysisError(null);
    setPollingWorkflowId(null);
    setAnalysisVideoMeta(buildFallbackVideoMeta('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
  };

  const handleStartAnalysis = async (url: string) => {
    const normalizedUrl = url.trim();
    urlRef.current = normalizedUrl;
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setAnalysisUrl(normalizedUrl);
    setAnalysisError(null);
    setAnalysisTranscript(null);
    setAnalysisWorkflow(null);
    setAnalysisPhase('starting');

    const previewPromise = getYouTubePreview(normalizedUrl).catch(() => null);
    const analyzePromise = analyzeVideo({ youtubeUrl: normalizedUrl, requestedByUserId: getCurrentUserId() });

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
    navigateToPath('/');
    resetSummarizer();
  };

  const handleVideoSelect = (video: VideoRecord) => {
    setSelectedHistoryTranscript(null);
    setSelectedVideo(video);
    navigateToPath('/transcript');
  };

  const handleHistorySelect = async (item: HistoryItem) => {
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);

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

  const handleViewAll = () => {
    navigateToPath('/history');
  };

  const navigateToPath = (nextPath: string) => {
    const normalizedNextPath = normalizePathname(nextPath);
    if (normalizePathname(window.location.pathname) === normalizedNextPath) return;
    window.history.pushState({}, '', normalizedNextPath);
    setLocation(getLocationFromPathname(normalizedNextPath));
  };

  const handleNavChange = (nav: NavItem) => {
    setSelectedVideo(null);
    setSelectedHistoryTranscript(null);
    setSelectedResearchTopic(null);
    if (nav !== 'summarizer') {
      resetSummarizer();
    }
    navigateToPath(getPathForNav(nav));
  };

  const activeNav = location.kind === 'app' ? location.nav : 'summarizer';
  const researchView = location.kind === 'app' ? location.researchView : 'list';

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
          />
        );
      }

      if (isSummarizerBusy) {
        return <AnalyzingView url={analysisUrl || urlRef.current} state={summarizerProcessingState} onCancel={handleChangeUrl} />;
      }

      return <MainContent onStartAnalysis={handleStartAnalysis} errorMessage={analysisError} />;
    }

    if (selectedHistoryTranscript && activeNav === 'transcript') {
      return (
        <BackendTranscriptView
          url={selectedHistoryTranscript.url}
          transcript={selectedHistoryTranscript.transcript}
          videoMeta={selectedHistoryTranscript.videoMeta}
          onChangeUrl={handleChangeUrl}
        />
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
    if (activeNav === 'projects') return <ProjectsPage />;
    if (activeNav === 'notes') return <NotesPage />;
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
          return <ResearchBriefingPage topic={selectedResearchTopic} onBack={() => navigateToPath('/research')} />;
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
    if (selectedHistoryTranscript && activeNav === 'transcript') return <TranscriptRightSidebar />;
    if (selectedVideoState && activeNav === 'transcript') return <TranscriptRightSidebar />;
    if (activeNav === 'summarizer') {
      if (analysisPhase === 'ready' && analysisTranscript) return <TranscriptRightSidebar />;
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
    <div className="flex h-screen overflow-hidden">
      <LeftSidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onViewAll={handleViewAll}
        onVideoSelect={(idx) => handleVideoSelect(sidebarVideos[idx])}
        recentVideos={sidebarVideos}
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
      {renderCenter()}
      {renderRight()}
    </div>
  );
}
