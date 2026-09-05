export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "failed";
export type ConnectionQuality = "good" | "fair" | "poor" | "relay";

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  isSharingScreen?: boolean;
  disconnected?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
}

export type SignalingMessage =
  | { type: "hello"; peer: PeerInfo }
  | { type: "welcome"; peers: PeerInfo[]; hostId: string }
  | { type: "roster"; peers: PeerInfo[]; hostId: string }
  | { type: "peer-joined"; peer: PeerInfo }
  | { type: "peer-left"; peerId: string }
  | { type: "screen-share"; peerId: string; isSharing: boolean }
  | { type: "need-screen" }
  | { type: "need-relay" }
  | { type: "chat"; message: ChatMessage }
  | { type: "profile-update"; peerId: string; name: string; color: string };

export interface PeerInfo {
  id: string;
  name: string;
  color: string;
  isSharingScreen?: boolean;
}
