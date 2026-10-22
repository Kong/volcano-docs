import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { StorageObject, VolcanoAuth } from '@volcano.dev/sdk';
import { useStatusMessage, type MessageType } from '../../lib/useStatusMessage';
import {
  copyToClipboard,
  deleteFile,
  downloadFile,
  toggleVisibility,
  uploadFiles,
  type FileActionContext,
} from './fileActions';

type ShowMessage = (text: string, type: MessageType) => void;

// Default bucket name
const DEFAULT_BUCKET_NAME = 'user-files';
const BUCKET_STORAGE_KEY = 'volcano_storage_bucket';

// The bucket name, starting from the one saved in localStorage
function useBucket() {
  const [bucketName, setBucketName] = useState(DEFAULT_BUCKET_NAME);
  const [bucketInput, setBucketInput] = useState(DEFAULT_BUCKET_NAME);

  useEffect(() => {
    // Load saved bucket name from localStorage
    const savedBucket = localStorage.getItem(BUCKET_STORAGE_KEY);
    if (savedBucket) {
      setBucketName(savedBucket);
      setBucketInput(savedBucket);
    }
  }, []);

  return { bucketName, setBucketName, bucketInput, setBucketInput };
}

// The bucket's files, and whether the bucket could be listed
function useFileList(volcano: VolcanoAuth | null, showMessage: ShowMessage, setMessage: (text: string) => void) {
  const [files, setFiles] = useState<StorageObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketConnected, setBucketConnected] = useState(false);

  const loadFiles = useCallback(
    async (bucket: string) => {
      if (!volcano || !bucket) return;

      setLoading(true);
      try {
        const { data, error } = await volcano.storage.from(bucket).list();

        if (error) {
          // If bucket doesn't exist or no access, show error
          if (error.message.includes('not found') || error.message.includes('denied')) {
            setFiles([]);
            setBucketConnected(false);
            showMessage(`Bucket "${bucket}" not found or access denied. Create it in Storage Settings.`, 'error');
            return;
          }
          throw error;
        }

        setFiles(data || []);
        setBucketConnected(true);
        setMessage('');
      } catch (error) {
        console.error('Failed to load files:', error);
        showMessage('Failed to load files. Make sure the bucket exists.', 'error');
        setBucketConnected(false);
      } finally {
        setLoading(false);
      }
    },
    [volcano, showMessage, setMessage],
  );

  return { files, loading, bucketConnected, setBucketConnected, loadFiles };
}

// Lists the files once the user is signed in, or sends them to sign in
function useLoadFilesWhenSignedIn(
  volcano: VolcanoAuth | null,
  bucketName: string,
  loadFiles: (bucket: string) => void,
) {
  const router = useRouter();

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
}

// Copies a public file's URL, and marks the file as copied for two seconds
function useCopyPublicUrl(showMessage: ShowMessage) {
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Copy public URL to clipboard (uses API-provided public_url)
  const handleCopyPublicUrl = useCallback(
    async (file: StorageObject) => {
      // Use the public_url provided by the API - it's the authoritative source
      // with proper URL encoding handled server-side
      const url = file.public_url;
      if (!url) {
        showMessage('Could not get public URL - file may not be public', 'error');
        return;
      }

      try {
        await copyToClipboard(url);
        setCopiedFileId(file.id);
        showMessage(`Public URL copied to clipboard!`, 'success');
        setTimeout(() => setCopiedFileId(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showMessage('Failed to copy URL to clipboard', 'error');
      }
    },
    [showMessage],
  );

  return { copiedFileId, handleCopyPublicUrl };
}

function useUpload(context: FileActionContext, setMessage: (text: string) => void) {
  const { volcano, bucketName, showMessage, loadFiles } = context;
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !volcano) return;

    setUploading(true);
    setMessage('');

    const { uploadedFiles, failedFiles } = await uploadFiles(volcano, bucketName, fileList);

    setUploading(false);

    if (uploadedFiles.length > 0) {
      showMessage(`Uploaded ${uploadedFiles.length} file(s) successfully!`, 'success');
      loadFiles(bucketName);
    }

    if (failedFiles.length > 0) {
      showMessage(`Failed to upload: ${failedFiles.join(', ')}`, 'error');
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return { uploading, fileInputRef, handleUpload };
}

// Highlights the drop zone while files are dragged over it, and uploads dropped files
function useDragAndDrop(handleUpload: (fileList: FileList | null) => void) {
  const [dragActive, setDragActive] = useState(false);

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

  return { dragActive, handleDrag, handleDrop };
}

export function useFileStorage(volcano: VolcanoAuth | null) {
  const status = useStatusMessage();
  const bucket = useBucket();
  const fileList = useFileList(volcano, status.showMessage, status.setMessage);
  useLoadFilesWhenSignedIn(volcano, bucket.bucketName, fileList.loadFiles);
  const copy = useCopyPublicUrl(status.showMessage);
  const context = {
    volcano,
    bucketName: bucket.bucketName,
    showMessage: status.showMessage,
    loadFiles: fileList.loadFiles,
  };
  const upload = useUpload(context, status.setMessage);
  const dragAndDrop = useDragAndDrop(upload.handleUpload);

  const handleChangeBucket = () => {
    if (!bucket.bucketInput.trim()) return;
    const newBucket = bucket.bucketInput.trim();
    bucket.setBucketName(newBucket);
    localStorage.setItem(BUCKET_STORAGE_KEY, newBucket);
    fileList.setBucketConnected(false);
    fileList.loadFiles(newBucket);
  };

  return {
    ...status,
    ...bucket,
    ...fileList,
    ...copy,
    ...upload,
    ...dragAndDrop,
    handleChangeBucket,
    handleDownload: (file: StorageObject) => downloadFile(context, file),
    handleDelete: (file: StorageObject) => deleteFile(context, file),
    handleToggleVisibility: (file: StorageObject) => toggleVisibility(context, file),
  };
}

export type FileStorage = ReturnType<typeof useFileStorage>;
