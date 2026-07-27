// Dynamic configuration management for Volcano SDK
// Stores credentials in localStorage if not in environment variables

export interface VolcanoCredentials {
  apiUrl: string;
  anonKey: string;
}

const STORAGE_KEY = 'volcano_config';

export function getStoredConfig(): VolcanoCredentials | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load stored config:', error);
  }
  
  return null;
}

export function saveConfig(config: VolcanoCredentials): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

export function clearConfig(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
}

export function getConfig(): VolcanoCredentials {
  // First try environment variables
  const envConfig = {
    apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL,
    anonKey: process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY,
  };

  // If all env vars are set, use them
  if (envConfig.apiUrl && envConfig.anonKey) {
    return envConfig as VolcanoCredentials;
  }

  // Otherwise, try localStorage
  const storedConfig = getStoredConfig();
  if (storedConfig && storedConfig.anonKey) {
    return {
      apiUrl: storedConfig.apiUrl || envConfig.apiUrl || 'http://localhost:8000',
      anonKey: storedConfig.anonKey,
    };
  }

  // Return defaults (will need configuration)
  return {
    apiUrl: envConfig.apiUrl || 'http://localhost:8000',
    anonKey: '',
  };
}

export function isConfigured(): boolean {
  const config = getConfig();
  return !!config.anonKey;
}

