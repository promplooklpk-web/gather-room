export const AVATAR_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e91e63",
  "#00bcd4",
];

export function pickColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function initialFromName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
