import { useState } from 'react';
import type { VolcanoUser } from '../../lib/useVolcano';
import type { MessageType } from '../../lib/useStatusMessage';

export interface MetadataField {
  key: string;
  value: string;
}

// The user's metadata, except the fields the dashboard shows on their own
export function customMetadataFields(user: VolcanoUser): MetadataField[] {
  const reservedKeys = ['name', 'anonymous', 'avatar_url'];
  return Object.entries(user.user_metadata || {})
    .filter(([key]) => !reservedKeys.includes(key))
    .map(([key, value]) => ({ key, value: String(value) }));
}

// Edits the custom metadata fields: change or remove a field, or add a new one
export function useMetadataEditor(
  customMetadata: MetadataField[],
  setCustomMetadata: (fields: MetadataField[]) => void,
  showMessage: (text: string, type: MessageType) => void,
) {
  const [newMetadataKey, setNewMetadataKey] = useState('');
  const [newMetadataValue, setNewMetadataValue] = useState('');

  const addMetadataField = () => {
    if (!newMetadataKey.trim()) return;
    // Check if key already exists
    if (customMetadata.some((f) => f.key === newMetadataKey.trim())) {
      showMessage('Metadata key already exists', 'error');
      return;
    }
    setCustomMetadata([...customMetadata, { key: newMetadataKey.trim(), value: newMetadataValue }]);
    setNewMetadataKey('');
    setNewMetadataValue('');
  };

  const removeMetadataField = (index: number) => {
    setCustomMetadata(customMetadata.filter((_, i) => i !== index));
  };

  const updateMetadataField = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = [...customMetadata];
    updated[index] = { ...updated[index], [field]: newValue };
    setCustomMetadata(updated);
  };

  return {
    customMetadata,
    newMetadataKey,
    setNewMetadataKey,
    newMetadataValue,
    setNewMetadataValue,
    addMetadataField,
    removeMetadataField,
    updateMetadataField,
  };
}

export type MetadataEditor = ReturnType<typeof useMetadataEditor>;
