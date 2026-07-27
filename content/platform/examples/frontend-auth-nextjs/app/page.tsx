'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useVolcano } from '../lib/useVolcano';
import ConfigPrompt from '../components/ConfigPrompt';
import { clearConfig, getConfig } from '../lib/config';

export default function Home() {
  const { configured, reload } = useVolcano();
  const [showConfig, setShowConfig] = useState(false);

  const handleReconfigure = () => {
    clearConfig();
    reload();
  };

  if (!configured || showConfig) {
    return <ConfigPrompt onConfigured={() => { setShowConfig(false); reload(); }} />;
  }

  const config = getConfig();

  return (
    <div className="container">
      <div className="card">
        <h1>🌋 Volcano Auth - Next.js Examples</h1>
        <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
          Interactive examples demonstrating Volcano Hosting authentication patterns
        </p>

        <div className="alert success" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#155724' }}>
              ✅ Configured!
            </h3>
            <p style={{ margin: '8px 0 0 0', color: '#155724', fontSize: '14px' }}>
              Your Volcano credentials are set. Ready to explore the examples below.
            </p>
          </div>
          
          <div style={{ 
            marginTop: '20px', 
            paddingTop: '20px', 
            borderTop: '1px solid rgba(21, 87, 36, 0.2)'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '14px', color: '#155724' }}>Current Configuration:</strong>
            </div>
            <div style={{ 
              display: 'grid', 
              gap: '8px', 
              fontSize: '13px',
              color: '#155724'
            }}>
              <div>
                <span style={{ fontWeight: '500' }}>API URL:</span>{' '}
                <code style={{ 
                  background: 'rgba(21, 87, 36, 0.1)', 
                  padding: '2px 6px', 
                  borderRadius: '3px',
                  fontSize: '12px'
                }}>
                  {config.apiUrl}
                </code>
              </div>
              <div>
                <span style={{ fontWeight: '500' }}>Anon Key:</span>{' '}
                <code style={{ 
                  background: 'rgba(21, 87, 36, 0.1)', 
                  padding: '2px 6px', 
                  borderRadius: '3px',
                  fontSize: '12px'
                }}>
                  {config.anonKey.substring(0, 10)}...{config.anonKey.substring(config.anonKey.length - 6)}
                </code>
              </div>
            </div>
            
            <button 
              onClick={handleReconfigure}
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
                transition: 'all 0.2s'
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
          </div>
        </div>

        <h2>Examples</h2>

        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {/* Basic Auth Example */}
          <div style={{ 
            background: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #e0e0e0'
          }}>
            <h3>📧 Email/Password Authentication</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
              Traditional signup and signin flow with email and password.
            </p>
            <Link href="/auth">
              <button>Try Email Auth →</button>
            </Link>
          </div>

          {/* Anonymous User Example */}
          <div style={{ 
            background: '#fff3cd', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #ffc107'
          }}>
            <h3>👤 Anonymous User Conversion</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
              Let users try your app without signup, then convert to permanent account.
              Perfect for reducing friction!
            </p>
            <Link href="/anonymous">
              <button>Try Anonymous Flow →</button>
            </Link>
          </div>

          {/* Dashboard Example */}
          <div style={{ 
            background: '#d1ecf1', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #17a2b8'
          }}>
            <h3>🏠 User Dashboard</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
              Protected route showing user profile and session management.
            </p>
            <Link href="/dashboard">
              <button>View Dashboard →</button>
            </Link>
          </div>

          {/* Password Reset Example */}
          <div style={{ 
            background: '#f8d7da', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #dc3545'
          }}>
            <h3>🔐 Password Recovery</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
              Forgot password flow with email recovery token.
            </p>
            <Link href="/password-reset">
              <button>Try Password Reset →</button>
            </Link>
          </div>

          {/* Email Change Example */}
          <div style={{ 
            background: '#d4edda', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #28a745'
          }}>
            <h3>📧 Change Email Address</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
              Secure email change with confirmation flow.
            </p>
            <Link href="/email-change">
              <button>Try Email Change →</button>
            </Link>
          </div>

          {/* OAuth Linking Example */}
          <div style={{ 
            background: '#e2e3e5', 
            padding: '20px', 
            borderRadius: '8px',
            border: '2px solid #6c757d'
          }}>
            <h3>🔗 Link OAuth Providers</h3>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
              Connect Google, GitHub, and other OAuth providers to your account.
            </p>
            <Link href="/oauth-linking">
              <button>Manage OAuth Providers →</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

