'use client';

import { useState } from 'react';
import { saveConfig, clearConfig } from '../lib/config';
import { anonKeyError, isServiceKey } from '../lib/anonKey';
import FormField from './FormField';

interface ConfigPromptProps {
  onConfigured: () => void;
  initialApiUrl?: string;
}

function useConfigForm(initialApiUrl: string, onConfigured: () => void) {
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [anonKey, setAnonKey] = useState('');
  const [error, setError] = useState('');
  const [serviceKeyWarning, setServiceKeyWarning] = useState(false);

  // Check for service key whenever the input changes
  const handleAnonKeyChange = (value: string) => {
    setAnonKey(value);
    setServiceKeyWarning(isServiceKey(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const keyError = anonKeyError(anonKey);
    if (keyError) {
      setError(keyError);
      return;
    }

    // Save configuration - validation happens when SDK methods are called
    saveConfig({ apiUrl, anonKey });

    // Notify parent
    onConfigured();
  };

  const handleClear = () => {
    clearConfig();
    setApiUrl('http://localhost:8000');
    setAnonKey('');
    setError('');
    setServiceKeyWarning(false);
  };

  return { apiUrl, setApiUrl, anonKey, handleAnonKeyChange, error, serviceKeyWarning, handleSubmit, handleClear };
}

export default function ConfigPrompt({ onConfigured, initialApiUrl = 'http://localhost:8000' }: ConfigPromptProps) {
  const form = useConfigForm(initialApiUrl, onConfigured);

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h1 style={{ textAlign: 'center' }}>🌋 Volcano Configuration</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Enter your Volcano project credentials to continue
        </p>

        <CredentialsHelp />

        {form.error && (
          <div className="alert error" style={{ marginBottom: '20px' }}>
            {form.error}
          </div>
        )}

        <ConfigForm
          apiUrl={form.apiUrl}
          onApiUrlChange={form.setApiUrl}
          anonKey={form.anonKey}
          onAnonKeyChange={form.handleAnonKeyChange}
          serviceKeyWarning={form.serviceKeyWarning}
          onSubmit={form.handleSubmit}
          onClear={form.handleClear}
        />

        <EnvFileTip />
      </div>
    </div>
  );
}

function CredentialsHelp() {
  return (
    <div className="alert info" style={{ marginBottom: '30px' }}>
      <strong>📝 How to get your credentials:</strong>
      <ol style={{ marginTop: '10px', marginLeft: '20px', fontSize: '14px' }}>
        <li>
          Start Volcano server: <code>make run</code>
        </li>
        <li>Create a project via the management API</li>
        <li>Generate an anonymous key in project settings</li>
        <li>Enter the credentials below</li>
      </ol>
    </div>
  );
}

interface ConfigFormProps {
  apiUrl: string;
  onApiUrlChange: (apiUrl: string) => void;
  anonKey: string;
  onAnonKeyChange: (anonKey: string) => void;
  serviceKeyWarning: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}

function ConfigForm({
  apiUrl,
  onApiUrlChange,
  anonKey,
  onAnonKeyChange,
  serviceKeyWarning,
  onSubmit,
  onClear,
}: ConfigFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <FormField
        id="apiUrl"
        label={
          <>
            API URL
            <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
              (usually http://localhost:8000)
            </span>
          </>
        }
        type="url"
        value={apiUrl}
        onChange={(e) => onApiUrlChange(e.target.value)}
        placeholder="http://localhost:8000"
        required
      />

      <AnonKeyField anonKey={anonKey} onAnonKeyChange={onAnonKeyChange} serviceKeyWarning={serviceKeyWarning} />

      <button type="submit" style={{ width: '100%', marginTop: '20px' }}>
        💾 Save Configuration
      </button>

      <button type="button" onClick={onClear} className="secondary" style={{ width: '100%', marginTop: '10px' }}>
        🔄 Clear Saved Config
      </button>
    </form>
  );
}

interface AnonKeyFieldProps {
  anonKey: string;
  onAnonKeyChange: (anonKey: string) => void;
  serviceKeyWarning: boolean;
}

function AnonKeyField({ anonKey, onAnonKeyChange, serviceKeyWarning }: AnonKeyFieldProps) {
  return (
    <div className="form-group">
      <label htmlFor="anonKey">
        Anonymous Key
        <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>(from project settings)</span>
      </label>
      <input
        type="text"
        id="anonKey"
        value={anonKey}
        onChange={(e) => onAnonKeyChange(e.target.value)}
        placeholder="ak-xxxxxxxxxxxx..."
        required
        style={serviceKeyWarning ? { borderColor: '#dc3545', backgroundColor: '#fff5f5' } : undefined}
      />
      {serviceKeyWarning && (
        <div className="alert error" style={{ marginTop: '8px', padding: '10px', fontSize: '13px' }}>
          <strong>Security Error:</strong> You are entering a service key (sk-*). Service keys bypass Row Level Security
          and must NEVER be used in browser applications. Use an anon key (ak-*) instead.
        </div>
      )}
      <small style={{ color: '#666', fontSize: '12px' }}>
        Get this from: Project Settings → Authentication → Anonymous Keys
      </small>
    </div>
  );
}

function EnvFileTip() {
  return (
    <div className="alert warning" style={{ marginTop: '30px', fontSize: '13px' }}>
      <strong>💡 Tip:</strong> You can also set these in <code>.env.local</code> to skip this prompt:
      <pre
        style={{
          marginTop: '10px',
          background: '#2d2d2d',
          color: '#f8f8f2',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '11px',
        }}
      >
        {`NEXT_PUBLIC_VOLCANO_API_URL=http://localhost:8000
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-xxxxxxxxxxxx`}
      </pre>
      <p style={{ marginTop: '10px', color: '#856404' }}>
        <strong>Important:</strong> Only use anon keys (ak-*) in browser apps. Never use service keys (sk-*)
        client-side.
      </p>
    </div>
  );
}
