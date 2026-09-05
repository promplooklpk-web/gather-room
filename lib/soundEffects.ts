// Web Audio API synthesized sound cues (Discord-like feedback)
// Zero external assets required, fully static & offline-capable.

const SOUND_STORAGE_KEY = "mtlclick-sound-enabled";

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
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

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(SOUND_STORAGE_KEY);
  return val === null ? true : val === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "true" : "false");
}

function playTone(
  freqs: { freq: number; duration: number; gain?: number; type?: OscillatorType }[]
) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  let startTime = ctx.currentTime;
  freqs.forEach(({ freq, duration, gain = 0.12, type = "sine" }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);

    startTime += duration * 0.75;
  });
}

// User connected to room (bright two-tone upward chime)
export function playJoinSound(): void {
  playTone([
    { freq: 523.25, duration: 0.1, gain: 0.12, type: "sine" }, // C5
    { freq: 659.25, duration: 0.18, gain: 0.14, type: "sine" }, // E5
  ]);
}

// User left room (gentle two-tone downward chime)
export function playLeaveSound(): void {
  playTone([
    { freq: 659.25, duration: 0.09, gain: 0.12, type: "sine" }, // E5
    { freq: 440.0, duration: 0.18, gain: 0.12, type: "sine" }, // A4
  ]);
}

// Microphone muted (soft low click/drop)
export function playMuteSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

// Microphone unmuted (crisp rising blip)
export function playUnmuteSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

// Deafen headphones (descending thud)
export function playDeafenSound(): void {
  playTone([
    { freq: 300, duration: 0.08, gain: 0.1, type: "sine" },
    { freq: 200, duration: 0.12, gain: 0.08, type: "sine" },
  ]);
}

// Undeafen headphones (ascending thud)
export function playUndeafenSound(): void {
  playTone([
    { freq: 200, duration: 0.08, gain: 0.1, type: "sine" },
    { freq: 320, duration: 0.12, gain: 0.12, type: "sine" },
  ]);
}

// Incoming chat message (pleasantly crisp notification chime)
export function playMessageSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now); // A5

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1318.51, now); // E6

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.18);
  osc2.stop(now + 0.18);
}
