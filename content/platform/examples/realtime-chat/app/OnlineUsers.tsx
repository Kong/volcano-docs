import type { OnlineUser } from './types';

const ROOM_NAME = 'general';

interface OnlineUsersProps {
  onlineUsers: OnlineUser[];
  username: string;
}

// Sidebar with online users
export default function OnlineUsers({ onlineUsers, username }: OnlineUsersProps) {
  return (
    <div
      style={{
        width: '250px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--bg-tertiary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--bg-tertiary)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🌋 Chat</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>#{ROOM_NAME}</p>
      </div>
      <div style={{ padding: '1rem', flex: 1, overflow: 'auto' }}>
        <h3
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
          }}
        >
          Online ({onlineUsers.length})
        </h3>
        {onlineUsers.map((user) => (
          <OnlineUserRow key={user.id} user={user} isYou={user.username === username} />
        ))}
      </div>
    </div>
  );
}

interface OnlineUserRowProps {
  user: OnlineUser;
  isYou: boolean;
}

function OnlineUserRow({ user, isYou }: OnlineUserRowProps) {
  return (
    <div
      style={{
        padding: '0.5rem',
        marginBottom: '0.25rem',
        borderRadius: '8px',
        background: isYou ? 'var(--bg-tertiary)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--online)' }} />
        <span style={{ fontSize: '0.875rem' }}>
          {user.username}
          {isYou ? ' (you)' : ''}
        </span>
      </div>
    </div>
  );
}
