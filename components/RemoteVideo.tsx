"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

interface RemoteVideoProps {
  stream: MediaStream;
  className?: string;
  label?: string;
  /** Muted is required for autoplay on iOS; screen share has no audio anyway */
  muted?: boolean;
}

/** Visible <video> tuned for iOS Safari (playsInline, autoplay, tap-to-play fallback). */
export function RemoteVideo({
  stream,
  className = "",
  label,
  muted = true,
}: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsTap(false);
    } catch {
      setNeedsTap(true);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.srcObject = stream;
    video.muted = muted;
    void tryPlay();

    const onCanPlay = () => void tryPlay();
    video.addEventListener("loadedmetadata", onCanPlay);
    video.addEventListener("canplay", onCanPlay);
    return () => {
      video.removeEventListener("loadedmetadata", onCanPlay);
      video.removeEventListener("canplay", onCanPlay);
      video.srcObject = null;
    };
  }, [stream, muted, tryPlay]);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-full w-full bg-black object-contain"
      />
      {needsTap && (
        <button
          type="button"
          onClick={() => void tryPlay()}
          className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-medium text-white"
        >
          ▶ {t.tapToPlayVideo}
        </button>
      )}
      {label && (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}
