"use client";

import { useEffect, useRef, useState } from "react";
import { AVATAR_COLORS, initialFromName } from "@/lib/colors";
import { isSoundEnabled, setSoundEnabled } from "@/lib/soundEffects";
import { monitorAudioLevel, type AudioMonitor } from "@/lib/audio";
import { t } from "@/lib/i18n";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userColor: string;
  onUpdateProfile: (name: string, color: string) => void;
  onSwitchMicrophone?: (deviceId: string) => Promise<boolean>;
}

export function SettingsModal({
  isOpen,
  onClose,
  userName,
  userColor,
  onUpdateProfile,
  onSwitchMicrophone,
}: SettingsModalProps) {
  const [name, setName] = useState(userName);
  const [color, setColor] = useState(userColor);
  const [soundCues, setSoundCues] = useState(() => isSoundEnabled());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const testStreamRef = useRef<MediaStream | null>(null);
  const monitorRef = useRef<AudioMonitor | null>(null);

  // Set up device list and audio test stream
  useEffect(() => {
    if (isOpen) {
      // Enumerate audio input devices
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devs) => {
            const audioInputs = devs.filter((d) => d.kind === "audioinput");
            setDevices(audioInputs);
            const savedMic = localStorage.getItem("mtlclick-mic-device");
            if (savedMic && audioInputs.some((d) => d.deviceId === savedMic)) {
              setSelectedDeviceId(savedMic);
            }
          })
          .catch(() => {});
      }

      // Request test stream for mic meter
      let active = true;
      navigator.mediaDevices
        ?.getUserMedia({ audio: true, video: false })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          testStreamRef.current = stream;
          monitorRef.current = monitorAudioLevel(stream, (level) => {
            setMicLevel(level);
          });
        })
        .catch(() => {});

      return () => {
        active = false;
        monitorRef.current?.stop();
        testStreamRef.current?.getTracks().forEach((t) => t.stop());
        testStreamRef.current = null;
      };
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem("mtlclick-mic-device", deviceId);
    if (onSwitchMicrophone) {
      await onSwitchMicrophone(deviceId);
    }
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundCues(enabled);
    setSoundEnabled(enabled);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || userName;
    onUpdateProfile(trimmed, color);
    localStorage.setItem("mtlclick-username", trimmed);
    localStorage.setItem("mtlclick-usercolor", color);
    setSavedSuccess(true);
    window.setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-[#1f2023] bg-[#313338] text-[#dbdee1] shadow-2xl">
        {/* Modal Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#1f2023] px-6">
          <h2 className="text-lg font-bold text-white">{t.userSettings}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-[#4e5058] px-2.5 py-1 text-xs font-semibold text-[#b5bac1] transition hover:bg-[#35373c] hover:text-white"
            title={t.close}
          >
            <span>{t.esc}</span>
            <span className="text-sm leading-none">✕</span>
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Profile Section */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
              {t.profileSettings}
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="flex items-center gap-4 rounded-lg bg-[#2b2d31] p-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-md ring-2 ring-black/30"
                  style={{ backgroundColor: color }}
                >
                  {initialFromName(name)}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <label htmlFor="settings-name-input" className="block text-xs font-medium text-[#b5bac1]">
                    {t.displayName}
                  </label>
                  <input
                    id="settings-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    className="w-full rounded bg-[#1e1f22] px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-xs font-medium text-[#b5bac1]">
                  {t.avatarColor}
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full transition-transform ${
                        color === c
                          ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#313338]"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {savedSuccess ? (
                  <span className="text-xs font-semibold text-[#23a559]">
                    ✓ บันทึกโปรไฟล์สำเร็จ
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="rounded bg-[#5865f2] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4752c4]"
                >
                  {t.saveChanges}
                </button>
              </div>
            </form>
          </section>

          <hr className="border-[#1f2023]" />

          {/* Voice Input Settings */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
              {t.voiceSettings}
            </h3>

            {/* Mic Selector */}
            <div className="space-y-1.5">
              <label htmlFor="settings-mic-select" className="block text-xs font-medium text-[#b5bac1]">
                {t.micInput}
              </label>
              <select
                id="settings-mic-select"
                value={selectedDeviceId}
                onChange={(e) => void handleDeviceChange(e.target.value)}
                className="w-full rounded bg-[#1e1f22] px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-[#5865f2]"
              >
                <option value="">{t.defaultMic}</option>
                {devices.map((d, index) => (
                  <option key={d.deviceId || index} value={d.deviceId}>
                    {d.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Mic Test Bar */}
            <div className="rounded-lg bg-[#2b2d31] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{t.micTest}</span>
                <span className={micLevel > 15 ? "text-[#23a559] font-medium" : "text-[#949ba4]"}>
                  {micLevel > 15 ? t.micWorking : t.micTesting}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#1e1f22]">
                <div
                  className="h-full bg-gradient-to-r from-[#23a559] via-[#f1c40f] to-[#e74c3c] transition-all duration-75 ease-out"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
              <p className="text-[11px] text-[#949ba4]">{t.micTestHint}</p>
            </div>
          </section>

          <hr className="border-[#1f2023]" />

          {/* Sound Effects Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
                  {t.soundEffects}
                </h3>
                <p className="text-[11px] text-[#949ba4]">
                  {t.soundEffectsDesc}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundCues}
                onClick={() => handleSoundToggle(!soundCues)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  soundCues ? "bg-[#23a559]" : "bg-[#4e5058]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    soundCues ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <footer className="flex h-14 shrink-0 items-center justify-end border-t border-[#1f2023] bg-[#2b2d31] px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#5865f2] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#4752c4]"
          >
            {t.close}
          </button>
        </footer>
      </div>
    </div>
  );
}
