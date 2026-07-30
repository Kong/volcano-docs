'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVolcano, validatePasswordAgainstPolicy, VolcanoUser } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

export default function AnonymousPage() {
  const router = useRouter();
  const { volcano, configured, loading: sdkLoading, passwordPolicy, passwordPolicyError, reload } = useVolcano();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [anonName, setAnonName] = useState('');
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPassword, setConvertPassword] = useState('');
  const [convertName, setConvertName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('success');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      if (!volcano) return;

      try {
        const { user: currentUser } = await volcano.initialize();
        if (currentUser) {
          setUser(currentUser);
          const isAnonymous = currentUser.user_metadata?.anonymous === true;
          setStep(isAnonymous ? 2 : 4);
        }
      } catch {
        // Server unreachable - stay on step 1
      }
    };

    checkUser();
  }, [volcano]);

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

  const signUpAnonymous = async () => {
    if (!volcano) return;

    setLoading(true);
    setMessage('');

    try {
      const metadata = anonName ? { name: anonName, anonymous: true } : { anonymous: true };
      const { user: anonUser, error } = await volcano.auth.signUpAnonymous(metadata);
      
      if (error) {
        throw error;
      }

      setUser(anonUser);
      setMessage('✓ Signed in as anonymous user!');
      setMessageType('success');
      setStep(2);
    } catch (error) {
      setMessage((error as Error).message || 'Failed to create anonymous user');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const convertToAuthenticated = async () => {
    if (!volcano) return;

    if (!convertEmail || !convertPassword) {
      setMessage('Please fill in email and password');
      setMessageType('error');
      return;
    }

    if (!passwordPolicy) {
      setMessage(passwordPolicyError || 'Password policy is temporarily unavailable');
      setMessageType('error');
      return;
    }

    const passwordValidationError = validatePasswordAgainstPolicy(convertPassword, passwordPolicy);
    if (passwordValidationError) {
      setMessage(passwordValidationError);
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const metadata = convertName ? { name: convertName } : {};
      const { user: convertedUser, error } = await volcano.auth.convertAnonymous({
        email: convertEmail,
        password: convertPassword,
        metadata
      });

      if (error) throw error;

      setUser(convertedUser);
      setMessage('🎉 Account converted! Redirecting to dashboard...');
      setMessageType('success');
      setStep(4);
      // Redirect to dashboard after successful conversion
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (error) {
      setMessage((error as Error).message || 'Conversion failed');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!volcano) return;

    await volcano.auth.signOut();
    setUser(null);
    setStep(1);
    setAnonName('');
    setConvertEmail('');
    setConvertPassword('');
    setConvertName('');
    setMessage('');
  };

  return (
    <div className="container">
      <nav>
        <h1>🌋 Volcano Auth</h1>
        <div className="nav-links">
          <Link href="/">← Back to Examples</Link>
          {user && <button onClick={signOut} className="secondary">Sign Out</button>}
        </div>
      </nav>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1>👤 Anonymous User Conversion</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Try your app without signup, then upgrade to keep your data
        </p>

        {/* Step 1: Start as Anonymous */}
        {step === 1 && (
          <div>
            <h2>Step 1: Start as Anonymous User</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              No email or password required. Try the app instantly!
            </p>

            {message && <div className={`alert ${messageType}`}>{message}</div>}

            <div className="form-group">
              <label htmlFor="anonName">Name (optional)</label>
              <input
                type="text"
                id="anonName"
                value={anonName}
                onChange={(e) => setAnonName(e.target.value)}
                placeholder="e.g., Guest User"
              />
            </div>

            <button onClick={signUpAnonymous} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating...' : '🚀 Start as Anonymous'}
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Already have an account?{' '}
                <Link href="/auth" style={{ color: '#667eea', fontWeight: '500' }}>
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Anonymous User Info */}
        {step === 2 && user && (
          <div>
            <h2>Step 2: You're Signed In (Anonymous)</h2>

            <div className="user-info">
              <p><strong>User ID:</strong> <code>{user.id}</code></p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Type:</strong> Anonymous (temporary)</p>
              <p><strong>Name:</strong> {(user.user_metadata?.name as string) || 'Not set'}</p>
            </div>

            <div className="alert info">
              💡 <strong>You're browsing anonymously.</strong> Your data is temporary.
              Convert to a permanent account below to keep your data forever!
            </div>

            <button onClick={() => setStep(3)} style={{ width: '100%' }}>
              ✨ Upgrade to Permanent Account
            </button>

            <button onClick={signOut} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
              🚪 Sign Out
            </button>
          </div>
        )}

        {/* Step 3: Conversion Form */}
        {step === 3 && (
          <div>
            <h2>Step 3: Create Your Permanent Account</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Add email and password to keep your data and access it from anywhere.
            </p>

            {message && <div className={`alert ${messageType}`}>{message}</div>}

            <div className="form-group">
              <label htmlFor="convertEmail">Email Address</label>
              <input
                type="email"
                id="convertEmail"
                value={convertEmail}
                onChange={(e) => setConvertEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="convertPassword">Password</label>
              <input
                type="password"
                id="convertPassword"
                value={convertPassword}
                onChange={(e) => setConvertPassword(e.target.value)}
                placeholder={passwordPolicy ? `${passwordPolicy.effective_min_length}-${passwordPolicy.max_length} characters` : 'Password policy unavailable'}
                disabled={!passwordPolicy}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="convertName">Update Name (optional)</label>
              <input
                type="text"
                id="convertName"
                value={convertName}
                onChange={(e) => setConvertName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <button onClick={convertToAuthenticated} disabled={loading || !passwordPolicy} style={{ width: '100%' }}>
              {loading ? 'Converting...' : '🎉 Create Permanent Account'}
            </button>

            <button onClick={() => setStep(2)} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
              ← Back
            </button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && user && (
          <div>
            <h2>✓ Account Created!</h2>

            <div className="alert success">
              🎉 <strong>Success!</strong> Your {user.user_metadata?.anonymous ? 'anonymous ' : ''}account is now permanent.
              All your data has been preserved!
            </div>

            <div className="user-info">
              <p><strong>User ID:</strong> <code>{user.id}</code></p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Type:</strong> Authenticated (permanent)</p>
              <p><strong>Name:</strong> {(user.user_metadata?.name as string) || 'Not set'}</p>
            </div>

            <div className="alert info" style={{ marginTop: '20px' }}>
              <strong>What changed:</strong><br />
              • Same user ID (your data is intact)<br />
              • You now have email: <code>{user.email}</code><br />
              • You can sign in from any device<br />
              • Your account is permanent
            </div>

            <Link href="/dashboard">
              <button style={{ width: '100%', marginTop: '20px' }}>
                🏠 Go to Dashboard
              </button>
            </Link>

            <button onClick={signOut} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
              🚪 Sign Out (Try Signing Back In!)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
