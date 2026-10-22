import Link from 'next/link';
import FormField from '../../components/FormField';
import TabButton from '../../components/TabButton';
import { passwordPlaceholder, type PasswordPolicy } from '../../lib/useVolcano';
import type { PasswordReset, ResetStep } from './usePasswordReset';

interface StepTabsProps {
  step: ResetStep;
  onChange: (step: ResetStep) => void;
}

export function StepTabs({ step, onChange }: StepTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        marginBottom: '30px',
        borderBottom: '2px solid #f0f0f0',
      }}
    >
      <TabButton active={step === 'request'} onClick={() => onChange('request')}>
        Request Reset
      </TabButton>
      <TabButton active={step === 'reset'} onClick={() => onChange('reset')}>
        Reset Password
      </TabButton>
    </div>
  );
}

// Request Reset Form
export function RequestResetForm({ reset }: { reset: PasswordReset }) {
  return (
    <form onSubmit={reset.handleRequestReset}>
      <div className="alert info">📧 Enter your email address and we'll send you a link to reset your password.</div>

      <FormField
        id="email"
        label="Email Address"
        type="email"
        value={reset.email}
        onChange={(e) => reset.setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />

      <button type="submit" disabled={reset.loading} style={{ width: '100%' }}>
        {reset.loading ? 'Sending...' : '📧 Send Reset Link'}
      </button>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Link href="/auth" style={{ color: '#667eea', fontSize: '14px' }}>
          ← Back to Sign In
        </Link>
      </div>
    </form>
  );
}

interface ResetPasswordFormProps {
  reset: PasswordReset;
  passwordPolicy: PasswordPolicy | null;
}

// Reset Password Form
export function ResetPasswordForm({ reset, passwordPolicy }: ResetPasswordFormProps) {
  return (
    <form onSubmit={reset.handleResetPassword}>
      <div className="alert info">🔑 Enter the token from your email and your new password.</div>

      <FormField
        id="token"
        label="Recovery Token"
        type="text"
        value={reset.token}
        onChange={(e) => reset.setToken(e.target.value)}
        placeholder="Token from email"
        required
      />

      <FormField
        id="newPassword"
        label="New Password"
        type="password"
        value={reset.newPassword}
        onChange={(e) => reset.setNewPassword(e.target.value)}
        placeholder={passwordPlaceholder(passwordPolicy)}
        disabled={!passwordPolicy}
        required
      />

      <button type="submit" disabled={reset.loading || !passwordPolicy} style={{ width: '100%' }}>
        {reset.loading ? 'Resetting...' : '🔐 Reset Password'}
      </button>
    </form>
  );
}
