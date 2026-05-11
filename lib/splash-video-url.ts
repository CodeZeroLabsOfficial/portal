/**
 * Turns pasted YouTube/Vimeo embed snippets or URLs into a single video URL for
 * `SplashBlockBackground.videoUrl` (watch link, embed link, or direct file URL).
 */
export function normalizeSplashVideoUrlInput(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/&amp;/gi, "&").replace(/&#38;/g, "&");
  if (/<iframe/i.test(s)) {
    const m = s.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (m?.[1]) {
      s = m[1].trim().replace(/&amp;/gi, "&").replace(/&#38;/g, "&");
    }
  }
  return s.trim();
}
