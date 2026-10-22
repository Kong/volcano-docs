'use client';

import { useState } from 'react';
import FormField from '../../components/FormField';
import TabButton from '../../components/TabButton';
import { passwordPlaceholder, type PasswordPolicy } from '../../lib/useVolcano';
import type { AuthMode, Credentials } from './useAuthForm';

interface AuthFormProps {
  mode: AuthMode;
  loading: boolean;
  passwordPolicy: PasswordPolicy | null;
  onSubmit: (credentials: Credentials) => void;
}

export default function AuthForm({ mode, loading, passwordPolicy, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, password, name });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === 'signup' ? passwordPlaceholder(passwordPolicy) : 'Your password'}
        disabled={mode === 'signup' && !passwordPolicy}
        required
      />

      {mode === 'signup' && (
        <FormField
          id="name"
          label="Name (optional)"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      )}

      <SubmitButton mode={mode} loading={loading} disabled={loading || (mode === 'signup' && !passwordPolicy)} />
    </form>
  );
}

interface SubmitButtonProps {
  mode: AuthMode;
  loading: boolean;
  disabled: boolean;
}

function SubmitButton({ mode, loading, disabled }: SubmitButtonProps) {
  return (
    <button type="submit" disabled={disabled} style={{ width: '100%', marginTop: '10px' }}>
      {loading ? (
        <>
          <span className="loading"></span> Processing...
        </>
      ) : mode === 'signup' ? (
        '🚀 Create Account'
      ) : (
        '🔑 Sign In'
      )}
    </button>
  );
}

interface ModeTabsProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        marginBottom: '30px',
        borderBottom: '2px solid #f0f0f0',
      }}
    >
      <TabButton active={mode === 'signup'} onClick={() => onChange('signup')}>
        Sign Up
      </TabButton>
      <TabButton active={mode === 'signin'} onClick={() => onChange('signin')}>
        Sign In
      </TabButton>
    </div>
  );
}
