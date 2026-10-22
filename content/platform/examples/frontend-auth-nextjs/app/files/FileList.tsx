import type { StorageObject } from '@volcano.dev/sdk';
import type { FileStorage } from './useFileStorage';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return '📦';
  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('xml')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📃';
  return '📁';
};

interface FileRowProps {
  file: StorageObject;
  storage: FileStorage;
}

export default function FileList({ storage }: { storage: FileStorage }) {
  if (storage.files.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          color: '#666',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>📂</div>
        <p>No files yet. Upload some files to get started!</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee' }}>
            <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666' }}>Size</th>
            <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666' }}>Visibility</th>
            <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666' }}>Updated</th>
            <th style={{ textAlign: 'right', padding: '12px 8px', color: '#666' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {storage.files.map((file) => (
            <FileRow key={file.id} file={file} storage={storage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({ file, storage }: FileRowProps) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '12px 8px' }}>
        <span style={{ marginRight: '8px' }}>{getFileIcon(file.mime_type)}</span>
        <span style={{ fontWeight: 500 }}>{file.name}</span>
      </td>
      <td style={{ padding: '12px 8px', color: '#666' }}>{formatFileSize(file.size)}</td>
      <td style={{ padding: '12px 8px' }}>
        <VisibilityControls file={file} storage={storage} />
      </td>
      <td style={{ padding: '12px 8px', color: '#666', fontSize: '14px' }}>
        {file.updated_at ? new Date(file.updated_at).toLocaleDateString() : ''}
      </td>
      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
        <button
          onClick={() => storage.handleDownload(file)}
          className="secondary"
          style={{ marginRight: '8px', padding: '6px 12px', fontSize: '14px' }}
        >
          ⬇️ Download
        </button>
        <button
          onClick={() => storage.handleDelete(file)}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            backgroundColor: '#dc3545',
            margin: 0,
          }}
        >
          🗑️ Delete
        </button>
      </td>
    </tr>
  );
}

// The public/private toggle, and a button to copy a public file's URL
function VisibilityControls({ file, storage }: FileRowProps) {
  const copied = storage.copiedFileId === file.id;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={() => storage.handleToggleVisibility(file)}
        style={{
          padding: '4px 10px',
          fontSize: '12px',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          backgroundColor: file.is_public ? '#d4edda' : '#f8d7da',
          color: file.is_public ? '#155724' : '#721c24',
          fontWeight: 500,
        }}
      >
        {file.is_public ? '🌐 Public' : '🔒 Private'}
      </button>
      {file.is_public && (
        <button
          onClick={() => storage.handleCopyPublicUrl(file)}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid #28a745',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: copied ? '#28a745' : 'transparent',
            color: copied ? 'white' : '#28a745',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
          title="Copy public URL"
        >
          {copied ? '✓ Copied' : '🔗 Copy URL'}
        </button>
      )}
    </div>
  );
}
