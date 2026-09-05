const remoteAudioMap = new Map<string, HTMLAudioElement>();
const peerVolumeMap = new Map<string, number>(); // peerId -> 0..100
let remoteAudioDeafened = false;

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

export function setRemoteAudioDeafened(deafened: boolean) {
  remoteAudioDeafened = deafened;
  remoteAudioMap.forEach((audio, peerId) => {
    const userVol = (peerVolumeMap.get(peerId) ?? 100) / 100;
    audio.muted = deafened;
    audio.volume = deafened ? 0 : Math.max(0, Math.min(1, userVol));
  });
}

export function setPeerVolume(peerId: string, volumePercent: number) {
  const clamped = Math.max(0, Math.min(200, volumePercent));
  peerVolumeMap.set(peerId, clamped);
  const audio = remoteAudioMap.get(peerId);
  if (audio) {
    audio.muted = remoteAudioDeafened || clamped === 0;
    // Standard HTMLAudioElement volume is 0.0 to 1.0
    audio.volume = remoteAudioDeafened ? 0 : Math.min(1, clamped / 100);
  }
}

export function getPeerVolume(peerId: string): number {
  return peerVolumeMap.get(peerId) ?? 100;
}

export async function getMicStream(deviceId?: string): Promise<MediaStream> {
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };

  const request = navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
    video: false,
  });

  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("mic-timeout")), 12000);
  });

  const stream = await Promise.race([request, timeout]);
  stream.getAudioTracks().forEach((track) => {
    void track
      .applyConstraints({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })
      .catch(() => {
        /* Safari may reject extra constraints */
      });
  });
  return stream;
}

export function createRemoteAudioElement(peerId?: string): HTMLAudioElement {
  const audio = document.createElement("audio");
  audio.autoplay = true;
  const userVol = peerId ? (peerVolumeMap.get(peerId) ?? 100) / 100 : 1;
  audio.volume = remoteAudioDeafened ? 0 : Math.min(1, userVol);
  audio.muted = remoteAudioDeafened;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.style.display = "none";
  document.body.appendChild(audio);

  const key = peerId || `anon-${Math.random()}`;
  remoteAudioMap.set(key, audio);
  return audio;
}

export function attachRemoteAudioStream(
  audio: HTMLAudioElement,
  stream: MediaStream
) {
  audio.srcObject = new MediaStream(stream.getAudioTracks());
}

export function removeRemoteAudioElement(audio: HTMLAudioElement, peerId?: string) {
  audio.srcObject = null;
  audio.remove();
  if (peerId) {
    remoteAudioMap.delete(peerId);
  } else {
    for (const [key, val] of remoteAudioMap.entries()) {
      if (val === audio) {
        remoteAudioMap.delete(key);
        break;
      }
    }
  }
}

export async function playRemoteAudio(audio: HTMLAudioElement): Promise<boolean> {
  try {
    audio.muted = remoteAudioDeafened;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export async function unlockAllRemoteAudio(): Promise<void> {
  await Promise.all(
    Array.from(remoteAudioMap.values()).map((audio) => playRemoteAudio(audio))
  );
}

export function getMicTrack(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null;
  const track = stream.getAudioTracks()[0];
  if (!track) return null;
  return new MediaStream([track]);
}

export interface AudioMonitor {
  stop: () => void;
}

/**
 * Monitors speaking activity on an audio stream with a debounce hang time.
 * Uses Web Audio AnalyserNode (frequency domain). Does NOT route to destination.
 */
export function monitorAudioStream(
  stream: MediaStream,
  onSpeakingChange: (isSpeaking: boolean) => void,
  threshold = 12
): AudioMonitor {
  const ctx = getSharedAudioContext();
  if (!ctx || stream.getAudioTracks().length === 0) {
    return { stop: () => {} };
  }

  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let timer: number | null = null;
  let releaseTimer: number | null = null;
  let isCurrentlySpeaking = false;

  try {
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    timer = window.setInterval(() => {
      if (!analyser) return;
      analyser.getByteFrequencyData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
      }
      const avg = sum / buffer.length;
      const detected = avg > threshold;

      if (detected) {
        if (releaseTimer) {
          window.clearTimeout(releaseTimer);
          releaseTimer = null;
        }
        if (!isCurrentlySpeaking) {
          isCurrentlySpeaking = true;
          onSpeakingChange(true);
        }
      } else if (isCurrentlySpeaking && !releaseTimer) {
        // Hold the green speaking ring for 300ms after speech pauses
        releaseTimer = window.setTimeout(() => {
          isCurrentlySpeaking = false;
          releaseTimer = null;
          onSpeakingChange(false);
        }, 300);
      }
    }, 70);
  } catch {
    /* Ignore audio analysis failure on unsupported environments */
  }

  return {
    stop: () => {
      if (timer) window.clearInterval(timer);
      if (releaseTimer) window.clearTimeout(releaseTimer);
      try {
        source?.disconnect();
      } catch {
        /* Ignore disconnect error */
      }
      source = null;
      analyser = null;
    },
  };
}

/**
 * Monitors real-time volume level (0..100) for a Mic Test meter in settings.
 */
export function monitorAudioLevel(
  stream: MediaStream,
  onLevelChange: (level: number) => void
): AudioMonitor {
  const ctx = getSharedAudioContext();
  if (!ctx || stream.getAudioTracks().length === 0) {
    return { stop: () => {} };
  }

  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let timer: number | null = null;

  try {
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    timer = window.setInterval(() => {
      if (!analyser) return;
      analyser.getByteFrequencyData(buffer);
      let max = 0;
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] > max) max = buffer[i];
      }
      const percent = Math.min(100, Math.round((max / 255) * 100 * 1.5));
      onLevelChange(percent);
    }, 50);
  } catch {
    /* Ignore */
  }

  return {
    stop: () => {
      if (timer) window.clearInterval(timer);
      try {
        source?.disconnect();
      } catch {
        /* Ignore */
      }
      source = null;
      analyser = null;
    },
  };
}
