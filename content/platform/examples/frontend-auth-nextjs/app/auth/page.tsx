'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVolcano, validatePasswordAgainstPolicy } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

export default function AuthPage() {
  const router = useRouter();
  const { volcano, configured, loading: sdkLoading, passwordPolicy, passwordPolicyError, reload } = useVolcano();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      if (!volcano) return;

      try {
        const { user } = await volcano.initialize();
        if (user) {
          router.push('/dashboard');
        }
      } catch {
        // Server unreachable or session invalid - stay on auth page
      }
    };

    checkUser();
  }, [volcano, router]);

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="loading" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading SDK...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volcano) return;

    if (mode === 'signup') {
      if (!passwordPolicy) {
        setMessage(passwordPolicyError || 'Password policy is temporarily unavailable');
        setMessageType('error');
        return;
      }
      const passwordValidationError = validatePasswordAgainstPolicy(password, passwordPolicy);
      if (passwordValidationError) {
        setMessage(passwordValidationError);
        setMessageType('error');
        return;
      }
    }

    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        await volcano.auth.signUp({
          email,
          password,
          metadata: name ? { name } : {}
        });
        setMessage(`Account created! Redirecting to dashboard...`);
        setMessageType('success');
        // Redirect immediately after successful signup
        router.push('/dashboard');
      } else {
        await volcano.auth.signIn({
          email,
          password
        });
        setMessage(`Welcome back! Redirecting...`);
        setMessageType('success');
        // Redirect immediately after successful signin
        router.push('/dashboard');
      }
    } catch (error) {
      setMessage((error as Error).message || 'Authentication failed');
      setMessageType('error');
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
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          {mode === 'signup' ? 'Join with your email and password' : 'Welcome back!'}
        </p>

        {/* Tab Toggle */}
        <div style={{ 
          display: 'flex', 
          marginBottom: '30px',
          borderBottom: '2px solid #f0f0f0'
        }}>
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={{
              flex: 1,
              background: mode === 'signup' ? '#667eea' : 'transparent',
              color: mode === 'signup' ? 'white' : '#666',
              borderRadius: '0',
              borderBottom: mode === 'signup' ? '3px solid #667eea' : 'none',
              marginBottom: '-2px'
            }}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => setMode('signin')}
            style={{
              flex: 1,
              background: mode === 'signin' ? '#667eea' : 'transparent',
              color: mode === 'signin' ? 'white' : '#666',
              borderRadius: '0',
              borderBottom: mode === 'signin' ? '3px solid #667eea' : 'none',
              marginBottom: '-2px'
            }}
          >
            Sign In
          </button>
        </div>

        {message && (
          <div className={`alert ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup'
                ? (passwordPolicy ? `${passwordPolicy.effective_min_length}-${passwordPolicy.max_length} characters` : 'Password policy unavailable')
                : 'Your password'}
              disabled={mode === 'signup' && !passwordPolicy}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="name">Name (optional)</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !passwordPolicy)}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {loading ? (
              <>
                <span className="loading"></span> Processing...
              </>
            ) : (
              mode === 'signup' ? '🚀 Create Account' : '🔑 Sign In'
            )}
          </button>
        </form>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Link href="/anonymous">
            <button className="secondary" style={{ width: '100%' }}>
              👤 Try as Anonymous User
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
