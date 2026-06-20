
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a professional embed URL from various video platform links.
 * Optimized for minimal UI while keeping core player features.
 */
export function getEmbedUrl(url: string, options: { autoplay?: boolean } = {}) {
  if (!url) return "";

  // YouTube Check
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|live\/)|youtu\.be\/)([^"&?\/ ]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1];
    const params = new URLSearchParams();
    
    if (options.autoplay) {
      params.append("autoplay", "1");
      // Mute=1 is usually required by browsers for unmuted autoplay
      params.append("mute", "1"); 
    }
    
    params.append("rel", "0");
    params.append("modestbranding", "1");
    params.append("fs", "1"); // Keep fullscreen
    params.append("controls", "1"); // Keep timeline/controls
    params.append("iv_load_policy", "3"); 
    params.append("playsinline", "1");
    
    const queryString = params.toString();
    return `https://www.youtube.com/embed/${videoId}?${queryString}`;
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
    
    params.append("badge", "0");
    params.append("autopause", "0");
    params.append("byline", "0");
    params.append("portrait", "0");
    params.append("title", "0");

    if (hash) {
      params.append("h", hash);
    }
    const queryString = params.toString();
    return queryString ? `${embedUrl}?${queryString}` : embedUrl;
  }

  return url;
}
