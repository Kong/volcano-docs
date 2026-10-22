import type { FileStorage } from './useFileStorage';

export default function BucketSelector({ storage }: { storage: FileStorage }) {
  const { bucketInput, setBucketInput, handleChangeBucket, bucketConnected, bucketName } = storage;

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <label style={{ fontWeight: 500, color: '#333' }}>Bucket:</label>
      <input
        type="text"
        value={bucketInput}
        onChange={(e) => setBucketInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleChangeBucket()}
        placeholder="Enter bucket name"
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          fontSize: '14px',
          minWidth: '200px',
          flex: '1',
        }}
      />
      <button onClick={handleChangeBucket} className="secondary" style={{ padding: '8px 16px', margin: 0 }}>
        Connect
      </button>
      {bucketConnected && (
        <span style={{ color: '#28a745', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ✓ Connected to <strong>{bucketName}</strong>
        </span>
      )}
    </div>
  );
}
