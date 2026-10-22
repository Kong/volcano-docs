'use client';

import { useState } from 'react';
import { useVolcano } from '../lib/useVolcano';
import ConfigPrompt from '../components/ConfigPrompt';
import { clearConfig, getConfig } from '../lib/config';
import ConfigSummary from './ConfigSummary';
import ExampleCard, { type Example } from './ExampleCard';

const EXAMPLES: Example[] = [
  {
    title: '📧 Email/Password Authentication',
    description: 'Traditional signup and signin flow with email and password.',
    href: '/auth',
    buttonLabel: 'Try Email Auth →',
    background: '#f8f9fa',
    borderColor: '#e0e0e0',
  },
  {
    title: '👤 Anonymous User Conversion',
    description:
      'Let users try your app without signup, then convert to permanent account. Perfect for reducing friction!',
    href: '/anonymous',
    buttonLabel: 'Try Anonymous Flow →',
    background: '#fff3cd',
    borderColor: '#ffc107',
  },
  {
    title: '🏠 User Dashboard',
    description: 'Protected route showing user profile and session management.',
    href: '/dashboard',
    buttonLabel: 'View Dashboard →',
    background: '#d1ecf1',
    borderColor: '#17a2b8',
  },
  {
    title: '🔐 Password Recovery',
    description: 'Forgot password flow with email recovery token.',
    href: '/password-reset',
    buttonLabel: 'Try Password Reset →',
    background: '#f8d7da',
    borderColor: '#dc3545',
  },
  {
    title: '📧 Change Email Address',
    description: 'Secure email change with confirmation flow.',
    href: '/email-change',
    buttonLabel: 'Try Email Change →',
    background: '#d4edda',
    borderColor: '#28a745',
  },
  {
    title: '🔗 Link OAuth Providers',
    description: 'Connect Google, GitHub, and other OAuth providers to your account.',
    href: '/oauth-linking',
    buttonLabel: 'Manage OAuth Providers →',
    background: '#e2e3e5',
    borderColor: '#6c757d',
  },
];

export default function Home() {
  const { configured, reload } = useVolcano();
  const [showConfig, setShowConfig] = useState(false);

  const handleReconfigure = () => {
    clearConfig();
    reload();
  };

  if (!configured || showConfig) {
    return (
      <ConfigPrompt
        onConfigured={() => {
          setShowConfig(false);
          reload();
        }}
      />
    );
  }

  const config = getConfig();

  return (
    <div className="container">
      <div className="card">
        <h1>🌋 Volcano Auth - Next.js Examples</h1>
        <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
          Interactive examples demonstrating Volcano authentication patterns
        </p>

        <ConfigSummary config={config} onReconfigure={handleReconfigure} />

        <h2>Examples</h2>

        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {EXAMPLES.map((example) => (
            <ExampleCard key={example.href} {...example} />
          ))}
        </div>
      </div>
    </div>
  );
}
