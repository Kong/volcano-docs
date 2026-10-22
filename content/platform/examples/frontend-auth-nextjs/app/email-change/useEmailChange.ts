import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { VolcanoAuth } from '@volcano.dev/sdk';
import type { VolcanoUser } from '../../lib/useVolcano';
import { useStatusMessage } from '../../lib/useStatusMessage';

// Loads the signed-in user, or sends the visitor to sign in. A token in the
// URL, from the confirmation email's link, opens the confirm step.
function useUserAndToken(volcano: VolcanoAuth | null) {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [emailChangeToken, setEmailChangeToken] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      if (!volcano) return;

      try {
        // Get current user
        const { user: currentUser, error } = await volcano.auth.getUser();
        if (error || !currentUser) {
          router.push('/auth');
          return;
        }
        setUser(currentUser);
      } catch {
        // Server unreachable
        router.push('/auth');
        return;
      }

      // Check URL for token (from email link)
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        setEmailChangeToken(tokenParam);
        setStep('confirm');
      }
    };

    loadUser();
  }, [volcano, router]);

  return { router, step, setStep, user, setUser, emailChangeToken, setEmailChangeToken };
}

function useEmailChangeState(volcano: VolcanoAuth | null) {
  const userAndToken = useUserAndToken(volcano);
  const [newEmail, setNewEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const status = useStatusMessage();
  const [loading, setLoading] = useState(false);

  return { ...userAndToken, newEmail, setNewEmail, pendingEmail, setPendingEmail, ...status, loading, setLoading };
}

type EmailChangeState = ReturnType<typeof useEmailChangeState>;

async function requestEmailChange(volcano: VolcanoAuth | null, state: EmailChangeState) {
  const { newEmail, setLoading, setMessage, showMessage, setPendingEmail, setEmailChangeToken, setStep } = state;
  if (!volcano) return;

  setLoading(true);
  setMessage('');

  try {
    const result = await volcano.auth.requestEmailChange(newEmail);

    if (result.error) {
      throw result.error;
    }

    setPendingEmail(result.newEmail ?? newEmail);
    showMessage(result.message || 'Confirmation email sent to new address', 'info');

    // If we got a token (dev mode), show it
    if (result.emailChangeToken) {
      setEmailChangeToken(result.emailChangeToken);
      setStep('confirm');
      setMessage(`Dev Mode: Token is ${result.emailChangeToken}`);
    }
  } catch (error) {
    showMessage((error as Error).message || 'Failed to request email change', 'error');
  } finally {
    setLoading(false);
  }
}

async function confirmEmailChange(volcano: VolcanoAuth | null, state: EmailChangeState) {
  const {
    emailChangeToken,
    setEmailChangeToken,
    router,
    setLoading,
    setMessage,
    showMessage,
    setUser,
    setPendingEmail,
  } = state;
  if (!volcano) return;

  setLoading(true);
  setMessage('');

  try {
    const { user: updatedUser, error } = await volcano.auth.confirmEmailChange(emailChangeToken);

    if (error || !updatedUser) {
      throw error ?? new Error('Email change confirmation returned no user');
    }

    setUser(updatedUser);
    showMessage(`Email changed successfully to ${updatedUser.email}!`, 'success');
    setPendingEmail('');
    setEmailChangeToken('');

    setTimeout(() => router.push('/dashboard'), 2000);
  } catch (error) {
    showMessage((error as Error).message || 'Failed to confirm email change', 'error');
  } finally {
    setLoading(false);
  }
}

async function cancelEmailChange(volcano: VolcanoAuth | null, state: EmailChangeState) {
  const { setLoading, setPendingEmail, showMessage } = state;
  if (!volcano) return;

  setLoading(true);

  try {
    const { error } = await volcano.auth.cancelEmailChange();

    if (error) {
      throw error;
    }

    setPendingEmail('');
    showMessage('Email change cancelled', 'info');
  } catch (error) {
    showMessage((error as Error).message || 'Failed to cancel', 'error');
  } finally {
    setLoading(false);
  }
}

export function useEmailChange(volcano: VolcanoAuth | null) {
  const state = useEmailChangeState(volcano);

  const handleRequestChange = (e: React.FormEvent) => {
    e.preventDefault();
    requestEmailChange(volcano, state);
  };

  const handleConfirmChange = (e: React.FormEvent) => {
    e.preventDefault();
    confirmEmailChange(volcano, state);
  };

  const handleCancelChange = () => cancelEmailChange(volcano, state);

  return { ...state, handleRequestChange, handleConfirmChange, handleCancelChange };
}

export type EmailChange = ReturnType<typeof useEmailChange>;
