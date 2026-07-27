'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVolcano, VolcanoUser } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

export default function EmailChangePage() {
  const router = useRouter();
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeToken, setEmailChangeToken] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
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
          return;
        }
        setUser(currentUser);
        // Check if there's a pending email change
        if (currentUser.email_change) {
          setPendingEmail(currentUser.email_change);
        }
      } catch {
        // Server unreachable
        router.push('/auth');
        return;
      }

      // Check URL for token (from email link)
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        setEmailChangeToken(tokenParam);
        setStep('confirm');
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

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volcano) return;

    setLoading(true);
    setMessage('');

    try {
      const result = await volcano.auth.requestEmailChange(newEmail);
      
      if (result.error) {
        throw result.error;
      }

      setPendingEmail(result.newEmail);
      setMessage(result.message || 'Confirmation email sent to new address');
      setMessageType('info');
      
      // If we got a token (dev mode), show it
      if (result.emailChangeToken) {
        setEmailChangeToken(result.emailChangeToken);
        setStep('confirm');
        setMessage(`Dev Mode: Token is ${result.emailChangeToken}`);
      }
    } catch (error) {
      setMessage((error as Error).message || 'Failed to request email change');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volcano) return;

    setLoading(true);
    setMessage('');

    try {
      const { user: updatedUser, error } = await volcano.auth.confirmEmailChange(emailChangeToken);
      
      if (error) {
        throw error;
      }

      setUser(updatedUser);
      setMessage(`Email changed successfully to ${updatedUser.email}!`);
      setMessageType('success');
      setPendingEmail('');
      setEmailChangeToken('');
      
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (error) {
      setMessage((error as Error).message || 'Failed to confirm email change');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelChange = async () => {
    if (!volcano) return;

    setLoading(true);

    try {
      const { error } = await volcano.auth.cancelEmailChange();
      
      if (error) {
        throw error;
      }

      setPendingEmail('');
      setMessage('Email change cancelled');
      setMessageType('info');
    } catch (error) {
      setMessage((error as Error).message || 'Failed to cancel');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
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

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1>📧 Change Email Address</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Update your email address securely
        </p>

        {user && (
          <div className="user-info" style={{ marginBottom: '20px' }}>
            <p><strong>Current Email:</strong> {user.email}</p>
            {pendingEmail && (
              <p style={{ color: '#856404' }}>
                <strong>Pending Change:</strong> {pendingEmail}
              </p>
            )}
          </div>
        )}

        {message && (
          <div className={`alert ${messageType}`}>
            {message}
          </div>
        )}

        {/* Request Email Change */}
        {step === 'request' && (
          <div>
            <h2>Request Email Change</h2>

            {pendingEmail && (
              <div className="alert warning">
                ⚠️ You have a pending email change to <strong>{pendingEmail}</strong>.{' '}
                <button
                  onClick={handleCancelChange}
                  style={{
                    background: 'transparent',
                    color: '#856404',
                    textDecoration: 'underline',
                    padding: '0',
                    margin: '0',
                    width: 'auto'
                  }}
                >
                  Cancel it
                </button>{' '}
                to request a new one.
              </div>
            )}

            <form onSubmit={handleRequestChange}>
              <div className="form-group">
                <label htmlFor="newEmail">New Email Address</label>
                <input
                  type="email"
                  id="newEmail"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  required
                  disabled={!!pendingEmail}
                />
              </div>

              <div className="alert info" style={{ fontSize: '13px' }}>
                📧 A confirmation link will be sent to your new email address.
                Click the link to complete the email change.
              </div>

              <button type="submit" disabled={loading || !!pendingEmail} style={{ width: '100%' }}>
                {loading ? 'Sending...' : '📨 Send Confirmation Email'}
              </button>

              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="secondary"
                style={{ width: '100%', marginTop: '10px' }}
              >
                I Have a Confirmation Token →
              </button>
            </form>
          </div>
        )}

        {/* Confirm Email Change */}
        {step === 'confirm' && (
          <div>
            <h2>Confirm Email Change</h2>

            <form onSubmit={handleConfirmChange}>
              <div className="form-group">
                <label htmlFor="emailChangeToken">Confirmation Token</label>
                <input
                  type="text"
                  id="emailChangeToken"
                  value={emailChangeToken}
                  onChange={(e) => setEmailChangeToken(e.target.value)}
                  placeholder="Token from email"
                  required
                />
              </div>

              <div className="alert info" style={{ fontSize: '13px' }}>
                🔑 Enter the token from the confirmation email sent to your new address.
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Confirming...' : '✓ Confirm Email Change'}
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className="secondary"
                style={{ width: '100%', marginTop: '10px' }}
              >
                ← Back to Request
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

