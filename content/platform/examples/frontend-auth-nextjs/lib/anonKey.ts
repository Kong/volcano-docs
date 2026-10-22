// Checks on the anon key entered in ConfigPrompt, before it's saved

// Check if the key is a service key (should never be used client-side)
export function isServiceKey(key: string): boolean {
  return key.startsWith('sk-');
}

// Validate JWT structure (basic check without cryptographic verification)
function isValidJWT(token: string): boolean {
  // JWTs have 3 base64url-encoded parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  // Check each part is valid base64url (alphanumeric, -, _, no padding)
  const base64urlPattern = /^[A-Za-z0-9_-]+$/u;
  return parts.every((part) => part.length > 0 && base64urlPattern.test(part));
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
    // Handled separately as service key
    return null;
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

// Returns why the key can't be saved as the anon key, or null if it can
export function anonKeyError(anonKey: string): string | null {
  if (!anonKey) {
    return 'Anon Key is required';
  }

  // Block service keys - they should never be used client-side
  if (isServiceKey(anonKey)) {
    return (
      'Service keys (sk-*) cannot be used in browser applications. ' +
      'They bypass Row Level Security and would expose your database. ' +
      'Use an anon key (ak-*) instead.'
    );
  }

  // Check for detailed format error
  const formatError = getKeyFormatError(anonKey);
  if (formatError) {
    return formatError;
  }

  // Validate anon key format (ak-* followed by valid JWT)
  if (!isValidAnonKey(anonKey)) {
    return 'Invalid anon key format. Make sure you copied the complete key from your Volcano project settings.';
  }

  return null;
}
