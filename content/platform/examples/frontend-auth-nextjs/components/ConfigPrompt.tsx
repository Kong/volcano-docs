'use client';

import { useState } from 'react';
import { saveConfig, clearConfig } from '../lib/config';

interface ConfigPromptProps {
  onConfigured: () => void;
  initialApiUrl?: string;
}

// Check if the key is a service key (should never be used client-side)
function isServiceKey(key: string): boolean {
  return key.startsWith('sk-');
}

// Validate JWT structure (basic check without cryptographic verification)
function isValidJWT(token: string): boolean {
  // JWTs have 3 base64url-encoded parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Check each part is valid base64url (alphanumeric, -, _, no padding)
  const base64urlPattern = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => part.length > 0 && base64urlPattern.test(part));
}

// Check if the key is a valid anon key format
function isValidAnonKey(key: string): boolean {
  // Strip ak- prefix if present
  const jwtPart = key.startsWith('ak-') ? key.slice(3) : key;
  
  // Must be a valid JWT structure
  return isValidJWT(jwtPart);
}

// Get a helpful error message for invalid key formats
function getKeyFormatError(key: string): string | null {
  if (key.startsWith('sk-')) {
    return null; // Handled separately as service key
  }
  
  const jwtPart = key.startsWith('ak-') ? key.slice(3) : key;
  const parts = jwtPart.split('.');
  
  if (parts.length !== 3) {
    if (key.startsWith('ak-') && jwtPart.length < 50) {
      return 'Invalid anon key format. The key should be "ak-" followed by a JWT token (e.g., ak-eyJhbGciOiJIUzI1NiIs...). Copy the full key from your project settings.';
    }
    return 'Invalid key format. Anon keys should start with "ak-" followed by a JWT token. Copy the full key from your Volcano project settings.';
  }
  
  // Check for common copy-paste issues
  if (jwtPart.includes(' ') || jwtPart.includes('\n')) {
    return 'The key contains spaces or line breaks. Make sure to copy the entire key without any extra characters.';
  }
  
  return null;
}

export default function ConfigPrompt({ onConfigured, initialApiUrl = 'http://localhost:8000' }: ConfigPromptProps) {
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

    if (!anonKey) {
      setError('Anon Key is required');
      return;
    }

    // Block service keys - they should never be used client-side
    if (isServiceKey(anonKey)) {
      setError(
        'Service keys (sk-*) cannot be used in browser applications. ' +
        'They bypass Row Level Security and would expose your database. ' +
        'Use an anon key (ak-*) instead.'
      );
      return;
    }

    // Check for detailed format error
    const formatError = getKeyFormatError(anonKey);
    if (formatError) {
      setError(formatError);
      return;
    }

    // Validate anon key format (ak-* followed by valid JWT)
    if (!isValidAnonKey(anonKey)) {
      setError('Invalid anon key format. Make sure you copied the complete key from your Volcano project settings.');
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

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h1 style={{ textAlign: 'center' }}>🌋 Volcano Configuration</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Enter your Volcano project credentials to continue
        </p>

        <div className="alert info" style={{ marginBottom: '30px' }}>
          <strong>📝 How to get your credentials:</strong>
          <ol style={{ marginTop: '10px', marginLeft: '20px', fontSize: '14px' }}>
            <li>Start Volcano server: <code>make run</code></li>
            <li>Create a project via the management API</li>
            <li>Generate an anonymous key in project settings</li>
            <li>Enter the credentials below</li>
          </ol>
        </div>

        {error && (
          <div className="alert error" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="apiUrl">
              API URL
              <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
                (usually http://localhost:8000)
              </span>
            </label>
            <input
              type="url"
              id="apiUrl"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="anonKey">
              Anonymous Key
              <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '8px' }}>
                (from project settings)
              </span>
            </label>
            <input
              type="text"
              id="anonKey"
              value={anonKey}
              onChange={(e) => handleAnonKeyChange(e.target.value)}
              placeholder="ak-xxxxxxxxxxxx..."
              required
              style={serviceKeyWarning ? { borderColor: '#dc3545', backgroundColor: '#fff5f5' } : undefined}
            />
            {serviceKeyWarning && (
              <div className="alert error" style={{ marginTop: '8px', padding: '10px', fontSize: '13px' }}>
                <strong>Security Error:</strong> You are entering a service key (sk-*). 
                Service keys bypass Row Level Security and must NEVER be used in browser applications. 
                Use an anon key (ak-*) instead.
              </div>
            )}
            <small style={{ color: '#666', fontSize: '12px' }}>
              Get this from: Project Settings → Authentication → Anonymous Keys
            </small>
          </div>

          <button type="submit" style={{ width: '100%', marginTop: '20px' }}>
            💾 Save Configuration
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="secondary"
            style={{ width: '100%', marginTop: '10px' }}
          >
            🔄 Clear Saved Config
          </button>
        </form>

        <div className="alert warning" style={{ marginTop: '30px', fontSize: '13px' }}>
          <strong>💡 Tip:</strong> You can also set these in <code>.env.local</code> to skip this prompt:
          <pre style={{ marginTop: '10px', background: '#2d2d2d', color: '#f8f8f2', padding: '10px', borderRadius: '4px', fontSize: '11px' }}>
{`NEXT_PUBLIC_VOLCANO_API_URL=http://localhost:8000
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-xxxxxxxxxxxx`}
          </pre>
          <p style={{ marginTop: '10px', color: '#856404' }}>
            <strong>Important:</strong> Only use anon keys (ak-*) in browser apps. 
            Never use service keys (sk-*) client-side.
          </p>
        </div>
      </div>
    </div>
  );
}

