"use client";

import { useCallback, useRef, useState } from "react";

const BASE = 56;
const MAX_DRAG = 48;

interface TouchJoystickProps {
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
}

export function TouchJoystick({ onMove, onEnd }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > MAX_DRAG) {
        dx = (dx / dist) * MAX_DRAG;
        dy = (dy / dist) * MAX_DRAG;
      }
      setKnob({ x: dx, y: dy });
      const nx = dx / MAX_DRAG;
      const ny = dy / MAX_DRAG;
      onMove(nx, ny);
    },
    [onMove]
  );

  const reset = useCallback(() => {
    setKnob({ x: 0, y: 0 });
    activeRef.current = false;
    pointerIdRef.current = null;
    onEnd();
  }, [onEnd]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activeRef.current = true;
    pointerIdRef.current = e.pointerId;
    baseRef.current?.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current || e.pointerId !== pointerIdRef.current) return;
    e.preventDefault();
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    e.preventDefault();
    baseRef.current?.releasePointerCapture(e.pointerId);
    reset();
  };

  return (
    <div
      ref={baseRef}
      className="relative flex touch-none select-none items-center justify-center"
      style={{ width: BASE * 2, height: BASE * 2 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="group"
      aria-label="Movement joystick"
    >
      <div
        className="absolute rounded-full border-2 border-white/30 bg-white/10"
        style={{ width: BASE * 2, height: BASE * 2 }}
      />
      <div
        className="absolute rounded-full border-2 border-emerald-300 bg-emerald-500/80 shadow-lg"
        style={{
          width: BASE,
          height: BASE,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}
