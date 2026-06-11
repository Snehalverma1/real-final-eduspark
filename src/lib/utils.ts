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
      // Set mute to 0 to try and play with sound
      // NOTE: Browsers usually block unmuted autoplay until a user interaction occurs.
      params.append("mute", "0"); 
    }
    
    // rel=0 ensures "More Videos" only come from the same channel, reducing clutter.
    params.append("rel", "0");
    // modestbranding=1 hides the YouTube logo from the control bar.
    params.append("modestbranding", "1");
    // Explicitly allow fullscreen and keep controls for the timeline.
    params.append("fs", "1");
    params.append("controls", "1");
    params.append("iv_load_policy", "3"); // Hides video annotations
    params.append("playsinline", "1");    // Prevent full-screen hijacking on mobile
    
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
      params.append("muted", "0");
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
