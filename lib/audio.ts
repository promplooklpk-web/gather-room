const remoteAudioElements = new Set<HTMLAudioElement>();

export async function getMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 1 },
    },
    video: false,
  });
}

export function createRemoteAudioElement(): HTMLAudioElement {
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.volume = 1;
  audio.muted = false;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.style.display = "none";
  document.body.appendChild(audio);
  remoteAudioElements.add(audio);
  return audio;
}

export function removeRemoteAudioElement(audio: HTMLAudioElement) {
  audio.srcObject = null;
  audio.remove();
  remoteAudioElements.delete(audio);
}

export async function playRemoteAudio(audio: HTMLAudioElement): Promise<boolean> {
  try {
    audio.volume = 1;
    audio.muted = false;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export async function unlockAllRemoteAudio(): Promise<void> {
  await Promise.all(
    Array.from(remoteAudioElements).map((audio) => playRemoteAudio(audio))
  );
}

export function getMicTrack(stream: MediaStream | null): MediaStream | null {
  if (!stream) return null;
  const track = stream.getAudioTracks()[0];
  if (!track) return null;
  return new MediaStream([track]);
}
