import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </Icon>
  );
}

export function MicOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <path d="M15 9.3V6a3 3 0 0 0-5.7-1.3" />
      <path d="M5 11a7 7 0 0 0 11.5 5.4" />
      <path d="M19 11a7 7 0 0 0-.7-3" />
      <path d="M12 18v3" />
      <path d="M4 4l16 16" />
    </Icon>
  );
}

export function HeadphonesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13v4a2 2 0 0 0 2 2h1v-8H5a2 2 0 0 0-2 2Z" />
      <path d="M18 11h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v-8Z" />
      <path d="M4 13a8 8 0 0 1 16 0" />
    </Icon>
  );
}

export function HeadphonesOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13v4a2 2 0 0 0 2 2h1v-8H5a2 2 0 0 0-2 2Z" />
      <path d="M18 11h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v-8Z" />
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 4l16 16" />
    </Icon>
  );
}

export function CameraOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 16H5a2 2 0 0 1-2-2V8" />
      <path d="M7 8h9a2 2 0 0 1 2 2v1l3-2v8" />
      <path d="M4 4l16 16" />
    </Icon>
  );
}

export function ScreenShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </Icon>
  );
}

export function ScreenShareStopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <path d="M9 8l6 6" />
      <path d="M15 8l-6 6" />
    </Icon>
  );
}

export function PhoneDisconnectIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 8.5c-3.4-3.4-14.6-3.4-18 0-.6.6-.7 1.5-.3 2.2l1.6 2.4c.4.6 1.2.8 1.9.5l2.1-1c.5-.2.8-.7.8-1.2V9.6c2.7-.7 5.5-.7 8.2 0v1.8c0 .5.3 1 .8 1.2l2.1 1c.7.3 1.5.1 1.9-.5l1.6-2.4c.4-.7.3-1.6-.3-2.2Z" />
    </svg>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12a10 10 0 0 1 20 0" />
      <path d="M6 12a6 6 0 0 1 12 0" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function WaveformIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h2" />
      <path d="M7 8v8" />
      <path d="M11 5v14" />
      <path d="M15 8v8" />
      <path d="M19 11v2" />
    </Icon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M5.6 5.6l1.4 1.4" />
      <path d="M17 17l1.4 1.4" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="M5.6 18.4l1.4-1.4" />
      <path d="M17 7l1.4-1.4" />
    </Icon>
  );
}

export function ActivitiesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function SoundboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v10" />
      <path d="M8 8h8l-1.5 9h-5L8 8Z" />
      <path d="M9 21h6" />
    </Icon>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </Icon>
  );
}

export function ExitFullscreenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </Icon>
  );
}

export function CameraBadgeIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h6.5A1.5 1.5 0 0 1 11 4.5V5l2.2-1.3a.7.7 0 0 1 1 .6v7.4a.7.7 0 0 1-1 .6L11 11.1v.4A1.5 1.5 0 0 1 9.5 13H3A1.5 1.5 0 0 1 1.5 11.5v-7Z" />
    </svg>
  );
}
