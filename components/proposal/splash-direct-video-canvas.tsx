"use client";

import * as React from "react";

function parseObjectPositionPercent(pos: string): { x: number; y: number } {
  const tokens = pos.trim().split(/\s+/).filter(Boolean);
  const parseOne = (t: string, fallback: number) => {
    const m = /^([\d.]+)%?$/.exec(t);
    return m ? Number(m[1]) : fallback;
  };
  return {
    x: tokens[0] !== undefined ? parseOne(tokens[0], 50) : 50,
    y: tokens[1] !== undefined ? parseOne(tokens[1], 50) : 50,
  };
}

/**
 * Plays a direct video URL into a canvas so Safari/WebKit never paints native `<video>`
 * controls (prev / pause / skip) on the visible hero. Falls back to a plain `<video>`
 * if `drawImage` fails (e.g. cross-origin without CORS).
 */
export function SplashDirectVideoCanvas({
  src,
  objectPosition,
  poster,
  autoPlay,
}: {
  src: string;
  objectPosition: string;
  poster?: string;
  autoPlay: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number>(0);
  const [useFallback, setUseFallback] = React.useState(false);
  const fp = React.useMemo(() => parseObjectPositionPercent(objectPosition), [objectPosition]);

  const tick = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!video || !canvas || !container || useFallback) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw < 2 || ch < 2) return;

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1, 2.5);
    if (canvas.width !== Math.floor(cw * dpr) || canvas.height !== Math.floor(ch * dpr)) {
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) * (fp.x / 100);
        const dy = (ch - dh) * (fp.y / 100);
        ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);
      } catch {
        setUseFallback(true);
        return;
      }
    }

    if (!video.paused && !video.ended) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [fp.x, fp.y, useFallback]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || useFallback) return;

    const onRun = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    video.addEventListener("loadeddata", onRun);
    video.addEventListener("play", onRun);
    video.addEventListener("playing", onRun);
    video.addEventListener("timeupdate", onRun);
    video.addEventListener("pause", onRun);

    if (autoPlay) {
      void video.play().catch(() => {
        /* autoplay policies — still draw poster/canvas when user gesture later */
      });
    }

    return () => {
      video.removeEventListener("loadeddata", onRun);
      video.removeEventListener("play", onRun);
      video.removeEventListener("playing", onRun);
      video.removeEventListener("timeupdate", onRun);
      video.removeEventListener("pause", onRun);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [autoPlay, tick, useFallback, src]);

  React.useEffect(() => {
    const ro =
      typeof ResizeObserver !== "undefined" && containerRef.current
        ? new ResizeObserver(() => {
            if (!useFallback) {
              if (rafRef.current) cancelAnimationFrame(rafRef.current);
              rafRef.current = requestAnimationFrame(tick);
            }
          })
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => ro?.disconnect();
  }, [tick, useFallback]);

  if (useFallback) {
    return (
      <video
        key={src}
        className="proposal-splash-bg-video absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition }}
        autoPlay={autoPlay}
        controls={false}
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        src={src}
        tabIndex={-1}
      />
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/*
        Keep decoding off-screen; visible pixels only come from `<canvas>` so WebKit
        does not attach its native control chrome to the hero region.
      */}
      <video
        ref={videoRef}
        src={src}
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-[0.001]"
        style={{ transform: "translate(-4000px, -4000px)" }}
        muted
        playsInline
        loop
        autoPlay={autoPlay}
        preload="auto"
        poster={poster}
        controls={false}
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] h-full w-full object-cover"
        aria-hidden
      />
    </div>
  );
}
