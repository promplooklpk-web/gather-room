export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  isSharingScreen?: boolean;
}

export type SignalingMessage =
  | { type: "hello"; peer: PeerInfo }
  | { type: "welcome"; peers: PeerInfo[]; hostId: string }
  | { type: "peer-joined"; peer: PeerInfo }
  | { type: "peer-left"; peerId: string }
  | { type: "position"; peerId: string; x: number; y: number }
  | { type: "screen-share"; peerId: string; isSharing: boolean };

export interface PeerInfo {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export const ROOM_ID = "default";

/** Fixed PeerJS id for the single shared room — first joiner claims it as coordinator. */
export const ROOM_HOST_ID = `gather-${ROOM_ID}-host`;
