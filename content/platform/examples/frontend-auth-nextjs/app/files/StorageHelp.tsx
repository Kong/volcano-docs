// Info Section
export function StorageInfo() {
  return (
    <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
      <h3 style={{ marginBottom: '10px' }}>About Volcano Storage</h3>
      <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
        <li>Files are stored securely in Volcano Storage</li>
        <li>Access is controlled by RLS-style policies</li>
        <li>Each user can only access their own files by default</li>
        <li>Maximum file size depends on your plan limits</li>
      </ul>
    </div>
  );
}

// Setup Instructions
export function SetupInstructions() {
  return (
    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#fff3cd',
        borderRadius: '12px',
        border: '1px solid #ffc107',
      }}
    >
      <h3 style={{ marginBottom: '10px', color: '#856404' }}>Setup Required</h3>
      <p style={{ color: '#856404', fontSize: '14px', marginBottom: '10px' }}>
        To use storage, you need a bucket configured with policies. Enter the bucket name above, then:
      </p>
      <ol style={{ marginLeft: '20px', color: '#856404', fontSize: '14px', lineHeight: '1.8' }}>
        <li>Go to the Volcano admin GUI → Storage Settings</li>
        <li>Create a bucket (or use an existing one)</li>
        <li>
          Add an INSERT policy: <code>auth.uid() IS NOT NULL</code> (for uploads)
        </li>
        <li>
          Add a SELECT policy: <code>auth.uid() = owner_id</code> (for listing/downloading own files)
        </li>
        <li>
          Add an UPDATE policy: <code>auth.uid() = owner_id</code> (for visibility changes)
        </li>
        <li>
          Add a DELETE policy: <code>auth.uid() = owner_id</code> (for deletions)
        </li>
      </ol>
    </div>
  );
}
