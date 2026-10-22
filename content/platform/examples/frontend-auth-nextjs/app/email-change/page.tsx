'use client';

import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import { ConfirmForm, CurrentEmail, RequestForm } from './EmailChangeForms';
import { useEmailChange } from './useEmailChange';

export default function EmailChangePage() {
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const emailChange = useEmailChange(volcano);
  const { step, user, pendingEmail, message, messageType } = emailChange;

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
        <Link href="/dashboard">Dashboard</Link>
      </PageNav>

      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1>📧 Change Email Address</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>Update your email address securely</p>

        {user && <CurrentEmail user={user} pendingEmail={pendingEmail} />}

        {message && <div className={`alert ${messageType}`}>{message}</div>}

        {step === 'request' && <RequestForm emailChange={emailChange} />}

        {step === 'confirm' && <ConfirmForm emailChange={emailChange} />}
      </div>
    </div>
  );
}
