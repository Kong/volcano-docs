'use client';

import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import AuthForm, { ModeTabs } from './AuthForm';
import { useAuthForm } from './useAuthForm';

export default function AuthPage() {
  const { volcano, configured, loading: sdkLoading, passwordPolicy, passwordPolicyError, reload } = useVolcano();
  const { mode, setMode, message, messageType, loading, handleSubmit } = useAuthForm(
    volcano,
    passwordPolicy,
    passwordPolicyError,
  );

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading) {
    return <LoadingScreen text="Loading SDK..." />;
  }

  return (
    <div className="container">
      <PageNav>
        <Link href="/">← Back to Examples</Link>
      </PageNav>

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          {mode === 'signup' ? 'Join with your email and password' : 'Welcome back!'}
        </p>

        {/* Tab Toggle */}
        <ModeTabs mode={mode} onChange={setMode} />

        {message && <div className={`alert ${messageType}`}>{message}</div>}

        <AuthForm mode={mode} loading={loading} passwordPolicy={passwordPolicy} onSubmit={handleSubmit} />

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
