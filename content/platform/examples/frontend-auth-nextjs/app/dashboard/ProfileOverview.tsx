import Link from 'next/link';
import type { VolcanoUser } from '../../lib/useVolcano';

interface ProfileProps {
  user: VolcanoUser | null;
  isAnonymous: boolean;
}

// The user's profile, metadata and account status, and links to the other examples
export default function ProfileOverview({ user, isAnonymous }: ProfileProps) {
  return (
    <>
      <h2>👤 Profile Information</h2>
      <ProfileInfo user={user} isAnonymous={isAnonymous} />
      <MetadataView user={user} />
      <AccountSecurity user={user} isAnonymous={isAnonymous} />
      <QuickActions />
    </>
  );
}

export function AnonymousWarning() {
  return (
    <div className="alert warning">
      ⚠️ <strong>Anonymous Account:</strong> Your account is temporary.{' '}
      <Link href="/anonymous" style={{ fontWeight: 'bold' }}>
        Convert to permanent account
      </Link>{' '}
      to keep your data.
    </div>
  );
}

function ProfileInfo({ user, isAnonymous }: ProfileProps) {
  return (
    <div className="user-info">
      <p>
        <strong>User ID:</strong> <code>{user?.id}</code>
      </p>
      <p>
        <strong>Email:</strong> {user?.email}
      </p>
      <p>
        <strong>Email Confirmed:</strong> {user?.email_confirmed ? '✅ Yes' : '❌ No'}
      </p>
      <p>
        <strong>Account Type:</strong> {isAnonymous ? '👤 Anonymous (temporary)' : '🔐 Authenticated (permanent)'}
      </p>
      <p>
        <strong>Status:</strong>{' '}
        <span
          style={{
            color: user?.status === 'active' ? '#28a745' : '#dc3545',
            fontWeight: 'bold',
          }}
        >
          {user?.status?.toUpperCase()}
        </span>
      </p>
      <p>
        <strong>Name:</strong> {(user?.user_metadata?.name as string) || 'Not set'}
      </p>
      <p>
        <strong>Created:</strong> {user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
      </p>
      <p>
        <strong>Last Updated:</strong> {user?.updated_at ? new Date(user.updated_at).toLocaleString() : 'N/A'}
      </p>
      {user?.last_sign_in_at && (
        <p>
          <strong>Last Sign In:</strong> {new Date(user.last_sign_in_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// Metadata Display
function MetadataView({ user }: { user: VolcanoUser | null }) {
  if (!user?.user_metadata || Object.keys(user.user_metadata).length === 0) return null;

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>📊 User Metadata</h3>
      <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
        <pre style={{ margin: 0, fontSize: '13px', background: 'transparent', padding: 0 }}>
          {JSON.stringify(user.user_metadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Account Security Status
function AccountSecurity({ user, isAnonymous }: ProfileProps) {
  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>🔒 Account Security</h3>
      <div style={{ display: 'grid', gap: '10px' }}>
        <div
          style={{
            padding: '12px',
            background: user?.email_confirmed ? '#d4edda' : '#fff3cd',
            borderRadius: '6px',
            borderLeft: `4px solid ${user?.email_confirmed ? '#28a745' : '#ffc107'}`,
          }}
        >
          <strong>{user?.email_confirmed ? '✅' : '⚠️'} Email Verification:</strong>{' '}
          {user?.email_confirmed ? 'Verified' : 'Pending'}
        </div>
        <div
          style={{
            padding: '12px',
            background: isAnonymous ? '#fff3cd' : '#d4edda',
            borderRadius: '6px',
            borderLeft: `4px solid ${isAnonymous ? '#ffc107' : '#28a745'}`,
          }}
        >
          <strong>{isAnonymous ? '⚠️' : '✅'} Account Permanence:</strong>{' '}
          {isAnonymous ? 'Temporary (convert to permanent)' : 'Permanent'}
        </div>
        <div
          style={{
            padding: '12px',
            background: '#d1ecf1',
            borderRadius: '6px',
            borderLeft: '4px solid #17a2b8',
          }}
        >
          <strong>🔑 Authentication Method:</strong> {isAnonymous ? 'Anonymous' : 'Email & Password'}
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>⚡ Quick Actions</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <Link href="/files">
          <button className="secondary" style={{ width: '100%', margin: 0 }}>
            📁 File Storage
          </button>
        </Link>
        <Link href="/password-reset">
          <button className="secondary" style={{ width: '100%', margin: 0 }}>
            🔐 Reset Password
          </button>
        </Link>
        <Link href="/email-change">
          <button className="secondary" style={{ width: '100%', margin: 0 }}>
            📧 Change Email
          </button>
        </Link>
        <Link href="/oauth-linking">
          <button className="secondary" style={{ width: '100%', margin: 0 }}>
            🔗 Link OAuth
          </button>
        </Link>
      </div>
    </div>
  );
}

export function SessionInfo() {
  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
        Your session is managed automatically by the Volcano SDK:
      </p>
      <ul style={{ marginLeft: '20px', fontSize: '14px', color: '#666' }}>
        <li>Access tokens refresh automatically</li>
        <li>Session persists across page reloads</li>
        <li>Secure token storage in localStorage</li>
      </ul>
    </div>
  );
}

export function ConvertAccountButton() {
  return (
    <div style={{ marginTop: '30px' }}>
      <Link href="/anonymous">
        <button style={{ width: '100%' }}>✨ Convert to Permanent Account</button>
      </Link>
    </div>
  );
}
