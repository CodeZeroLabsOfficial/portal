/** Derive an embeddable URL for common providers (best-effort). */
export function embedVideoSrc(url: string): { kind: "youtube" | "vimeo" | "iframe"; src: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.replace("/", "").slice(0, 32);
      if (!id) return null;
      return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
    }

    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${v}` };
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${parts[embedIdx + 1]}` };
      }
      const shortIdx = parts.indexOf("shorts");
      if (shortIdx >= 0 && parts[shortIdx + 1]) {
        return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${parts[shortIdx + 1]}` };
      }
    }

    if (host.endsWith("vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return { kind: "vimeo", src: `https://player.vimeo.com/video/${id}` };
      }
    }

    return null;
  } catch {
    return null;
  }
}
