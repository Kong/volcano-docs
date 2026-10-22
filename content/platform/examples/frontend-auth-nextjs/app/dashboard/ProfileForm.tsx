import FormField from '../../components/FormField';
import { passwordPlaceholder, type PasswordPolicy } from '../../lib/useVolcano';
import type { Dashboard } from './useDashboard';
import type { MetadataEditor } from './useMetadataEditor';

interface ProfileFormProps {
  dashboard: Dashboard;
  passwordPolicy: PasswordPolicy | null;
}

export default function ProfileForm({ dashboard, passwordPolicy }: ProfileFormProps) {
  const { updateName, setUpdateName, updatePassword, setUpdatePassword, loading } = dashboard;

  return (
    <form onSubmit={dashboard.handleUpdateProfile}>
      <FormField
        id="updateName"
        label="Name"
        type="text"
        value={updateName}
        onChange={(e) => setUpdateName(e.target.value)}
        placeholder="Your name"
      />

      <FormField
        id="updatePassword"
        label="Change Password (leave empty to keep current)"
        type="password"
        value={updatePassword}
        onChange={(e) => setUpdatePassword(e.target.value)}
        placeholder={passwordPlaceholder(passwordPolicy)}
        disabled={!passwordPolicy}
      />

      {/* Custom Metadata Section */}
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>📝 Custom Metadata</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
          Add custom key-value pairs to store additional user information.
        </p>

        <MetadataFields editor={dashboard.metadataEditor} />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Updating...' : '💾 Update Profile'}
      </button>
    </form>
  );
}

function MetadataFields({ editor }: { editor: MetadataEditor }) {
  return (
    <>
      {/* Existing metadata fields */}
      {editor.customMetadata.map((field, index) => (
        <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={field.key}
            onChange={(e) => editor.updateMetadataField(index, 'key', e.target.value)}
            placeholder="Key"
            style={{ flex: 1 }}
          />
          <input
            type="text"
            value={field.value}
            onChange={(e) => editor.updateMetadataField(index, 'value', e.target.value)}
            placeholder="Value"
            style={{ flex: 2 }}
          />
          <button
            type="button"
            onClick={() => editor.removeMetadataField(index)}
            className="secondary"
            style={{ padding: '8px 12px', margin: 0 }}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add new metadata field */}
      <NewMetadataField editor={editor} />
    </>
  );
}

function NewMetadataField({ editor }: { editor: MetadataEditor }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
      <input
        type="text"
        value={editor.newMetadataKey}
        onChange={(e) => editor.setNewMetadataKey(e.target.value)}
        placeholder="New key"
        style={{ flex: 1 }}
      />
      <input
        type="text"
        value={editor.newMetadataValue}
        onChange={(e) => editor.setNewMetadataValue(e.target.value)}
        placeholder="Value"
        style={{ flex: 2 }}
      />
      <button
        type="button"
        onClick={editor.addMetadataField}
        className="secondary"
        style={{ padding: '8px 12px', margin: 0 }}
      >
        + Add
      </button>
    </div>
  );
}
