'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';

interface StorageObject {
  id: string;
  bucket_id: string;
  name: string;
  owner_id?: string;
  is_public: boolean;
  size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
  public_url?: string; // Set by API for public files - shareable URL requiring no authentication
}

// Default bucket name
const DEFAULT_BUCKET_NAME = 'user-files';
const BUCKET_STORAGE_KEY = 'volcano_storage_bucket';

export default function FilesPage() {
  const router = useRouter();
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const [files, setFiles] = useState<StorageObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bucketName, setBucketName] = useState(DEFAULT_BUCKET_NAME);
  const [bucketInput, setBucketInput] = useState(DEFAULT_BUCKET_NAME);
  const [bucketConnected, setBucketConnected] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Copy public URL to clipboard (uses API-provided public_url)
  const handleCopyPublicUrl = useCallback(async (file: StorageObject) => {
    // Use the public_url provided by the API - it's the authoritative source
    // with proper URL encoding handled server-side
    const url = file.public_url;
    if (!url) {
      setMessage('Could not get public URL - file may not be public');
      setMessageType('error');
      return;
    }

    try {
      // Use modern Clipboard API if available (requires HTTPS)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-HTTPS or older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedFileId(file.id);
      setMessage(`Public URL copied to clipboard!`);
      setMessageType('success');
      setTimeout(() => setCopiedFileId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setMessage('Failed to copy URL to clipboard');
      setMessageType('error');
    }
  }, []);

  const loadFiles = useCallback(async (bucket: string) => {
    if (!volcano || !bucket) return;

    setLoading(true);
    try {
      const { data, error } = await volcano.storage
        .from(bucket)
        .list();

      if (error) {
        // If bucket doesn't exist or no access, show error
        if (error.message.includes('not found') || error.message.includes('denied')) {
          setFiles([]);
          setBucketConnected(false);
          setMessage(`Bucket "${bucket}" not found or access denied. Create it in Storage Settings.`);
          setMessageType('error');
          return;
        }
        throw error;
      }

      setFiles(data || []);
      setBucketConnected(true);
      setMessage('');
    } catch (error) {
      console.error('Failed to load files:', error);
      setMessage('Failed to load files. Make sure the bucket exists.');
      setMessageType('error');
      setBucketConnected(false);
    } finally {
      setLoading(false);
    }
  }, [volcano]);

  useEffect(() => {
    // Load saved bucket name from localStorage
    const savedBucket = localStorage.getItem(BUCKET_STORAGE_KEY);
    if (savedBucket) {
      setBucketName(savedBucket);
      setBucketInput(savedBucket);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!volcano) return;

      try {
        const { user, error } = await volcano.auth.getUser();
        if (error || !user) {
          router.push('/auth');
          return;
        }
        loadFiles(bucketName);
      } catch {
        router.push('/auth');
      }
    };

    checkAuth();
  }, [volcano, router, loadFiles, bucketName]);

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading || loading) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="loading" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const handleChangeBucket = () => {
    if (!bucketInput.trim()) return;
    const newBucket = bucketInput.trim();
    setBucketName(newBucket);
    localStorage.setItem(BUCKET_STORAGE_KEY, newBucket);
    setBucketConnected(false);
    loadFiles(newBucket);
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !volcano) return;

    setUploading(true);
    setMessage('');

    const uploadedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const { error } = await volcano.storage
          .from(bucketName)
          .upload(file.name, file);

        if (error) {
          console.error(`Upload error for ${file.name}:`, error.message);
          failedFiles.push(`${file.name} (${error.message})`);
        } else {
          uploadedFiles.push(file.name);
        }
      } catch (err) {
        console.error(`Upload exception for ${file.name}:`, err);
        failedFiles.push(`${file.name} (network error)`);
      }
    }

    setUploading(false);

    if (uploadedFiles.length > 0) {
      setMessage(`Uploaded ${uploadedFiles.length} file(s) successfully!`);
      setMessageType('success');
      loadFiles(bucketName);
    }

    if (failedFiles.length > 0) {
      setMessage(`Failed to upload: ${failedFiles.join(', ')}`);
      setMessageType('error');
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (file: StorageObject) => {
    if (!volcano) return;

    try {
      const { data, error } = await volcano.storage
        .from(bucketName)
        .download(file.name);

      if (error) {
        setMessage(`Failed to download: ${error.message}`);
        setMessageType('error');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.split('/').pop() || file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage(`Downloaded ${file.name}`);
      setMessageType('success');
    } catch (error) {
      setMessage(`Failed to download: ${(error as Error).message}`);
      setMessageType('error');
    }
  };

  const handleDelete = async (file: StorageObject) => {
    if (!volcano) return;

    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return;
    }

    try {
      const { error } = await volcano.storage
        .from(bucketName)
        .remove(file.name);

      if (error) {
        setMessage(`Failed to delete: ${error.message}`);
        setMessageType('error');
        return;
      }

      setMessage(`Deleted ${file.name}`);
      setMessageType('success');
      loadFiles(bucketName);
    } catch (error) {
      setMessage(`Failed to delete: ${(error as Error).message}`);
      setMessageType('error');
    }
  };

  const handleToggleVisibility = async (file: StorageObject) => {
    if (!volcano) return;

    const newVisibility = !file.is_public;
    try {
      const { error } = await volcano.storage
        .from(bucketName)
        .updateVisibility(file.name, newVisibility);

      if (error) {
        setMessage(`Failed to update visibility: ${error.message}`);
        setMessageType('error');
        return;
      }

      setMessage(`${file.name} is now ${newVisibility ? 'public' : 'private'}`);
      setMessageType('success');
      loadFiles(bucketName);
    } catch (error) {
      setMessage(`Failed to update visibility: ${(error as Error).message}`);
      setMessageType('error');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

  return (
    <div className="container">
      <nav>
        <h1>🌋 Volcano Storage</h1>
        <div className="nav-links">
          <Link href="/dashboard">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="card">
        <h1>📁 File Storage</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Upload, download, and manage your files using Volcano Storage.
        </p>

        {/* Bucket Selector */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '16px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
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
              flex: '1'
            }}
          />
          <button
            onClick={handleChangeBucket}
            className="secondary"
            style={{ padding: '8px 16px', margin: 0 }}
          >
            Connect
          </button>
          {bucketConnected && (
            <span style={{ 
              color: '#28a745', 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ✓ Connected to <strong>{bucketName}</strong>
            </span>
          )}
        </div>

        {message && (
          <div className={`alert ${messageType}`}>
            {message}
          </div>
        )}

        {/* Upload Section */}
        <div style={{ marginBottom: '30px' }}>
          <h2>Upload Files</h2>
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
              transition: 'all 0.3s ease'
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
                <p style={{ color: '#999', fontSize: '14px' }}>
                  Multiple files supported
                </p>
              </>
            )}
          </div>
        </div>

        {/* Files List */}
        <h2>Your Files</h2>
        {files.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            color: '#666'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📂</div>
            <p>No files yet. Upload some files to get started!</p>
          </div>
        ) : (
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
                {files.map((file) => (
                  <tr key={file.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ marginRight: '8px' }}>{getFileIcon(file.mime_type)}</span>
                      <span style={{ fontWeight: 500 }}>{file.name}</span>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#666' }}>
                      {formatFileSize(file.size)}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleVisibility(file)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            backgroundColor: file.is_public ? '#d4edda' : '#f8d7da',
                            color: file.is_public ? '#155724' : '#721c24',
                            fontWeight: 500
                          }}
                        >
                          {file.is_public ? '🌐 Public' : '🔒 Private'}
                        </button>
                        {file.is_public && (
                          <button
                            onClick={() => handleCopyPublicUrl(file)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              border: '1px solid #28a745',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              backgroundColor: copiedFileId === file.id ? '#28a745' : 'transparent',
                              color: copiedFileId === file.id ? 'white' : '#28a745',
                              fontWeight: 500,
                              transition: 'all 0.2s'
                            }}
                            title="Copy public URL"
                          >
                            {copiedFileId === file.id ? '✓ Copied' : '🔗 Copy URL'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#666', fontSize: '14px' }}>
                      {new Date(file.updated_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDownload(file)}
                        className="secondary"
                        style={{ marginRight: '8px', padding: '6px 12px', fontSize: '14px' }}
                      >
                        ⬇️ Download
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '14px',
                          backgroundColor: '#dc3545',
                          margin: 0
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Section */}
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
          <h3 style={{ marginBottom: '10px' }}>About Volcano Storage</h3>
          <ul style={{ marginLeft: '20px', color: '#666', fontSize: '14px', lineHeight: '1.8' }}>
            <li>Files are stored securely in Volcano Storage</li>
            <li>Access is controlled by RLS-style policies</li>
            <li>Each user can only access their own files by default</li>
            <li>Maximum file size depends on your plan limits</li>
          </ul>
        </div>

        {/* Setup Instructions */}
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '12px', border: '1px solid #ffc107' }}>
          <h3 style={{ marginBottom: '10px', color: '#856404' }}>Setup Required</h3>
          <p style={{ color: '#856404', fontSize: '14px', marginBottom: '10px' }}>
            To use storage, you need a bucket configured with policies. Enter the bucket name above, then:
          </p>
          <ol style={{ marginLeft: '20px', color: '#856404', fontSize: '14px', lineHeight: '1.8' }}>
            <li>Go to the Volcano admin GUI → Storage Settings</li>
            <li>Create a bucket (or use an existing one)</li>
            <li>Add an INSERT policy: <code>auth.uid() IS NOT NULL</code> (for uploads)</li>
            <li>Add a SELECT policy: <code>auth.uid() = owner_id</code> (for listing/downloading own files)</li>
            <li>Add an UPDATE policy: <code>auth.uid() = owner_id</code> (for visibility changes)</li>
            <li>Add a DELETE policy: <code>auth.uid() = owner_id</code> (for deletions)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
