"use client";

import { useEffect, useRef } from "react";
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

interface GameCanvasProps {
  players: PlayerState[];
  myId: string | null;
  remoteScreen: MediaStream | null;
}

export function GameCanvas({ players, myId, remoteScreen }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Floor
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

      // Screen on wall
      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(
        SCREEN_WALL.x,
        SCREEN_WALL.y,
        SCREEN_WALL.width,
        SCREEN_WALL.height
      );
      ctx.strokeStyle = "#4a90d9";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        SCREEN_WALL.x,
        SCREEN_WALL.y,
        SCREEN_WALL.width,
        SCREEN_WALL.height
      );

      if (remoteScreen && screenVideoRef.current) {
        try {
          ctx.drawImage(
            screenVideoRef.current,
            SCREEN_WALL.x + 2,
            SCREEN_WALL.y + 2,
            SCREEN_WALL.width - 4,
            SCREEN_WALL.height - 4
          );
        } catch {
          // video not ready
        }
      } else {
        ctx.fillStyle = "#4a90d9";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "📺 จอ",
          SCREEN_WALL.x + SCREEN_WALL.width / 2,
          SCREEN_WALL.y + SCREEN_WALL.height / 2
        );
      }

      // Desks (decorative)
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

      // Players
      players.forEach((player) => {
        const isMe = player.id === myId;

        // Shadow
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

        // Body
        ctx.beginPath();
        ctx.arc(player.x, player.y, AVATAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.strokeStyle = isMe ? "#fff" : "rgba(255,255,255,0.5)";
        ctx.lineWidth = isMe ? 3 : 1.5;
        ctx.stroke();

        // Name tag
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
          ctx.fillText("🖥️", player.x + AVATAR_RADIUS - 4, player.y - AVATAR_RADIUS + 4);
        }
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [players, myId, remoteScreen]);

  useEffect(() => {
    if (!screenVideoRef.current) {
      screenVideoRef.current = document.createElement("video");
      screenVideoRef.current.muted = true;
      screenVideoRef.current.playsInline = true;
    }
    const video = screenVideoRef.current;
    if (remoteScreen) {
      video.srcObject = remoteScreen;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [remoteScreen]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="rounded-lg border-2 border-emerald-700/50 shadow-xl"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
