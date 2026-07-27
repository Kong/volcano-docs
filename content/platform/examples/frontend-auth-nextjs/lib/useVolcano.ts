// Custom hook for Volcano SDK with dynamic configuration
import { useState, useEffect } from 'react';
import { getConfig, isConfigured } from './config';

// Minimal type for user object (used by pages for type hints)
export interface VolcanoUser {
  id: string;
  email: string;
  email_confirmed: boolean;
  status: string;
  user_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
  email_change?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VolcanoClient = any;

export function useVolcano() {
  const [volcano, setVolcano] = useState<VolcanoClient | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

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
    reload,
  };
}
