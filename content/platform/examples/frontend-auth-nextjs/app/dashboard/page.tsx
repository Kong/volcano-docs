'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVolcano, VolcanoUser } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

interface MetadataField {
  key: string;
  value: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatePassword, setUpdatePassword] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [customMetadata, setCustomMetadata] = useState<MetadataField[]>([]);
  const [newMetadataKey, setNewMetadataKey] = useState('');
  const [newMetadataValue, setNewMetadataValue] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      if (!volcano) return;

      try {
        const { user: currentUser, error } = await volcano.auth.getUser();
        if (error || !currentUser) {
          // User not authenticated or session invalid
          router.push('/auth');
        } else {
          setUser(currentUser);
          setUpdateName((currentUser.user_metadata?.name as string) || '');
          // Load custom metadata (exclude reserved fields)
          const reservedKeys = ['name', 'anonymous', 'avatar_url'];
          const customFields = Object.entries(currentUser.user_metadata || {})
            .filter(([key]) => !reservedKeys.includes(key))
            .map(([key, value]) => ({ key, value: String(value) }));
          setCustomMetadata(customFields);
        }
      } catch (error) {
        // Handle cases where user was deleted/banned
        const errorMessage = (error as Error).message || '';
        const lowerMessage = errorMessage.toLowerCase();
        
        if (lowerMessage.includes('no longer exists') || lowerMessage.includes('banned') || 
            lowerMessage.includes('account is')) {
          // User was deleted or banned - sign out and redirect
          console.log('User account is no longer accessible:', errorMessage);
          await volcano.auth.signOut();
          router.push('/auth');
        } else {
          // Other errors
          router.push('/auth');
        }
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [volcano, router]);

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="loading" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volcano) return;

    setLoading(true);
    setMessage('');

    try {
      const updates: Record<string, unknown> = {};
      if (updatePassword) updates.password = updatePassword;

      // Build metadata object with name and custom fields
      const metadata: Record<string, unknown> = {};
      if (updateName) metadata.name = updateName;

      // Add custom metadata fields
      customMetadata.forEach(field => {
        if (field.key.trim()) {
          metadata[field.key.trim()] = field.value;
        }
      });

      // Preserve anonymous flag if it exists
      if (user?.user_metadata?.anonymous) {
        metadata.anonymous = true;
      }

      if (Object.keys(metadata).length > 0) {
        updates.metadata = metadata;
      }

      const { user: updatedUser } = await volcano.auth.updateUser(updates);
      setUser(updatedUser);
      setMessage('Profile updated successfully!');
      setMessageType('success');
      setUpdatePassword('');
    } catch (error) {
      const errorMessage = (error as Error).message || 'Update failed';
      const lowerMessage = errorMessage.toLowerCase();
      
      // Check if user was deleted or banned
      if (lowerMessage.includes('no longer exists') || lowerMessage.includes('banned') ||
          lowerMessage.includes('account is')) {
        // Determine the reason from the error message
        let reason = 'removed';
        if (lowerMessage.includes('banned')) {
          reason = 'banned';
        } else if (lowerMessage.includes('no longer exists')) {
          reason = 'deleted';
        }
        
        setMessage(`Your account has been ${reason}. You will be signed out.`);
        setMessageType('error');
        
        // Sign out after a brief delay to show the message
        setTimeout(async () => {
          await volcano.auth.signOut();
          router.push('/auth');
        }, 2000);
        return;
      }
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!volcano) return;

    await volcano.auth.signOut();
    router.push('/');
  };

  const addMetadataField = () => {
    if (!newMetadataKey.trim()) return;
    // Check if key already exists
    if (customMetadata.some(f => f.key === newMetadataKey.trim())) {
      setMessage('Metadata key already exists');
      setMessageType('error');
      return;
    }
    setCustomMetadata([...customMetadata, { key: newMetadataKey.trim(), value: newMetadataValue }]);
    setNewMetadataKey('');
    setNewMetadataValue('');
  };

  const removeMetadataField = (index: number) => {
    setCustomMetadata(customMetadata.filter((_, i) => i !== index));
  };

  const updateMetadataField = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = [...customMetadata];
    updated[index] = { ...updated[index], [field]: newValue };
    setCustomMetadata(updated);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="loading" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const isAnonymous = user?.user_metadata?.anonymous === true;

  return (
    <div className="container">
      <nav>
        <h1>🌋 Volcano Auth</h1>
        <div className="nav-links">
          <Link href="/">← Back to Examples</Link>
          <button onClick={handleSignOut} className="secondary">Sign Out</button>
        </div>
      </nav>

      <div className="card">
        <h1>🏠 User Dashboard</h1>
        
        {isAnonymous && (
          <div className="alert warning">
            ⚠️ <strong>Anonymous Account:</strong> Your account is temporary.{' '}
            <Link href="/anonymous" style={{ fontWeight: 'bold' }}>
              Convert to permanent account
            </Link>{' '}
            to keep your data.
          </div>
        )}

        <h2>👤 Profile Information</h2>
        <div className="user-info">
          <p><strong>User ID:</strong> <code>{user?.id}</code></p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Email Confirmed:</strong> {user?.email_confirmed ? '✅ Yes' : '❌ No'}</p>
          <p><strong>Account Type:</strong> {isAnonymous ? '👤 Anonymous (temporary)' : '🔐 Authenticated (permanent)'}</p>
          <p><strong>Status:</strong> <span style={{
            color: user?.status === 'active' ? '#28a745' : '#dc3545',
            fontWeight: 'bold'
          }}>{user?.status?.toUpperCase()}</span></p>
          <p><strong>Name:</strong> {(user?.user_metadata?.name as string) || 'Not set'}</p>
          <p><strong>Created:</strong> {user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</p>
          <p><strong>Last Updated:</strong> {user?.updated_at ? new Date(user.updated_at).toLocaleString() : 'N/A'}</p>
          {user?.last_sign_in_at && (
            <p><strong>Last Sign In:</strong> {new Date(user.last_sign_in_at).toLocaleString()}</p>
          )}
        </div>

        {/* Metadata Display */}
        {user?.user_metadata && Object.keys(user.user_metadata).length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>📊 User Metadata</h3>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <pre style={{ margin: 0, fontSize: '13px', background: 'transparent', padding: 0 }}>
                {JSON.stringify(user.user_metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Account Security Status */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>🔒 Account Security</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ 
              padding: '12px', 
              background: user?.email_confirmed ? '#d4edda' : '#fff3cd',
              borderRadius: '6px',
              borderLeft: `4px solid ${user?.email_confirmed ? '#28a745' : '#ffc107'}`
            }}>
              <strong>{user?.email_confirmed ? '✅' : '⚠️'} Email Verification:</strong> {user?.email_confirmed ? 'Verified' : 'Pending'}
            </div>
            <div style={{ 
              padding: '12px', 
              background: isAnonymous ? '#fff3cd' : '#d4edda',
              borderRadius: '6px',
              borderLeft: `4px solid ${isAnonymous ? '#ffc107' : '#28a745'}`
            }}>
              <strong>{isAnonymous ? '⚠️' : '✅'} Account Permanence:</strong> {isAnonymous ? 'Temporary (convert to permanent)' : 'Permanent'}
            </div>
            <div style={{ 
              padding: '12px', 
              background: '#d1ecf1',
              borderRadius: '6px',
              borderLeft: '4px solid #17a2b8'
            }}>
              <strong>🔑 Authentication Method:</strong> {isAnonymous ? 'Anonymous' : 'Email & Password'}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
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

        {message && (
          <div className={`alert ${messageType}`}>
            {message}
          </div>
        )}

        <h2>Update Profile</h2>
        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label htmlFor="updateName">Name</label>
            <input
              type="text"
              id="updateName"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="updatePassword">Change Password (leave empty to keep current)</label>
            <input
              type="password"
              id="updatePassword"
              value={updatePassword}
              onChange={(e) => setUpdatePassword(e.target.value)}
              placeholder="New password (min. 6 characters)"
            />
          </div>

          {/* Custom Metadata Section */}
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>📝 Custom Metadata</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              Add custom key-value pairs to store additional user information.
            </p>

            {/* Existing metadata fields */}
            {customMetadata.map((field, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                  placeholder="Key"
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                  placeholder="Value"
                  style={{ flex: 2 }}
                />
                <button
                  type="button"
                  onClick={() => removeMetadataField(index)}
                  className="secondary"
                  style={{ padding: '8px 12px', margin: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add new metadata field */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
              <input
                type="text"
                value={newMetadataKey}
                onChange={(e) => setNewMetadataKey(e.target.value)}
                placeholder="New key"
                style={{ flex: 1 }}
              />
              <input
                type="text"
                value={newMetadataValue}
                onChange={(e) => setNewMetadataValue(e.target.value)}
                placeholder="Value"
                style={{ flex: 2 }}
              />
              <button
                type="button"
                onClick={addMetadataField}
                className="secondary"
                style={{ padding: '8px 12px', margin: 0 }}
              >
                + Add
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Updating...' : '💾 Update Profile'}
          </button>
        </form>

        <h2>Session Information</h2>
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

        {isAnonymous && (
          <div style={{ marginTop: '30px' }}>
            <Link href="/anonymous">
              <button style={{ width: '100%' }}>
                ✨ Convert to Permanent Account
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

