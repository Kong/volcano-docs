'use client';

import { useState, type RefObject } from 'react';
import OnlineUsers from './OnlineUsers';
import type { ChatMessage, OnlineUser } from './types';

interface ChatRoomProps {
  username: string;
  messages: ChatMessage[];
  connected: boolean;
  error: string;
  onlineUsers: OnlineUser[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSend: (text: string) => Promise<boolean>;
}

export default function ChatRoom({
  username,
  messages,
  connected,
  error,
  onlineUsers,
  messagesEndRef,
  onSend,
}: ChatRoomProps) {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <OnlineUsers onlineUsers={onlineUsers} username={username} />

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '1rem',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--bg-tertiary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <strong>{username}</strong>
          <span>{connected ? '🟢 Connected' : '🔴 Disconnected'}</span>
        </div>
        {error && (
          <div className="alert error" style={{ margin: '1rem 1rem 0' }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '1rem' }}>
              <strong>{msg.username}:</strong> {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <MessageForm connected={connected} onSend={onSend} />
      </div>
    </div>
  );
}

interface MessageFormProps {
  connected: boolean;
  onSend: (text: string) => Promise<boolean>;
}

// Clears the input once the message is sent
function MessageForm({ connected, onSend }: MessageFormProps) {
  const [input, setInput] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await onSend(input)) setInput('');
  };

  return (
    <form
      onSubmit={send}
      style={{ padding: '1rem', background: 'var(--bg-secondary)', display: 'flex', gap: '0.5rem' }}
    >
      <input
        className="input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Message..."
        style={{ flex: 1 }}
      />
      <button className="button" disabled={!connected}>
        Send
      </button>
    </form>
  );
}
