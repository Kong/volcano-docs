'use client';

import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';
import { VolcanoAuth } from '@volcano.dev/sdk';
import { VolcanoRealtime, type PresenceInfo, type RealtimeChannel } from '@volcano.dev/sdk/realtime';
import ChatRoom from './ChatRoom';
import ConfigScreen from './ConfigScreen';
import JoinScreen from './JoinScreen';
import type { ChatConfig, ChatMessage, OnlineUser } from './types';

interface ChatUser {
  id: string;
  name: string;
}

interface ConnectionHandlers {
  setConnected: (connected: boolean) => void;
  setError: (error: string) => void;
}

// Broadcast payloads are untyped; render only messages with a sender and text.
function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const { username, text } = value as Record<string, unknown>;
  return typeof username === 'string' && typeof text === 'string';
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field !== '' ? field : undefined;
}

// connInfo.user_metadata carries the metadata the user signed up with.
function displayName(info: PresenceInfo): string {
  const metadata = info.connInfo?.user_metadata;
  return (
    stringField(metadata, 'display_name') ??
    stringField(metadata, 'name') ??
    stringField(info.connInfo, 'email') ??
    'Anonymous'
  );
}

// Sign up anonymously
async function signIn(config: ChatConfig, name: string) {
  const volcano = new VolcanoAuth(config);
  const result = await volcano.auth.signInAnonymously({ name });

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.session || !result.user) {
    throw new Error('No session returned');
  }

  return { session: result.session, user: result.user };
}

// Connect to realtime
async function connect(config: ChatConfig, accessToken: string, { setConnected, setError }: ConnectionHandlers) {
  const realtime = new VolcanoRealtime({
    ...config,
    accessToken,
  });

  realtime.onConnect(() => {
    setConnected(true);
    setError('');
  });
  realtime.onDisconnect(() => setConnected(false));
  realtime.onError(() => setError('Connection error'));

  await realtime.connect();
  return realtime;
}

// Subscribe to chat channel
async function subscribeToChat(realtime: VolcanoRealtime, setMessages: Dispatch<SetStateAction<ChatMessage[]>>) {
  const channel = realtime.channel('chat-general');
  channel.on('message', (msg) => {
    if (isChatMessage(msg)) setMessages((m) => [...m, msg]);
  });
  await channel.subscribe();
  return channel;
}

// Subscribe to presence channel to track online users
async function subscribeToPresence(realtime: VolcanoRealtime, setOnlineUsers: (users: OnlineUser[]) => void) {
  const presence = realtime.channel('chat-general', { type: 'presence' });

  // Fires with the full state on subscribe and on every join or leave.
  presence.onPresenceSync((state) => {
    setOnlineUsers(Object.entries(state).map(([id, info]) => ({ id, username: displayName(info) })));
  });

  await presence.subscribe();
}

// Throws while the channel is resubscribing after a reconnect.
async function sendMessage(channel: RealtimeChannel, user: ChatUser, text: string) {
  await channel.send({
    userId: user.id,
    username: user.name,
    text,
    time: new Date().toISOString(),
  });
}

// Which screen to show, and the config the first screen saves in localStorage
function useScreens() {
  const [screen, setScreen] = useState<'config' | 'join' | 'chat'>('config');
  const [config, setConfig] = useState<ChatConfig>({ apiUrl: 'http://localhost:8000', anonKey: '' });

  useEffect(() => {
    const stored = localStorage.getItem('volcano_config');
    if (stored) {
      const parsed: ChatConfig = JSON.parse(stored);
      setConfig(parsed);
      if (parsed.anonKey) setScreen('join');
    }
  }, []);

  const saveConfig = (cfg: ChatConfig) => {
    localStorage.setItem('volcano_config', JSON.stringify(cfg));
    setConfig(cfg);
    setScreen('join');
  };

  const changeConfig = () => {
    localStorage.removeItem('volcano_config');
    setScreen('config');
  };

  return { screen, setScreen, config, saveConfig, changeConfig };
}

// Auto-scroll to latest message
function useScrollToLatest(messages: ChatMessage[]) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return messagesEndRef;
}

function useChat(config: ChatConfig) {
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const userRef = useRef<ChatUser | null>(null);
  const messagesEndRef = useScrollToLatest(messages);

  // Returns whether the user joined
  const join = async (name: string) => {
    setError('');

    try {
      const { session, user } = await signIn(config, name);
      const realtime = await connect(config, session.access_token, { setConnected, setError });
      channelRef.current = await subscribeToChat(realtime, setMessages);
      await subscribeToPresence(realtime, setOnlineUsers);

      userRef.current = { id: user.id, name };
      setUsername(name);
      return true;
    } catch (err) {
      console.error('Join error:', err);
      setError((err instanceof Error && err.message) || 'Failed to join');
      return false;
    }
  };

  // Returns whether the message was sent
  const send = async (text: string) => {
    if (!text.trim() || !channelRef.current || !userRef.current) return false;

    try {
      await sendMessage(channelRef.current, userRef.current, text);
      setError('');
      return true;
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Failed to send message');
      return false;
    }
  };

  return { username, messages, connected, error, onlineUsers, messagesEndRef, join, send };
}

export default function Chat() {
  const { screen, setScreen, config, saveConfig, changeConfig } = useScreens();
  const [joinName, setJoinName] = useState('');
  const chat = useChat(config);

  if (screen === 'config') {
    return <ConfigScreen config={config} onSave={saveConfig} />;
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        error={chat.error}
        name={joinName}
        onNameChange={setJoinName}
        onJoin={async (name) => {
          if (await chat.join(name)) setScreen('chat');
        }}
        onChangeConfig={changeConfig}
      />
    );
  }

  return (
    <ChatRoom
      username={chat.username}
      messages={chat.messages}
      connected={chat.connected}
      error={chat.error}
      onlineUsers={chat.onlineUsers}
      messagesEndRef={chat.messagesEndRef}
      onSend={chat.send}
    />
  );
}
