// Custom hook for Volcano SDK with dynamic configuration
import { useState, useEffect } from 'react';
import type { User, VolcanoAuth } from '@volcano.dev/sdk';
import { getConfig, isConfigured } from './config';

export type VolcanoUser = User;

export interface PasswordPolicy {
  effective_min_length: number;
  min_configurable_length: number;
  max_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  compromised_passwords_rejected: boolean;
}

export function normalizedPasswordLength(password: string): number {
  return Array.from(password.normalize('NFC')).length;
}

export function validatePasswordAgainstPolicy(password: string, policy: PasswordPolicy): string | null {
  const normalized = password.normalize('NFC');
  const passwordLength = normalizedPasswordLength(normalized);
  if (passwordLength < policy.effective_min_length || passwordLength > policy.max_length) {
    return `Password must be between ${policy.effective_min_length} and ${policy.max_length} characters`;
  }
  if (policy.require_uppercase && !/[A-Z]/.test(normalized)) return 'Password must include an uppercase letter';
  if (policy.require_lowercase && !/[a-z]/.test(normalized)) return 'Password must include a lowercase letter';
  if (policy.require_numbers && !/[0-9]/.test(normalized)) return 'Password must include a number';
  if (policy.require_special_chars && !'!@#$%^&*()_+-=[]{}|;:,.<>?'.split('').some((char) => normalized.includes(char))) {
    return 'Password must include a special character';
  }
  return null;
}

export function useVolcano() {
  const [volcano, setVolcano] = useState<VolcanoAuth | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);
  const [passwordPolicyError, setPasswordPolicyError] = useState<string | null>(null);

  const loadSDK = async () => {
    setLoading(true);

    // Check if configured
    if (!isConfigured()) {
      setConfigured(false);
      setLoading(false);
      return;
    }

    try {
      const VolcanoAuthClass = (await import('@volcano.dev/sdk')).default;
      const config = getConfig();

      const volcanoClient = new VolcanoAuthClass(config);
      setVolcano(volcanoClient);
      setConfigured(true);
      setPasswordPolicy(null);
      setPasswordPolicyError(null);
      try {
        const response = await fetch(`${config.apiUrl.replace(/\/+$/, '')}/auth/password-policy`, {
          headers: { Authorization: `Bearer ${config.anonKey}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Password policy is temporarily unavailable');
        setPasswordPolicy(await response.json() as PasswordPolicy);
      } catch (policyError) {
        setPasswordPolicyError(
          policyError instanceof Error ? policyError.message : 'Password policy is temporarily unavailable',
        );
      }
    } catch (error) {
      console.error('Failed to load Volcano SDK:', error);
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSDK();
  }, []);

  const reload = () => {
    loadSDK();
  };

  return {
    volcano,
    configured,
    loading,
    passwordPolicy,
    passwordPolicyError,
    reload,
  };
}
