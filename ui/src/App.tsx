import { useState, useRef, useEffect } from 'react';
import LeftSidebar from './components/LeftSidebar';
import MainContent from './components/MainContent';
import RightSidebar from './components/RightSidebar';
import AnalyzingView from './components/AnalyzingView';
import ProcessingRightSidebar from './components/ProcessingRightSidebar';
import TranscriptView from './components/TranscriptView';
import TranscriptRightSidebar from './components/TranscriptRightSidebar';
import DashboardPage from './components/pages/DashboardPage';
import InsightsPage from './components/pages/InsightsPage';
import ExportsPage from './components/pages/ExportsPage';
import HistoryPage from './components/pages/HistoryPage';
import SettingsPage from './components/pages/SettingsPage';
import ProfilePage from './components/pages/ProfilePage';
import { ResearchPage } from './components/pages/ResearchPage';
import { ResearchBriefingPage } from './components/pages/ResearchBriefingPage';
import { ResearchCreatePage } from './components/pages/ResearchCreatePage';
import { useProcessingSimulation } from './hooks/useProcessingSimulation';
import type { NavItem, VideoRecord } from './types';
import type { ProcessingState, PipelineStep } from './types/pipeline';
import type { ResearchTopic } from './api/types';
import { getRecentVideos } from './api/recentVideos';

// ── Mock recent videos removed — loaded from API via getRecentVideos() ─────────

function buildCompletedState(video: VideoRecord): ProcessingState {
  const steps: PipelineStep[] = [
    { key: 'fetch', label: 'Video fetched', status: 'completed', time: '00:02' },
    { key: 'captions', label: 'Checking captions', status: 'completed', time: '00:05' },
    { key: 'no-transcript', label: 'No YouTube transcript found', status: video.source === 'Whisper' ? 'warning' : 'completed', time: '00:07', detail: video.source === 'Whisper' ? 'Falling back to Whisper' : undefined },
    { key: 'extract-audio', label: 'Extracting audio', status: video.source === 'Whisper' ? 'completed' : 'completed', time: '00:10' },
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

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>('summarizer');
  const urlRef = useRef('');
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [sidebarVideos, setSidebarVideos] = useState<VideoRecord[]>([]);
  const [researchView, setResearchView] = useState<'list' | 'briefing' | 'create'>('list');
  const [selectedResearchTopic, setSelectedResearchTopic] = useState<ResearchTopic | null>(null);
  const { isAnalyzing, state, startAnalysis, cancelAnalysis } = useProcessingSimulation();

  useEffect(() => {
    getRecentVideos().then(setSidebarVideos);
  }, []);

  const handleStartAnalysis = (url: string) => {
    urlRef.current = url;
    setSelectedVideo(null);
    startAnalysis(url);
    setActiveNav('summarizer');
  };

  const handleChangeUrl = () => {
    cancelAnalysis();
    setSelectedVideo(null);
    setActiveNav('summarizer');
  };

  const handleVideoSelect = (video: VideoRecord) => {
    setSelectedVideo(video);
    setActiveNav('transcript');
  };

  const handleViewAll = () => {
    setActiveNav('history');
  };

  const isComplete = isAnalyzing && state?.isComplete;
  const isProcessing = isAnalyzing && state && !state.isComplete;

  // If a historical video is selected, build its completed state
  const selectedVideoState = selectedVideo ? buildCompletedState(selectedVideo) : null;
  const selectedVideoUrl = selectedVideo?.url ?? '';

  const renderCenter = () => {
    // Historical video selected → always show transcript view
    if (selectedVideoState && activeNav === 'transcript') {
      return <TranscriptView url={selectedVideoUrl} state={selectedVideoState} onChangeUrl={handleChangeUrl} />;
    }
    if (activeNav === 'summarizer') {
      if (isComplete && state) return <TranscriptView url={urlRef.current} state={state} onChangeUrl={handleChangeUrl} />;
      if (isProcessing && state) return <AnalyzingView url={urlRef.current} state={state} onCancel={cancelAnalysis} />;
      return <MainContent onStartAnalysis={handleStartAnalysis} />;
    }
    if (activeNav === 'dashboard') return <DashboardPage />;
    if (activeNav === 'insights') return <InsightsPage />;
    if (activeNav === 'exports') return <ExportsPage />;
    if (activeNav === 'history') return <HistoryPage onVideoOpen={handleVideoSelect} />;
    if (activeNav === 'settings') return <SettingsPage />;
    if (activeNav === 'profile') return <ProfilePage onNavChange={setActiveNav} />;
    if (activeNav === 'research') {
      if (researchView === 'briefing' && selectedResearchTopic)
        return <ResearchBriefingPage topic={selectedResearchTopic} onBack={() => setResearchView('list')} />;
      if (researchView === 'create')
        return <ResearchCreatePage onBack={() => setResearchView('list')} />;
      return (
        <ResearchPage
          onTopicSelect={(t) => { setSelectedResearchTopic(t); setResearchView('briefing'); }}
          onCreateNew={() => setResearchView('create')}
        />
      );
    }
    return <MainContent onStartAnalysis={handleStartAnalysis} />;
  };

  const renderRight = () => {
    if (selectedVideoState && activeNav === 'transcript') return <TranscriptRightSidebar />;
    if (activeNav === 'summarizer') {
      if (isComplete && state) return <TranscriptRightSidebar />;
      if (isProcessing && state) return <ProcessingRightSidebar state={state} />;
      return <RightSidebar />;
    }
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <LeftSidebar
        activeNav={activeNav}
        onNavChange={(nav) => { setSelectedVideo(null); setResearchView('list'); setSelectedResearchTopic(null); setActiveNav(nav); }}
        onViewAll={handleViewAll}
        onVideoSelect={(idx) => handleVideoSelect(sidebarVideos[idx])}
        recentVideos={sidebarVideos}
      />
      {renderCenter()}
      {renderRight()}
    </div>
  );
}
