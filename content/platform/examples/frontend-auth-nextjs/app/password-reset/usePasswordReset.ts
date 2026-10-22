import { useState, useEffect } from 'react';
import type { VolcanoAuth } from '@volcano.dev/sdk';
import { newPasswordError, type PasswordPolicy } from '../../lib/useVolcano';
import { useStatusMessage } from '../../lib/useStatusMessage';

export type ResetStep = 'request' | 'reset';

function usePasswordResetState() {
  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const status = useStatusMessage();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if token in URL (from email link)
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      setStep('reset');
    }
  }, []);

  return {
    step,
    setStep,
    email,
    setEmail,
    token,
    setToken,
    newPassword,
    setNewPassword,
    ...status,
    loading,
    setLoading,
  };
}

type PasswordResetState = ReturnType<typeof usePasswordResetState>;

async function requestReset(volcano: VolcanoAuth | null, state: PasswordResetState) {
  const { email, setEmail, setLoading, setMessage, showMessage } = state;
  if (!volcano) return;

  setLoading(true);
  setMessage('');

  try {
    const { message: responseMessage, error } = await volcano.auth.resetPasswordForEmail(email);
    if (error) throw error;
    showMessage(responseMessage || 'If the email exists, a password reset link has been sent', 'success');
    setEmail('');
  } catch (error) {
    showMessage((error as Error).message || 'Failed to request password reset', 'error');
  } finally {
    setLoading(false);
  }
}

async function resetPassword(
  volcano: VolcanoAuth | null,
  state: PasswordResetState,
  passwordPolicy: PasswordPolicy | null,
  passwordPolicyError: string | null,
) {
  const { token, setToken, newPassword, setNewPassword, setLoading, setMessage, showMessage } = state;
  if (!volcano) return;

  if (!token || !newPassword) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  const passwordValidationError = newPasswordError(newPassword, passwordPolicy, passwordPolicyError);
  if (passwordValidationError) {
    showMessage(passwordValidationError, 'error');
    return;
  }

  setLoading(true);
  setMessage('');

  try {
    const { message: responseMessage, error } = await volcano.auth.resetPassword({
      token,
      newPassword,
    });
    if (error) throw error;

    showMessage(
      responseMessage || 'Password reset successfully! You can now sign in with your new password.',
      'success',
    );
    setToken('');
    setNewPassword('');

    // Redirect to auth page after success
    setTimeout(() => {
      window.location.href = '/auth';
    }, 2000);
  } catch (error) {
    showMessage((error as Error).message || 'Failed to reset password', 'error');
  } finally {
    setLoading(false);
  }
}

export function usePasswordReset(
  volcano: VolcanoAuth | null,
  passwordPolicy: PasswordPolicy | null,
  passwordPolicyError: string | null,
) {
  const state = usePasswordResetState();

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset(volcano, state);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    resetPassword(volcano, state, passwordPolicy, passwordPolicyError);
  };

  return { ...state, handleRequestReset, handleResetPassword };
}

export type PasswordReset = ReturnType<typeof usePasswordReset>;
