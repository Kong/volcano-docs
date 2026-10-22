import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UpdateUserOptions, UserMetadata, VolcanoAuth } from '@volcano.dev/sdk';
import { newPasswordError, type PasswordPolicy, type VolcanoUser } from '../../lib/useVolcano';
import { useStatusMessage } from '../../lib/useStatusMessage';
import { customMetadataFields, useMetadataEditor, type MetadataField } from './useMetadataEditor';

type Router = ReturnType<typeof useRouter>;

// Whether an error says the user was deleted or banned
function isAccountGone(lowerMessage: string): boolean {
  return (
    lowerMessage.includes('no longer exists') || lowerMessage.includes('banned') || lowerMessage.includes('account is')
  );
}

// Loads the signed-in user, or sends the visitor to sign in
function useProfile(volcano: VolcanoAuth | null) {
  const router = useRouter();
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateName, setUpdateName] = useState('');
  const [customMetadata, setCustomMetadata] = useState<MetadataField[]>([]);

  useEffect(() => {
    const loadUser = async () => {
      if (!volcano) return;

      try {
        const { user: currentUser, error } = await volcano.auth.getUser();
        if (error || !currentUser) {
          // User not authenticated or session invalid
          router.push('/auth');
        } else {
          setUser(currentUser);
          setUpdateName((currentUser.user_metadata?.name as string) || '');
          // Load custom metadata (exclude reserved fields)
          setCustomMetadata(customMetadataFields(currentUser));
        }
      } catch (error) {
        // Handle cases where user was deleted/banned
        const errorMessage = (error as Error).message || '';
        if (isAccountGone(errorMessage.toLowerCase())) {
          // User was deleted or banned - sign out before redirecting
          console.log('User account is no longer accessible:', errorMessage);
          const { error: signOutError } = await volcano.auth.signOut();
          if (signOutError) console.error('Refresh token revocation failed:', signOutError);
        }
        // Any error sends the user back to sign in
        router.push('/auth');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [volcano, router]);

  return { router, user, setUser, loading, setLoading, updateName, setUpdateName, customMetadata, setCustomMetadata };
}

function useDashboardState(volcano: VolcanoAuth | null) {
  const profile = useProfile(volcano);
  const [updatePassword, setUpdatePassword] = useState('');
  const status = useStatusMessage();

  return { ...profile, updatePassword, setUpdatePassword, ...status };
}

type DashboardState = ReturnType<typeof useDashboardState>;

// The changes to save: the new password, if one was entered, and the metadata
function profileUpdates({ updatePassword, updateName, customMetadata, user }: DashboardState): UpdateUserOptions {
  const updates: UpdateUserOptions = {};
  if (updatePassword) updates.password = updatePassword;

  // Build metadata object with name and custom fields
  const metadata: UserMetadata = {};
  if (updateName) metadata.name = updateName;

  // Add custom metadata fields
  customMetadata.forEach((field) => {
    if (field.key.trim()) {
      metadata[field.key.trim()] = field.value;
    }
  });

  // Preserve anonymous flag if it exists
  if (user?.user_metadata?.anonymous) {
    metadata.anonymous = true;
  }

  if (Object.keys(metadata).length > 0) {
    updates.metadata = metadata;
  }

  return updates;
}

// Tells a deleted or banned user why they're being signed out, then signs them out
function signOutRemovedAccount(volcano: VolcanoAuth, state: DashboardState, lowerMessage: string) {
  // Determine the reason from the error message
  let reason = 'removed';
  if (lowerMessage.includes('banned')) {
    reason = 'banned';
  } else if (lowerMessage.includes('no longer exists')) {
    reason = 'deleted';
  }

  state.showMessage(`Your account has been ${reason}. You will be signed out.`, 'error');

  // Sign out after a brief delay to show the message
  setTimeout(async () => {
    const { error: signOutError } = await volcano.auth.signOut();
    if (signOutError) console.error('Refresh token revocation failed:', signOutError);
    state.router.push('/auth');
  }, 2000);
}

async function updateProfile(
  volcano: VolcanoAuth | null,
  state: DashboardState,
  passwordPolicy: PasswordPolicy | null,
  passwordPolicyError: string | null,
) {
  const { updatePassword, setUser, setLoading, setMessage, showMessage, setUpdatePassword } = state;
  if (!volcano) return;

  if (updatePassword) {
    const passwordValidationError = newPasswordError(updatePassword, passwordPolicy, passwordPolicyError);
    if (passwordValidationError) {
      showMessage(passwordValidationError, 'error');
      return;
    }
  }

  setLoading(true);
  setMessage('');

  try {
    const { user: updatedUser, error } = await volcano.auth.updateUser(profileUpdates(state));
    if (error) throw error;
    setUser(updatedUser);
    showMessage('Profile updated successfully!', 'success');
    setUpdatePassword('');
  } catch (error) {
    const errorMessage = (error as Error).message || 'Update failed';
    const lowerMessage = errorMessage.toLowerCase();

    // Check if user was deleted or banned
    if (isAccountGone(lowerMessage)) {
      signOutRemovedAccount(volcano, state, lowerMessage);
      return;
    }

    showMessage(errorMessage, 'error');
  } finally {
    setLoading(false);
  }
}

async function signOut(volcano: VolcanoAuth | null, router: Router) {
  if (!volcano) return;

  const { error } = await volcano.auth.signOut();
  if (error) console.error('Refresh token revocation failed:', error);
  router.push('/');
}

export function useDashboard(
  volcano: VolcanoAuth | null,
  passwordPolicy: PasswordPolicy | null,
  passwordPolicyError: string | null,
) {
  const state = useDashboardState(volcano);
  const metadataEditor = useMetadataEditor(state.customMetadata, state.setCustomMetadata, state.showMessage);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(volcano, state, passwordPolicy, passwordPolicyError);
  };

  return { ...state, metadataEditor, handleUpdateProfile, handleSignOut: () => signOut(volcano, state.router) };
}

export type Dashboard = ReturnType<typeof useDashboard>;
