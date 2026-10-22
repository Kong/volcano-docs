'use client';

import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import ProfileForm from './ProfileForm';
import ProfileOverview, { AnonymousWarning, ConvertAccountButton, SessionInfo } from './ProfileOverview';
import { useDashboard } from './useDashboard';

export default function DashboardPage() {
  const { volcano, configured, loading: sdkLoading, passwordPolicy, passwordPolicyError, reload } = useVolcano();
  const dashboard = useDashboard(volcano, passwordPolicy, passwordPolicyError);
  const { user, message, messageType } = dashboard;

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading || dashboard.loading) {
    return <LoadingScreen text="Loading..." />;
  }

  const isAnonymous = user?.user_metadata?.anonymous === true;

  return (
    <div className="container">
      <PageNav>
        <Link href="/">← Back to Examples</Link>
        <button onClick={dashboard.handleSignOut} className="secondary">
          Sign Out
        </button>
      </PageNav>

      <div className="card">
        <h1>🏠 User Dashboard</h1>

        {isAnonymous && <AnonymousWarning />}

        <ProfileOverview user={user} isAnonymous={isAnonymous} />

        {message && <div className={`alert ${messageType}`}>{message}</div>}

        <h2>Update Profile</h2>
        <ProfileForm dashboard={dashboard} passwordPolicy={passwordPolicy} />

        <h2>Session Information</h2>
        <SessionInfo />

        {isAnonymous && <ConvertAccountButton />}
      </div>
    </div>
  );
}
