import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { OAuthProvider, OAuthProviderName, VolcanoAuth } from '@volcano.dev/sdk';
import type { VolcanoUser } from '../../lib/useVolcano';
import { useStatusMessage } from '../../lib/useStatusMessage';

async function loadLinkedProviders(volcano: VolcanoAuth, setLinkedProviders: (providers: OAuthProvider[]) => void) {
  try {
    const { providers, error } = await volcano.auth.getLinkedOAuthProviders();
    if (!error) setLinkedProviders(providers ?? []);
  } catch {
    // Silently fail - user will see empty providers list
  }
}

// Loads the signed-in user and their linked providers, or sends the visitor to sign in
function useUserAndProviders(volcano: VolcanoAuth | null) {
  const router = useRouter();
  const [user, setUser] = useState<VolcanoUser | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    const loadUser = async () => {
      if (!volcano) return;

      try {
        // Get current user
        const { user: currentUser, error } = await volcano.auth.getUser();
        if (error || !currentUser) {
          router.push('/auth');
        } else {
          setUser(currentUser);
        }
      } catch {
        // Server unreachable
        router.push('/auth');
      }
    };

    loadUser();
  }, [volcano, router]);

  // Load linked providers when user is set
  useEffect(() => {
    if (user && volcano) {
      loadLinkedProviders(volcano, setLinkedProviders);
    }
  }, [user, volcano]);

  return { user, linkedProviders, setLinkedProviders };
}

function useOAuthLinkingState(volcano: VolcanoAuth | null) {
  const userAndProviders = useUserAndProviders(volcano);
  const status = useStatusMessage();
  const [loading, setLoading] = useState(false);

  return { ...userAndProviders, ...status, loading, setLoading };
}

type OAuthLinkingState = ReturnType<typeof useOAuthLinkingState>;

async function linkProvider(volcano: VolcanoAuth | null, state: OAuthLinkingState, provider: OAuthProviderName) {
  const { setLoading, setMessage, showMessage } = state;
  if (!volcano) return;

  setLoading(true);
  setMessage('');

  try {
    const { data, error } = await volcano.auth.linkOAuthProvider(provider);
    if (error) throw error;
    if (!data?.authorization_url) throw new Error(`No authorization URL returned for ${provider}`);
    showMessage(`Redirecting to ${provider}...`, 'info');

    // Redirect to OAuth provider
    window.location.assign(data.authorization_url);
  } catch (error) {
    showMessage((error as Error).message || `Failed to link ${provider}`, 'error');
    setLoading(false);
  }
}

async function unlinkProvider(volcano: VolcanoAuth | null, state: OAuthLinkingState, provider: OAuthProviderName) {
  const { setLoading, setMessage, showMessage, setLinkedProviders } = state;
  if (!volcano) return;
  if (!confirm(`Are you sure you want to unlink ${provider}?`)) return;

  setLoading(true);
  setMessage('');

  try {
    const { error } = await volcano.auth.unlinkOAuthProvider(provider);
    if (error) throw error;
    showMessage(`${provider} unlinked successfully`, 'success');
    loadLinkedProviders(volcano, setLinkedProviders);
  } catch (error) {
    showMessage((error as Error).message || `Failed to unlink ${provider}`, 'error');
  } finally {
    setLoading(false);
  }
}

export function useOAuthLinking(volcano: VolcanoAuth | null) {
  const state = useOAuthLinkingState(volcano);

  return {
    ...state,
    isLinked: (providerId: string) => state.linkedProviders.some((p) => p.provider === providerId),
    handleLinkProvider: (provider: OAuthProviderName) => linkProvider(volcano, state, provider),
    handleUnlinkProvider: (provider: OAuthProviderName) => unlinkProvider(volcano, state, provider),
  };
}

export type OAuthLinking = ReturnType<typeof useOAuthLinking>;
