const remoteAudioElements = new Set<HTMLAudioElement>();
let remoteAudioDeafened = false;

export function setRemoteAudioDeafened(deafened: boolean) {
  remoteAudioDeafened = deafened;
  remoteAudioElements.forEach((audio) => {
    audio.muted = deafened;
    audio.volume = deafened ? 0 : 1;
  });
}

export async function getMicStream(): Promise<MediaStream> {
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
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

export function createRemoteAudioElement(): HTMLAudioElement {
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.volume = remoteAudioDeafened ? 0 : 1;
  audio.muted = remoteAudioDeafened;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.style.display = "none";
  document.body.appendChild(audio);
  remoteAudioElements.add(audio);
  return audio;
}

export function attachRemoteAudioStream(
  audio: HTMLAudioElement,
  stream: MediaStream
) {
  audio.srcObject = new MediaStream(stream.getAudioTracks());
}

export function removeRemoteAudioElement(audio: HTMLAudioElement) {
  audio.srcObject = null;
  audio.remove();
  remoteAudioElements.delete(audio);
}

export async function playRemoteAudio(audio: HTMLAudioElement): Promise<boolean> {
  try {
    audio.volume = remoteAudioDeafened ? 0 : 1;
    audio.muted = remoteAudioDeafened;
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
