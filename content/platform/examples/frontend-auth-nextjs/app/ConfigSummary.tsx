import type { VolcanoCredentials } from '../lib/config';

interface ConfigSummaryProps {
  config: VolcanoCredentials;
  onReconfigure: () => void;
}

// Shows the saved credentials, with a button to change them
export default function ConfigSummary({ config, onReconfigure }: ConfigSummaryProps) {
  return (
    <div className="alert success" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#155724' }}>✅ Configured!</h3>
        <p style={{ margin: '8px 0 0 0', color: '#155724', fontSize: '14px' }}>
          Your Volcano credentials are set. Ready to explore the examples below.
        </p>
      </div>

      <div
        style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(21, 87, 36, 0.2)',
        }}
      >
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ fontSize: '14px', color: '#155724' }}>Current Configuration:</strong>
        </div>
        <div
          style={{
            display: 'grid',
            gap: '8px',
            fontSize: '13px',
            color: '#155724',
          }}
        >
          <ConfigValue label="API URL:">{config.apiUrl}</ConfigValue>
          <ConfigValue label="Anon Key:">
            {config.anonKey.slice(0, 10)}...{config.anonKey.slice(-6)}
          </ConfigValue>
        </div>

        <ReconfigureButton onClick={onReconfigure} />
      </div>
    </div>
  );
}

interface ConfigValueProps {
  label: string;
  children: React.ReactNode;
}

function ConfigValue({ label, children }: ConfigValueProps) {
  return (
    <div>
      <span style={{ fontWeight: '500' }}>{label}</span>{' '}
      <code
        style={{
          background: 'rgba(21, 87, 36, 0.1)',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '12px',
        }}
      >
        {children}
      </code>
    </div>
  );
}

function ReconfigureButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginTop: '16px',
        padding: '8px 16px',
        fontSize: '13px',
        background: 'rgba(21, 87, 36, 0.15)',
        color: '#155724',
        border: '1px solid rgba(21, 87, 36, 0.3)',
        borderRadius: '6px',
        fontWeight: '500',
        cursor: 'pointer',
        width: 'auto',
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(21, 87, 36, 0.25)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'rgba(21, 87, 36, 0.15)';
      }}
    >
      ⚙️ Change Configuration
    </button>
  );
}
