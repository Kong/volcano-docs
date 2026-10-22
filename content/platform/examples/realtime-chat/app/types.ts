export interface ChatConfig {
  apiUrl: string;
  anonKey: string;
}

export interface ChatMessage {
  username: string;
  text: string;
}

export interface OnlineUser {
  id: string;
  username: string;
}
