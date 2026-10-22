import type { FileStorage } from './useFileStorage';

export default function UploadDropzone({ storage }: { storage: FileStorage }) {
  const { dragActive, handleDrag, handleDrop, fileInputRef, handleUpload, uploading } = storage;

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        border: `2px dashed ${dragActive ? '#667eea' : '#ddd'}`,
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: dragActive ? '#f0f4ff' : '#fafafa',
        transition: 'all 0.3s ease',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleUpload(e.target.files)}
        style={{ display: 'none' }}
      />
      {uploading ? (
        <>
          <div className="loading" style={{ margin: '0 auto 10px' }}></div>
          <p style={{ color: '#666' }}>Uploading...</p>
        </>
      ) : (
        <>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📤</div>
          <p style={{ color: '#666', marginBottom: '5px' }}>
            <strong>Click to upload</strong> or drag and drop
          </p>
          <p style={{ color: '#999', fontSize: '14px' }}>Multiple files supported</p>
        </>
      )}
    </div>
  );
}
