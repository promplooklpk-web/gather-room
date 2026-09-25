/** User-facing copy for getDisplayMedia failures (Thai + English). */

export type DisplayMediaFailureKind =
  | "denied"
  | "cancelled"
  | "insecure"
  | "busy"
  | "unsupported"
  | "unknown";

export function classifyDisplayMediaError(err: unknown): DisplayMediaFailureKind {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message)
      : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    if (
      /user aborted|cancel|dismiss/i.test(message) ||
      /The user aborted/i.test(message)
    ) {
      return "cancelled";
    }
    return "denied";
  }
  if (name === "AbortError") return "cancelled";
  if (name === "NotReadableError" || name === "TrackStartError") return "busy";
  if (name === "SecurityError" || name === "NotSupportedError") {
    if (/secure|https|insecure/i.test(message)) return "insecure";
    return "unsupported";
  }
  if (name === "InvalidStateError" && /gesture|activation/i.test(message)) {
    return "cancelled";
  }
  return "unknown";
}

export function displayMediaErrorMessage(
  err: unknown,
  copy: {
    denied: string;
    cancelled: string;
    insecure: string;
    busy: string;
    unsupported: string;
    unknown: string;
  }
): string {
  const kind = classifyDisplayMediaError(err);
  switch (kind) {
    case "denied":
      return copy.denied;
    case "cancelled":
      return copy.cancelled;
    case "insecure":
      return copy.insecure;
    case "busy":
      return copy.busy;
    case "unsupported":
      return copy.unsupported;
    default:
      return copy.unknown;
  }
}

export function isSecureDisplayMediaContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}
