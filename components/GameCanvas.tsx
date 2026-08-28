"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAP,
  MAP_HEIGHT,
  MAP_WIDTH,
  SCREEN_WALL,
  TILE_SIZE,
  AVATAR_RADIUS,
} from "@/lib/room";
import type { PlayerState } from "@/lib/types";
import { RemoteVideo } from "@/components/RemoteVideo";

interface GameCanvasProps {
  players: PlayerState[];
  myId: string | null;
  remoteScreen: MediaStream | null;
  onTapWalk?: (x: number, y: number) => void;
}

export function GameCanvas({
  players,
  myId,
  remoteScreen,
  onTapWalk,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      const world = clientToWorld(clientX, clientY);
      if (world && onTapWalk) onTapWalk(world.x, world.y);
    },
    [clientToWorld, onTapWalk]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const tile = MAP[y][x];
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;

          if (tile === 0) {
            ctx.fillStyle = (x + y) % 2 === 0 ? "#3d5a45" : "#456350";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          } else if (tile === 1) {
            ctx.fillStyle = "#2c3e50";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = "#1a252f";
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else if (tile === 2) {
            ctx.fillStyle = "#1a1a2e";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(
        SCREEN_WALL.x,
        SCREEN_WALL.y,
        SCREEN_WALL.width,
        SCREEN_WALL.height
      );
      ctx.strokeStyle = remoteScreen ? "#22c55e" : "#4a90d9";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        SCREEN_WALL.x,
        SCREEN_WALL.y,
        SCREEN_WALL.width,
        SCREEN_WALL.height
      );

      if (!remoteScreen) {
        ctx.fillStyle = "#4a90d9";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "📺 จอ",
          SCREEN_WALL.x + SCREEN_WALL.width / 2,
          SCREEN_WALL.y + SCREEN_WALL.height / 2
        );
      }

      const desks = [
        { x: 2, y: 3 },
        { x: 12, y: 3 },
        { x: 2, y: 9 },
        { x: 12, y: 9 },
      ];
      desks.forEach((d) => {
        ctx.fillStyle = "#8B6914";
        ctx.fillRect(
          d.x * TILE_SIZE + 6,
          d.y * TILE_SIZE + 10,
          TILE_SIZE - 12,
          TILE_SIZE - 16
        );
      });

      players.forEach((player) => {
        const isMe = player.id === myId;

        ctx.beginPath();
        ctx.ellipse(
          player.x,
          player.y + AVATAR_RADIUS - 2,
          AVATAR_RADIUS * 0.8,
          AVATAR_RADIUS * 0.3,
          0,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(player.x, player.y, AVATAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.strokeStyle = isMe ? "#fff" : "rgba(255,255,255,0.5)";
        ctx.lineWidth = isMe ? 3 : 1.5;
        ctx.stroke();

        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        const label = isMe ? `${player.name} ★` : player.name;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(
          player.x - tw / 2 - 4,
          player.y - AVATAR_RADIUS - 18,
          tw + 8,
          16
        );
        ctx.fillStyle = "#fff";
        ctx.fillText(label, player.x, player.y - AVATAR_RADIUS - 6);

        if (player.isSharingScreen) {
          ctx.font = "14px sans-serif";
          ctx.fillText(
            "🖥️",
            player.x + AVATAR_RADIUS - 4,
            player.y - AVATAR_RADIUS + 4
          );
        }
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [players, myId, remoteScreen]);

  const wallLeft = `${(SCREEN_WALL.x / CANVAS_WIDTH) * 100}%`;
  const wallTop = `${(SCREEN_WALL.y / CANVAS_HEIGHT) * 100}%`;
  const wallWidth = `${(SCREEN_WALL.width / CANVAS_WIDTH) * 100}%`;
  const wallHeight = `${(SCREEN_WALL.height / CANVAS_HEIGHT) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="relative touch-none select-none"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch" && e.target === canvasRef.current) {
          handleTap(e.clientX, e.clientY);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full rounded-lg border-2 border-emerald-700/50 shadow-xl"
        style={{ imageRendering: "pixelated", width: "100%", height: "auto" }}
        onClick={(e) => handleTap(e.clientX, e.clientY)}
      />

      {remoteScreen && (
        <div
          className="pointer-events-none absolute overflow-hidden rounded-sm border border-emerald-400/50"
          style={{
            left: wallLeft,
            top: wallTop,
            width: wallWidth,
            height: wallHeight,
          }}
        >
          <RemoteVideo
            stream={remoteScreen}
            className="h-full w-full"
            label="Screen on wall"
          />
        </div>
      )}
    </div>
  );
}
