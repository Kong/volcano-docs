'use client';

import Link from 'next/link';
import { useVolcano, type VolcanoUser } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import { LinkedProviders, OAuthSetupNote, ProviderList, WhyLinkProviders } from './Providers';
import { useOAuthLinking } from './useOAuthLinking';

export default function OAuthLinkingPage() {
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const oauth = useOAuthLinking(volcano);
  const { user, linkedProviders, message, messageType } = oauth;

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

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1>🔗 Link OAuth Providers</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Connect your account with Google, GitHub, and other providers
        </p>

        {user && <SignedInUser user={user} />}

        {message && <div className={`alert ${messageType}`}>{message}</div>}

        <h2>Available Providers</h2>
        <WhyLinkProviders />

        <ProviderList oauth={oauth} />

        {linkedProviders.length > 0 && <LinkedProviders linkedProviders={linkedProviders} />}

        <OAuthSetupNote />
      </div>
    </div>
  );
}

function SignedInUser({ user }: { user: VolcanoUser }) {
  return (
    <div className="user-info" style={{ marginBottom: '20px' }}>
      <p>
        <strong>Signed in as:</strong> {user.email}
      </p>
      <p>
        <strong>Account Type:</strong> {user.user_metadata?.anonymous ? 'Anonymous' : 'Authenticated'}
      </p>
    </div>
  );
}
