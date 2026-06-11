import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a professional embed URL from various video platform links.
 * Supports YouTube (standard, mobile, live, embed) and Vimeo.
 */
export function getEmbedUrl(url: string, options: { autoplay?: boolean } = {}) {
  if (!url) return "";

  // YouTube Check (including /live/, /v/, /e/, etc.)
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|live\/)|youtu\.be\/)([^"&?\/ ]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1];
    const params = new URLSearchParams();
    
    // Core parameters to minimize branding and force interaction-free playback
    if (options.autoplay) {
      params.append("autoplay", "1");
      params.append("mute", "1"); // Browsers require mute for autoplay to trigger reliably
    }
    
    params.append("modestbranding", "1"); // Reduces YouTube logo appearance
    params.append("rel", "0");           // Shows related videos only from the same channel
    params.append("playsinline", "1");    // Better behavior on mobile devices
    params.append("enablejsapi", "1");    // Allows programmatic control if needed
    
    const queryString = params.toString();
    return `https://www.youtube.com/embed/${videoId}${queryString ? `?${queryString}` : ""}`;
  }

  // Vimeo Check
  const vimeoRegex = /(?:vimeo\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|player\.vimeo\.com\/video\/|vimeo\.com\/)(?:channels\/(?:\w+\/)|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:\/(\w+))?/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    const hash = vimeoMatch[2];
    let embedUrl = `https://player.vimeo.com/video/${videoId}`;
    const params = new URLSearchParams();
    if (options.autoplay) {
      params.append("autoplay", "1");
      params.append("muted", "1");
    }
    if (hash) {
      params.append("h", hash);
    }
    const queryString = params.toString();
    return queryString ? `${embedUrl}?${queryString}` : embedUrl;
  }

  // Return original if no match (might be a direct stream link)
  return url;
}
