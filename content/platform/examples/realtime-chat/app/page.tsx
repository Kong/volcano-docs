'use client';

import { useState, useRef, useEffect } from 'react';
import { VolcanoAuth } from '@volcano.dev/sdk';
import { VolcanoRealtime, type PresenceInfo, type RealtimeChannel } from '@volcano.dev/sdk/realtime';

const ROOM_NAME = 'general';

interface ChatConfig {
  apiUrl: string;
  anonKey: string;
}

interface ChatMessage {
  username: string;
  text: string;
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

export default function Chat() {
  const [screen, setScreen] = useState<'config' | 'join' | 'chat'>('config');
  const [config, setConfig] = useState<ChatConfig>({ apiUrl: 'http://localhost:8000', anonKey: '' });
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [joinName, setJoinName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; username: string }>>([]);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userRef = useRef<{ id: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('volcano_config');
    if (stored) {
      const parsed: ChatConfig = JSON.parse(stored);
      setConfig(parsed);
      if (parsed.anonKey) setScreen('join');
    }
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveAndJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    
    try {
      const form = new FormData(e.currentTarget);
      const name = form.get('name') as string;
      
      // Sign up anonymously
      const volcano = new VolcanoAuth(config);
      const result = await volcano.auth.signInAnonymously({ name });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      if (!result.session || !result.user) {
        throw new Error('No session returned');
      }
      
      // Connect to realtime
      const realtime = new VolcanoRealtime({ 
        ...config, 
        accessToken: result.session.access_token 
      });
      
      realtime.onConnect(() => {
        setConnected(true);
        setError('');
      });
      realtime.onDisconnect(() => setConnected(false));
      realtime.onError(() => setError('Connection error'));
      
      await realtime.connect();
      
      // Subscribe to chat channel
      const channel = realtime.channel('chat-general');
      channel.on('message', (msg) => {
        if (isChatMessage(msg)) setMessages(m => [...m, msg]);
      });
      await channel.subscribe();
      channelRef.current = channel;
      
      // Subscribe to presence channel to track online users
      const presence = realtime.channel('chat-general', { type: 'presence' });
      
      // Fires with the full state on subscribe and on every join or leave.
      presence.onPresenceSync((state) => {
        setOnlineUsers(Object.entries(state).map(([id, info]) => ({ id, username: displayName(info) })));
      });
      
      await presence.subscribe();
      
      userRef.current = { id: result.user.id, name };
      setUsername(name);
      setScreen('chat');
    } catch (err) {
      console.error('Join error:', err);
      setError((err instanceof Error && err.message) || 'Failed to join');
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channelRef.current || !userRef.current) return;
    
    try {
      // Throws while the channel is resubscribing after a reconnect.
      await channelRef.current.send({
        userId: userRef.current.id,
        username: userRef.current.name,
        text: input,
        time: new Date().toISOString()
      });
      setError('');
      setInput('');
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Failed to send message');
    }
  };

  if (screen === 'config') {
    return (
      <div className="screen">
        <h1>🌋 Volcano Chat</h1>
        <form className="form" onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const cfg = {
            apiUrl: form.get('apiUrl') as string,
            anonKey: form.get('anonKey') as string
          };
          localStorage.setItem('volcano_config', JSON.stringify(cfg));
          setConfig(cfg);
          setScreen('join');
        }}>
          <input name="apiUrl" className="input" defaultValue={config.apiUrl} placeholder="API URL" />
          <input name="anonKey" className="input" placeholder="Anon Key" required />
          <button className="button">Continue</button>
        </form>
      </div>
    );
  }

  if (screen === 'join') {
    return (
      <div className="screen">
        <h1>🌋 Volcano Chat</h1>
        {error && <div className="alert error">{error}</div>}
        <form className="form" onSubmit={saveAndJoin}>
          <input 
            name="name" 
            className="input" 
            placeholder="Your name" 
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            required 
          />
          <button className="button">Join</button>
          <button type="button" className="button secondary" onClick={() => {
            localStorage.removeItem('volcano_config');
            setScreen('config');
          }}>
            Change Config
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar with online users */}
      <div style={{ width: '250px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--bg-tertiary)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--bg-tertiary)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🌋 Chat</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>#{ROOM_NAME}</p>
        </div>
        <div style={{ padding: '1rem', flex: 1, overflow: 'auto' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Online ({onlineUsers.length})
          </h3>
          {onlineUsers.map((user) => (
            <div key={user.id} style={{ padding: '0.5rem', marginBottom: '0.25rem', borderRadius: '8px', background: user.username === username ? 'var(--bg-tertiary)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--online)' }} />
                <span style={{ fontSize: '0.875rem' }}>{user.username}{user.username === username ? ' (you)' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
          <strong>{username}</strong>
          <span>{connected ? '🟢 Connected' : '🔴 Disconnected'}</span>
        </div>
        {error && <div className="alert error" style={{ margin: '1rem 1rem 0' }}>{error}</div>}
        
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '1rem' }}>
              <strong>{msg.username}:</strong> {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={send} style={{ padding: '1rem', background: 'var(--bg-secondary)', display: 'flex', gap: '0.5rem' }}>
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            style={{ flex: 1 }}
          />
          <button className="button" disabled={!connected}>Send</button>
        </form>
      </div>
    </div>
  );
}
