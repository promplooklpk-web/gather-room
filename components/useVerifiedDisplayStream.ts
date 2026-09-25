"use client";

import { useEffect, useRef, useState } from "react";
import {
  mediaStreamIsDisplayable,
  waitForDisplayableStream,
} from "@/lib/peerConfig";

/**
 * Only expose a stream to the fullscreen stage after real frames are present,
 * and drop it when the track goes mute/ended/inactive.
 */
export function useVerifiedDisplayStream(
  stream: MediaStream | null | undefined,
  onInvalid?: () => void
): MediaStream | null {
  const [verified, setVerified] = useState<MediaStream | null>(null);
  const onInvalidRef = useRef(onInvalid);
  onInvalidRef.current = onInvalid;

  useEffect(() => {
    if (!stream) {
      setVerified(null);
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;

    const invalidate = () => {
      setVerified(null);
      onInvalidRef.current?.();
    };

    const hasFrames = () =>
      mediaStreamIsDisplayable(stream, { allowMutedCapture: true }) &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;

    const poll = () => {
      if (!mediaStreamIsDisplayable(stream, { allowMutedCapture: true })) {
        invalidate();
        return;
      }
      if (hasFrames()) setVerified(stream);
    };

    void waitForDisplayableStream(stream, 2500).then((ok) => {
      if (cancelled) return;
      if (!ok) invalidate();
      else poll();
    });

    video.addEventListener("resize", poll);
    video.addEventListener("loadeddata", poll);
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", invalidate);
      track.addEventListener("mute", invalidate);
    });
    stream.addEventListener("inactive", invalidate);
    void video.play().catch(() => invalidate());

    const interval = window.setInterval(poll, 350);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  return verified;
}
