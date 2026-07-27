'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

export default function PasswordResetPage() {
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('success');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if token in URL (from email link)
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setStep('reset');
    }
  }, []);

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

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volcano) return;

    setLoading(true);
    setMessage('');

    try {
      const { message: responseMessage } = await volcano.auth.forgotPassword(email);
      setMessage(responseMessage || 'If the email exists, a password reset link has been sent');
      setMessageType('success');
      setEmail('');
    } catch (error) {
      setMessage((error as Error).message || 'Failed to request password reset');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volcano) return;

    if (!token || !newPassword) {
      setMessage('Please fill in all fields');
      setMessageType('error');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { message: responseMessage } = await volcano.auth.resetPassword({
        token,
        newPassword
      });
      
      setMessage(responseMessage || 'Password reset successfully! You can now sign in with your new password.');
      setMessageType('success');
      setToken('');
      setNewPassword('');
      
      // Redirect to auth page after success
      setTimeout(() => {
        window.location.href = '/auth';
      }, 2000);
    } catch (error) {
      setMessage((error as Error).message || 'Failed to reset password');
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
        </div>
      </nav>

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1>🔐 Password Recovery</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          {step === 'request' ? 'Reset your password via email' : 'Enter your new password'}
        </p>

        {/* Tab Toggle */}
        <div style={{ 
          display: 'flex', 
          marginBottom: '30px',
          borderBottom: '2px solid #f0f0f0'
        }}>
          <button
            type="button"
            onClick={() => setStep('request')}
            style={{
              flex: 1,
              background: step === 'request' ? '#667eea' : 'transparent',
              color: step === 'request' ? 'white' : '#666',
              borderRadius: '0',
              borderBottom: step === 'request' ? '3px solid #667eea' : 'none',
              marginBottom: '-2px'
            }}
          >
            Request Reset
          </button>
          <button
            type="button"
            onClick={() => setStep('reset')}
            style={{
              flex: 1,
              background: step === 'reset' ? '#667eea' : 'transparent',
              color: step === 'reset' ? 'white' : '#666',
              borderRadius: '0',
              borderBottom: step === 'reset' ? '3px solid #667eea' : 'none',
              marginBottom: '-2px'
            }}
          >
            Reset Password
          </button>
        </div>

        {message && (
          <div className={`alert ${messageType}`}>
            {message}
          </div>
        )}

        {/* Request Reset Form */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset}>
            <div className="alert info">
              📧 Enter your email address and we'll send you a link to reset your password.
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Sending...' : '📧 Send Reset Link'}
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Link href="/auth" style={{ color: '#667eea', fontSize: '14px' }}>
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}

        {/* Reset Password Form */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div className="alert info">
              🔑 Enter the token from your email and your new password.
            </div>

            <div className="form-group">
              <label htmlFor="token">Recovery Token</label>
              <input
                type="text"
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token from email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Resetting...' : '🔐 Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

