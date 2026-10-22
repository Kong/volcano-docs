import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserMetadata, VolcanoAuth } from '@volcano.dev/sdk';
import { newPasswordError, type PasswordPolicy, type VolcanoUser } from '../../lib/useVolcano';
import { useStatusMessage } from '../../lib/useStatusMessage';

// The current step and user. A signed-in user resumes at step 2 while
// anonymous, or at step 4 once converted.
function useCurrentStep(volcano: VolcanoAuth | null) {
  const [step, setStep] = useState(1);
  const [user, setUser] = useState<VolcanoUser | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      if (!volcano) return;

      try {
        const { user: currentUser } = await volcano.initialize();
        if (currentUser) {
          setUser(currentUser);
          const isAnonymous = currentUser.user_metadata?.anonymous === true;
          setStep(isAnonymous ? 2 : 4);
        }
      } catch {
        // Server unreachable - stay on step 1
      }
    };

    checkUser();
  }, [volcano]);

  return { step, setStep, user, setUser };
}

function useFlowState(volcano: VolcanoAuth | null) {
  const router = useRouter();
  const currentStep = useCurrentStep(volcano);
  const [anonName, setAnonName] = useState('');
  const [convertEmail, setConvertEmail] = useState('');
  const [convertPassword, setConvertPassword] = useState('');
  const [convertName, setConvertName] = useState('');
  const status = useStatusMessage();
  const [loading, setLoading] = useState(false);

  return {
    router,
    ...currentStep,
    anonName,
    setAnonName,
    convertEmail,
    setConvertEmail,
    convertPassword,
    setConvertPassword,
    convertName,
    setConvertName,
    ...status,
    loading,
    setLoading,
  };
}

type FlowState = ReturnType<typeof useFlowState>;

// Step 1: sign in as a new anonymous user
async function signUpAnonymous(volcano: VolcanoAuth | null, flow: FlowState) {
  const { anonName, setLoading, setMessage, showMessage, setUser, setStep } = flow;
  if (!volcano) return;

  setLoading(true);
  setMessage('');

  try {
    const metadata: UserMetadata = anonName ? { name: anonName, anonymous: true } : { anonymous: true };
    const { user: anonUser, error } = await volcano.auth.signInAnonymously(metadata);

    if (error) {
      throw error;
    }

    setUser(anonUser);
    showMessage('✓ Signed in as anonymous user!', 'success');
    setStep(2);
  } catch (error) {
    showMessage((error as Error).message || 'Failed to create anonymous user', 'error');
  } finally {
    setLoading(false);
  }
}

// Step 3: add an email and password to the anonymous user
async function convertToAuthenticated(
  volcano: VolcanoAuth | null,
  flow: FlowState,
  passwordPolicy: PasswordPolicy | null,
  passwordPolicyError: string | null,
) {
  const { convertEmail, convertPassword, convertName, router, setLoading, setMessage, showMessage, setUser, setStep } =
    flow;
  if (!volcano) return;

  if (!convertEmail || !convertPassword) {
    showMessage('Please fill in email and password', 'error');
    return;
  }

  const passwordValidationError = newPasswordError(convertPassword, passwordPolicy, passwordPolicyError);
  if (passwordValidationError) {
    showMessage(passwordValidationError, 'error');
    return;
  }

  setLoading(true);
  setMessage('');

  try {
    const metadata: UserMetadata = convertName ? { name: convertName } : {};
    const { user: convertedUser, error } = await volcano.auth.convertAnonymous({
      email: convertEmail,
      password: convertPassword,
      metadata,
    });

    if (error) throw error;

    setUser(convertedUser);
    showMessage('🎉 Account converted! Redirecting to dashboard...', 'success');
    setStep(4);
    // Redirect to dashboard after successful conversion
    setTimeout(() => router.push('/dashboard'), 1500);
  } catch (error) {
    showMessage((error as Error).message || 'Conversion failed', 'error');
  } finally {
    setLoading(false);
  }
}

// Signing out also clears the forms, ready to start again at step 1
async function signOut(volcano: VolcanoAuth | null, flow: FlowState) {
  const {
    setUser,
    setStep,
    setAnonName,
    setConvertEmail,
    setConvertPassword,
    setConvertName,
    setMessage,
    setMessageType,
  } = flow;
  if (!volcano) return;

  const { error } = await volcano.auth.signOut();
  setUser(null);
  setStep(1);
  setAnonName('');
  setConvertEmail('');
  setConvertPassword('');
  setConvertName('');
  setMessage(error ? `Signed out locally. Refresh token revocation failed: ${error.message}` : '');
  setMessageType(error ? 'error' : 'success');
}

export function useAnonymousFlow(
  volcano: VolcanoAuth | null,
  passwordPolicy: PasswordPolicy | null,
  passwordPolicyError: string | null,
) {
  const flow = useFlowState(volcano);

  return {
    ...flow,
    signUpAnonymous: () => signUpAnonymous(volcano, flow),
    convertToAuthenticated: () => convertToAuthenticated(volcano, flow, passwordPolicy, passwordPolicyError),
    signOut: () => signOut(volcano, flow),
  };
}

export type AnonymousFlow = ReturnType<typeof useAnonymousFlow>;
