import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts a professional embed URL from various video platform links.
 * Optimized for minimal UI and forced unmuted autoplay.
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
      // NOTE: Browsers may block unmuted autoplay unless the user has interacted with the page.
      params.append("mute", "0"); 
    }
    
    // Hide controls and reduce branding to the absolute minimum
    params.append("controls", "0");      // Hides sound button, seek bar, and play/pause
    params.append("modestbranding", "1"); // Minimizes YouTube logo
    params.append("rel", "0");           // Prevents "More Videos" from other channels
    params.append("showinfo", "0");      // Hides video title (deprecated but helpful)
    params.append("iv_load_policy", "3"); // Hides video annotations
    params.append("playsinline", "1");    // Prevent full-screen on mobile
    
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
    
    // Hide all Vimeo UI components
    params.append("controls", "0");
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
