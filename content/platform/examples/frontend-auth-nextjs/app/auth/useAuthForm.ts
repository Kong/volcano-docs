import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VolcanoAuth } from '@volcano.dev/sdk';
import { newPasswordError, type PasswordPolicy } from '../../lib/useVolcano';
import { useStatusMessage, type MessageType } from '../../lib/useStatusMessage';

export type AuthMode = 'signin' | 'signup';

export interface Credentials {
  email: string;
  password: string;
  name: string;
}

interface Message {
  text: string;
  type: MessageType;
}

// Signup never returns a session, so sign in separately once the project
// allows it. Returns the message to show if the user isn't signed in.
async function signUpAndSignIn(volcano: VolcanoAuth, { email, password, name }: Credentials): Promise<Message | null> {
  const {
    confirmationRequired,
    message: signUpMessage,
    error: signUpError,
  } = await volcano.auth.signUp({
    email,
    password,
    metadata: name ? { name } : {},
  });
  if (signUpError) throw signUpError;
  if (confirmationRequired) {
    // Signup answers the same way for new and existing addresses, so
    // show its conditional wording rather than promising an email.
    const text =
      signUpMessage ||
      'If the account was created, a confirmation email has been sent. Confirm your email, then sign in.';
    return { text, type: 'success' };
  }
  const { error: signInError } = await volcano.auth.signIn({ email, password });
  if (signInError) {
    // Signup also succeeds for an existing address without creating an
    // account, so don't claim one was created.
    const text = `Signing in failed: ${signInError.message}. If you already have an account, sign in with its password.`;
    return { text, type: 'error' };
  }
  return null;
}

// Sends a user who's already signed in to the dashboard
function useRedirectSignedInUser(volcano: VolcanoAuth | null) {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      if (!volcano) return;

      try {
        const { user } = await volcano.initialize();
        if (user) {
          router.push('/dashboard');
        }
      } catch {
        // Server unreachable or session invalid - stay on auth page
      }
    };

    checkUser();
  }, [volcano, router]);
}

export function useAuthForm(volcano: VolcanoAuth | null, policy: PasswordPolicy | null, policyError: string | null) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signup');
  const { message, messageType, setMessage, setMessageType, showMessage } = useStatusMessage();
  const [loading, setLoading] = useState(false);
  useRedirectSignedInUser(volcano);

  const handleSubmit = async (credentials: Credentials) => {
    const { email, password } = credentials;
    if (!volcano) return;

    if (mode === 'signup') {
      const passwordValidationError = newPasswordError(password, policy, policyError);
      if (passwordValidationError) {
        showMessage(passwordValidationError, 'error');
        return;
      }
    }

    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        const notSignedIn = await signUpAndSignIn(volcano, credentials);
        if (notSignedIn) {
          showMessage(notSignedIn.text, notSignedIn.type);
          setMode('signin');
          setLoading(false);
          return;
        }
        setMessage(`Signed in! Redirecting to dashboard...`);
      } else {
        const { error } = await volcano.auth.signIn({ email, password });
        if (error) throw error;
        setMessage(`Welcome back! Redirecting...`);
      }
      setMessageType('success');
      // Redirect immediately after successful signup or signin
      router.push('/dashboard');
    } catch (error) {
      showMessage((error as Error).message || 'Authentication failed', 'error');
      setLoading(false);
    }
  };

  return { mode, setMode, message, messageType, loading, handleSubmit };
}
