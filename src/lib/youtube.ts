/**
 * Latest videos / lives from the Apostolado YouTube channel.
 *
 * Uses the public RSS feed (no API key, no quota) and caches the result for an
 * hour via the Next fetch cache. Channel: https://www.youtube.com/@apostoladodegarabandal
 */

export const YOUTUBE_CHANNEL_ID = 'UC-4z9KUIioEgWRG_DIOt8dA';
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@apostoladodegarabandal';

export type YouTubeVideo = {
  id: string;
  title: string;
  published: string;
  url: string;
  thumbnail: string;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function getLatestVideos(limit = 4): Promise<YouTubeVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
  try {
    const res = await fetch(feedUrl, {
      // Refresh hourly; survives even if YouTube is briefly unreachable.
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GarabandalBot/1.0)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    const videos: YouTubeVideo[] = [];
    for (const e of entries) {
      const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = e.match(/<title>([^<]*)<\/title>/)?.[1];
      const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
      if (!id || !title) continue;
      videos.push({
        id,
        title: decodeEntities(title),
        published: published ?? '',
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
      if (videos.length >= limit) break;
    }
    return videos;
  } catch {
    return [];
  }
}
