import FormField from '../../components/FormField';
import type { VolcanoUser } from '../../lib/useVolcano';
import type { EmailChange } from './useEmailChange';

export function CurrentEmail({ user, pendingEmail }: { user: VolcanoUser; pendingEmail: string }) {
  return (
    <div className="user-info" style={{ marginBottom: '20px' }}>
      <p>
        <strong>Current Email:</strong> {user.email}
      </p>
      {pendingEmail && (
        <p style={{ color: '#856404' }}>
          <strong>Pending Change:</strong> {pendingEmail}
        </p>
      )}
    </div>
  );
}

// Request Email Change
export function RequestForm({ emailChange }: { emailChange: EmailChange }) {
  const { newEmail, setNewEmail, pendingEmail, loading, setStep } = emailChange;

  return (
    <div>
      <h2>Request Email Change</h2>

      {pendingEmail && <PendingChangeWarning emailChange={emailChange} />}

      <form onSubmit={emailChange.handleRequestChange}>
        <FormField
          id="newEmail"
          label="New Email Address"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="newemail@example.com"
          required
          disabled={!!pendingEmail}
        />

        <div className="alert info" style={{ fontSize: '13px' }}>
          📧 A confirmation link will be sent to your new email address. Click the link to complete the email change.
        </div>

        <button type="submit" disabled={loading || !!pendingEmail} style={{ width: '100%' }}>
          {loading ? 'Sending...' : '📨 Send Confirmation Email'}
        </button>

        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="secondary"
          style={{ width: '100%', marginTop: '10px' }}
        >
          I Have a Confirmation Token →
        </button>
      </form>
    </div>
  );
}

function PendingChangeWarning({ emailChange }: { emailChange: EmailChange }) {
  return (
    <div className="alert warning">
      ⚠️ You have a pending email change to <strong>{emailChange.pendingEmail}</strong>.{' '}
      <button
        onClick={emailChange.handleCancelChange}
        style={{
          background: 'transparent',
          color: '#856404',
          textDecoration: 'underline',
          padding: '0',
          margin: '0',
          width: 'auto',
        }}
      >
        Cancel it
      </button>{' '}
      to request a new one.
    </div>
  );
}

// Confirm Email Change
export function ConfirmForm({ emailChange }: { emailChange: EmailChange }) {
  const { emailChangeToken, setEmailChangeToken, loading, setStep } = emailChange;

  return (
    <div>
      <h2>Confirm Email Change</h2>

      <form onSubmit={emailChange.handleConfirmChange}>
        <FormField
          id="emailChangeToken"
          label="Confirmation Token"
          type="text"
          value={emailChangeToken}
          onChange={(e) => setEmailChangeToken(e.target.value)}
          placeholder="Token from email"
          required
        />

        <div className="alert info" style={{ fontSize: '13px' }}>
          🔑 Enter the token from the confirmation email sent to your new address.
        </div>

        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Confirming...' : '✓ Confirm Email Change'}
        </button>

        <button
          type="button"
          onClick={() => setStep('request')}
          className="secondary"
          style={{ width: '100%', marginTop: '10px' }}
        >
          ← Back to Request
        </button>
      </form>
    </div>
  );
}
