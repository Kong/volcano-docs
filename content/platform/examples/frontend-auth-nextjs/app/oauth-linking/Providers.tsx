import type { OAuthProvider, OAuthProviderName } from '@volcano.dev/sdk';
import type { OAuthLinking } from './useOAuthLinking';

interface ProviderOption {
  id: OAuthProviderName;
  name: string;
  icon: string;
  color: string;
}

const providers: ProviderOption[] = [
  { id: 'google', name: 'Google', icon: '🔵', color: '#4285f4' },
  { id: 'github', name: 'GitHub', icon: '⚫', color: '#333' },
  { id: 'microsoft', name: 'Microsoft', icon: '🔷', color: '#00a4ef' },
  { id: 'apple', name: 'Apple', icon: '🍎', color: '#000' },
];

export function WhyLinkProviders() {
  return (
    <div className="alert info" style={{ fontSize: '13px', marginBottom: '20px' }}>
      💡 <strong>Why link providers?</strong>
      <br />• Sign in with multiple methods
      <br />• No need to remember passwords
      <br />• Faster login on other devices
    </div>
  );
}

export function ProviderList({ oauth }: { oauth: OAuthLinking }) {
  return (
    <div style={{ display: 'grid', gap: '15px' }}>
      {providers.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} linked={oauth.isLinked(provider.id)} oauth={oauth} />
      ))}
    </div>
  );
}

interface ProviderCardProps {
  provider: ProviderOption;
  linked: boolean;
  oauth: OAuthLinking;
}

function ProviderCard({ provider, linked, oauth }: ProviderCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: linked ? '2px solid #28a745' : '2px solid #e0e0e0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span style={{ fontSize: '24px' }}>{provider.icon}</span>
        <div>
          <div style={{ fontWeight: '600', fontSize: '16px' }}>{provider.name}</div>
          <div style={{ fontSize: '13px', color: '#666' }}>{linked ? '✓ Linked' : 'Not linked'}</div>
        </div>
      </div>

      <ProviderButton provider={provider} linked={linked} oauth={oauth} />
    </div>
  );
}

function ProviderButton({ provider, linked, oauth }: ProviderCardProps) {
  if (linked) {
    return (
      <button
        onClick={() => oauth.handleUnlinkProvider(provider.id)}
        disabled={oauth.loading}
        className="danger"
        style={{
          width: 'auto',
          padding: '8px 20px',
          fontSize: '14px',
          margin: 0,
        }}
      >
        Unlink
      </button>
    );
  }

  return (
    <button
      onClick={() => oauth.handleLinkProvider(provider.id)}
      disabled={oauth.loading}
      style={{
        width: 'auto',
        padding: '8px 20px',
        fontSize: '14px',
        margin: 0,
        background: provider.color,
      }}
    >
      Link {provider.name}
    </button>
  );
}

export function LinkedProviders({ linkedProviders }: { linkedProviders: OAuthProvider[] }) {
  return (
    <div style={{ marginTop: '30px' }}>
      <h2>Your Linked Providers</h2>
      <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '8px' }}>
        {linkedProviders.map((provider, index) => (
          <div key={index} style={{ marginBottom: index < linkedProviders.length - 1 ? '10px' : '0' }}>
            <p style={{ fontSize: '14px' }}>
              <strong>{provider.provider}:</strong> Linked on{' '}
              {provider.linked_at ? new Date(provider.linked_at).toLocaleDateString() : 'an unknown date'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OAuthSetupNote() {
  return (
    <div className="alert warning" style={{ marginTop: '30px', fontSize: '13px' }}>
      <strong>⚠️ Note:</strong> To use OAuth linking, you must:
      <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
        <li>Configure OAuth providers in your Volcano project</li>
        <li>Set up client ID and client secret for each provider</li>
        <li>Configure redirect URLs</li>
      </ul>
    </div>
  );
}
