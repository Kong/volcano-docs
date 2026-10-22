'use client';

import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import { AnonymousUserStep, ConvertedStep, ConvertStep, StartStep } from './Steps';
import { useAnonymousFlow } from './useAnonymousFlow';

export default function AnonymousPage() {
  const { volcano, configured, loading: sdkLoading, passwordPolicy, passwordPolicyError, reload } = useVolcano();
  const flow = useAnonymousFlow(volcano, passwordPolicy, passwordPolicyError);

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
        {flow.user && (
          <button onClick={flow.signOut} className="secondary">
            Sign Out
          </button>
        )}
      </PageNav>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1>👤 Anonymous User Conversion</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Try your app without signup, then upgrade to keep your data
        </p>

        {flow.step === 1 && <StartStep flow={flow} />}

        {flow.step === 2 && flow.user && (
          <AnonymousUserStep user={flow.user} onUpgrade={() => flow.setStep(3)} onSignOut={flow.signOut} />
        )}

        {flow.step === 3 && <ConvertStep flow={flow} passwordPolicy={passwordPolicy} />}

        {flow.step === 4 && flow.user && <ConvertedStep user={flow.user} onSignOut={flow.signOut} />}
      </div>
    </div>
  );
}
