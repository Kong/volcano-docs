'use client';

import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import { RequestResetForm, ResetPasswordForm, StepTabs } from './ResetForms';
import { usePasswordReset } from './usePasswordReset';

export default function PasswordResetPage() {
  const { volcano, configured, loading: sdkLoading, passwordPolicy, passwordPolicyError, reload } = useVolcano();
  const reset = usePasswordReset(volcano, passwordPolicy, passwordPolicyError);
  const { step, setStep, message, messageType } = reset;

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading) {
    return <LoadingScreen text="Loading..." />;
  }

  return (
    <div className="container">
      <PageNav>
        <Link href="/">← Back to Examples</Link>
      </PageNav>

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1>🔐 Password Recovery</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          {step === 'request' ? 'Reset your password via email' : 'Enter your new password'}
        </p>

        {/* Tab Toggle */}
        <StepTabs step={step} onChange={setStep} />

        {message && <div className={`alert ${messageType}`}>{message}</div>}

        {step === 'request' && <RequestResetForm reset={reset} />}

        {step === 'reset' && <ResetPasswordForm reset={reset} passwordPolicy={passwordPolicy} />}
      </div>
    </div>
  );
}
