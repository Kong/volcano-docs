import Link from 'next/link';
import FormField from '../../components/FormField';
import { passwordPlaceholder, type PasswordPolicy, type VolcanoUser } from '../../lib/useVolcano';
import type { AnonymousFlow } from './useAnonymousFlow';

// Step 1: Start as Anonymous
export function StartStep({ flow }: { flow: AnonymousFlow }) {
  return (
    <div>
      <h2>Step 1: Start as Anonymous User</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>No email or password required. Try the app instantly!</p>

      {flow.message && <div className={`alert ${flow.messageType}`}>{flow.message}</div>}

      <FormField
        id="anonName"
        label="Name (optional)"
        type="text"
        value={flow.anonName}
        onChange={(e) => flow.setAnonName(e.target.value)}
        placeholder="e.g., Guest User"
      />

      <button onClick={flow.signUpAnonymous} disabled={flow.loading} style={{ width: '100%' }}>
        {flow.loading ? 'Creating...' : '🚀 Start as Anonymous'}
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
  );
}

interface AnonymousUserStepProps {
  user: VolcanoUser;
  onUpgrade: () => void;
  onSignOut: () => void;
}

// Step 2: Anonymous User Info
export function AnonymousUserStep({ user, onUpgrade, onSignOut }: AnonymousUserStepProps) {
  return (
    <div>
      <h2>Step 2: You're Signed In (Anonymous)</h2>

      <UserDetails user={user} type="Anonymous (temporary)" />

      <div className="alert info">
        💡 <strong>You're browsing anonymously.</strong> Your data is temporary. Convert to a permanent account below to
        keep your data forever!
      </div>

      <button onClick={onUpgrade} style={{ width: '100%' }}>
        ✨ Upgrade to Permanent Account
      </button>

      <button onClick={onSignOut} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
        🚪 Sign Out
      </button>
    </div>
  );
}

interface ConvertStepProps {
  flow: AnonymousFlow;
  passwordPolicy: PasswordPolicy | null;
}

// Step 3: Conversion Form
export function ConvertStep({ flow, passwordPolicy }: ConvertStepProps) {
  return (
    <div>
      <h2>Step 3: Create Your Permanent Account</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Add email and password to keep your data and access it from anywhere.
      </p>

      {flow.message && <div className={`alert ${flow.messageType}`}>{flow.message}</div>}

      <ConvertFields flow={flow} passwordPolicy={passwordPolicy} />

      <button
        onClick={flow.convertToAuthenticated}
        disabled={flow.loading || !passwordPolicy}
        style={{ width: '100%' }}
      >
        {flow.loading ? 'Converting...' : '🎉 Create Permanent Account'}
      </button>

      <button onClick={() => flow.setStep(2)} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
        ← Back
      </button>
    </div>
  );
}

// The step 3 inputs, which keep their values if the user goes back to step 2
function ConvertFields({ flow, passwordPolicy }: ConvertStepProps) {
  return (
    <>
      <FormField
        id="convertEmail"
        label="Email Address"
        type="email"
        value={flow.convertEmail}
        onChange={(e) => flow.setConvertEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />

      <FormField
        id="convertPassword"
        label="Password"
        type="password"
        value={flow.convertPassword}
        onChange={(e) => flow.setConvertPassword(e.target.value)}
        placeholder={passwordPlaceholder(passwordPolicy)}
        disabled={!passwordPolicy}
        required
      />

      <FormField
        id="convertName"
        label="Update Name (optional)"
        type="text"
        value={flow.convertName}
        onChange={(e) => flow.setConvertName(e.target.value)}
        placeholder="Your full name"
      />
    </>
  );
}

interface ConvertedStepProps {
  user: VolcanoUser;
  onSignOut: () => void;
}

// Step 4: Success
export function ConvertedStep({ user, onSignOut }: ConvertedStepProps) {
  return (
    <div>
      <h2>✓ Account Created!</h2>

      <div className="alert success">
        🎉 <strong>Success!</strong> Your {user.user_metadata?.anonymous ? 'anonymous ' : ''}account is now permanent.
        All your data has been preserved!
      </div>

      <UserDetails user={user} type="Authenticated (permanent)" />

      <div className="alert info" style={{ marginTop: '20px' }}>
        <strong>What changed:</strong>
        <br />• Same user ID (your data is intact)
        <br />• You now have email: <code>{user.email}</code>
        <br />• You can sign in from any device
        <br />• Your account is permanent
      </div>

      <Link href="/dashboard">
        <button style={{ width: '100%', marginTop: '20px' }}>🏠 Go to Dashboard</button>
      </Link>

      <button onClick={onSignOut} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
        🚪 Sign Out (Try Signing Back In!)
      </button>
    </div>
  );
}

function UserDetails({ user, type }: { user: VolcanoUser; type: string }) {
  return (
    <div className="user-info">
      <p>
        <strong>User ID:</strong> <code>{user.id}</code>
      </p>
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      <p>
        <strong>Type:</strong> {type}
      </p>
      <p>
        <strong>Name:</strong> {(user.user_metadata?.name as string) || 'Not set'}
      </p>
    </div>
  );
}
