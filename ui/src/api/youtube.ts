import type { VideoMetadata } from '../types';

interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '') || null;
    }

    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v');
    }
  } catch {
    return null;
  }

  return null;
}

export async function getYouTubePreview(url: string): Promise<Pick<VideoMetadata, 'title' | 'channel' | 'thumbnail'> | null> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (response.ok) {
      const data = await response.json() as YouTubeOEmbedResponse;
      return {
        title: data.title,
        channel: data.author_name,
        thumbnail: data.thumbnail_url,
      };
    }
  } catch {
    // fallback below
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return {
    title: 'YouTube video',
    channel: 'YouTube',
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}
