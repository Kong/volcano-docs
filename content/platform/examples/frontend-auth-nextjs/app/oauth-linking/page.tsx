'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVolcano, VolcanoUser } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

interface LinkedProvider {
  provider: string;
  linked_at: string;
}

export default function OAuthLinkingPage() {
  const router = useRouter();
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('success');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (!volcano) return;

      try {
        // Get current user
        const { user: currentUser, error } = await volcano.auth.getUser();
        if (error || !currentUser) {
          router.push('/auth');
        } else {
          setUser(currentUser);
        }
      } catch {
        // Server unreachable
        router.push('/auth');
      }
    };

    loadUser();
  }, [volcano, router]);

  // Load linked providers when user is set
  useEffect(() => {
    const loadProviders = async () => {
      if (!volcano) return;
      try {
        const providers = await volcano.auth.getLinkedOAuthProviders();
        setLinkedProviders(providers);
      } catch {
        // Silently fail - user will see empty providers list
      }
    };

    if (user && volcano) {
      loadProviders();
    }
  }, [user, volcano]);

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

  const loadLinkedProviders = async () => {
    if (!volcano) return;

    try {
      const providers = await volcano.auth.getLinkedOAuthProviders();
      setLinkedProviders(providers);
    } catch {
      // Silently fail - user will see empty providers list
    }
  };

  const handleLinkProvider = async (provider: string) => {
    if (!volcano) return;

    setLoading(true);
    setMessage('');

    try {
      const { authorization_url } = await volcano.auth.linkOAuthProvider(provider);
      setMessage(`Redirecting to ${provider}...`);
      setMessageType('info');
      
      // Redirect to OAuth provider
      window.location.href = authorization_url;
    } catch (error) {
      setMessage((error as Error).message || `Failed to link ${provider}`);
      setMessageType('error');
      setLoading(false);
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    if (!volcano) return;
    if (!confirm(`Are you sure you want to unlink ${provider}?`)) return;

    setLoading(true);
    setMessage('');

    try {
      await volcano.auth.unlinkOAuthProvider(provider);
      setMessage(`${provider} unlinked successfully`);
      setMessageType('success');
      loadLinkedProviders();
    } catch (error) {
      setMessage((error as Error).message || `Failed to unlink ${provider}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const providers = [
    { id: 'google', name: 'Google', icon: '🔵', color: '#4285f4' },
    { id: 'github', name: 'GitHub', icon: '⚫', color: '#333' },
    { id: 'microsoft', name: 'Microsoft', icon: '🔷', color: '#00a4ef' },
    { id: 'apple', name: 'Apple', icon: '🍎', color: '#000' },
  ];

  const isLinked = (providerId: string): boolean => {
    return linkedProviders.some((p: LinkedProvider) => p.provider === providerId);
  };

  return (
    <div className="container">
      <nav>
        <h1>🌋 Volcano Auth</h1>
        <div className="nav-links">
          <Link href="/">← Back to Examples</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1>🔗 Link OAuth Providers</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Connect your account with Google, GitHub, and other providers
        </p>

        {user && (
          <div className="user-info" style={{ marginBottom: '20px' }}>
            <p><strong>Signed in as:</strong> {user.email}</p>
            <p><strong>Account Type:</strong> {user.user_metadata?.anonymous ? 'Anonymous' : 'Authenticated'}</p>
          </div>
        )}

        {message && (
          <div className={`alert ${messageType}`}>
            {message}
          </div>
        )}

        <h2>Available Providers</h2>
        <div className="alert info" style={{ fontSize: '13px', marginBottom: '20px' }}>
          💡 <strong>Why link providers?</strong><br />
          • Sign in with multiple methods<br />
          • No need to remember passwords<br />
          • Faster login on other devices
        </div>

        <div style={{ display: 'grid', gap: '15px' }}>
          {providers.map((provider) => {
            const linked = isLinked(provider.id);
            
            return (
              <div
                key={provider.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: linked ? '2px solid #28a745' : '2px solid #e0e0e0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '24px' }}>{provider.icon}</span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{provider.name}</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {linked ? '✓ Linked' : 'Not linked'}
                    </div>
                  </div>
                </div>

                {linked ? (
                  <button
                    onClick={() => handleUnlinkProvider(provider.id)}
                    disabled={loading}
                    className="danger"
                    style={{
                      width: 'auto',
                      padding: '8px 20px',
                      fontSize: '14px',
                      margin: 0
                    }}
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    onClick={() => handleLinkProvider(provider.id)}
                    disabled={loading}
                    style={{
                      width: 'auto',
                      padding: '8px 20px',
                      fontSize: '14px',
                      margin: 0,
                      background: provider.color
                    }}
                  >
                    Link {provider.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {linkedProviders.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h2>Your Linked Providers</h2>
            <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '8px' }}>
              {linkedProviders.map((provider: LinkedProvider, index: number) => (
                <div key={index} style={{ marginBottom: index < linkedProviders.length - 1 ? '10px' : '0' }}>
                  <p style={{ fontSize: '14px' }}>
                    <strong>{provider.provider}:</strong> Linked on {new Date(provider.linked_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="alert warning" style={{ marginTop: '30px', fontSize: '13px' }}>
          <strong>⚠️ Note:</strong> To use OAuth linking, you must:
          <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
            <li>Configure OAuth providers in your Volcano project</li>
            <li>Set up client ID and client secret for each provider</li>
            <li>Configure redirect URLs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

