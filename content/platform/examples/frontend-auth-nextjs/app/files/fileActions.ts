import type { StorageObject, VolcanoAuth } from '@volcano.dev/sdk';
import type { MessageType } from '../../lib/useStatusMessage';

// What the file actions need from the page
export interface FileActionContext {
  volcano: VolcanoAuth | null;
  bucketName: string;
  showMessage: (text: string, type: MessageType) => void;
  loadFiles: (bucket: string) => void;
}

// Uploads each file, and returns the ones that uploaded and the ones that failed
export async function uploadFiles(volcano: VolcanoAuth, bucketName: string, fileList: FileList) {
  const uploadedFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const file of Array.from(fileList)) {
    try {
      const { error } = await volcano.storage.from(bucketName).upload(file.name, file);

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

  return { uploadedFiles, failedFiles };
}

export async function downloadFile({ volcano, bucketName, showMessage }: FileActionContext, file: StorageObject) {
  if (!volcano) return;

  try {
    const { data, error } = await volcano.storage.from(bucketName).download(file.name);

    if (error || !data) {
      showMessage(`Failed to download: ${error?.message ?? 'empty response'}`, 'error');
      return;
    }

    // Create download link
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.split('/').pop() || file.name;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showMessage(`Downloaded ${file.name}`, 'success');
  } catch (error) {
    showMessage(`Failed to download: ${(error as Error).message}`, 'error');
  }
}

export async function deleteFile(
  { volcano, bucketName, showMessage, loadFiles }: FileActionContext,
  file: StorageObject,
) {
  if (!volcano) return;

  if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
    return;
  }

  try {
    const { error } = await volcano.storage.from(bucketName).remove(file.name);

    if (error) {
      showMessage(`Failed to delete: ${error.message}`, 'error');
      return;
    }

    showMessage(`Deleted ${file.name}`, 'success');
    loadFiles(bucketName);
  } catch (error) {
    showMessage(`Failed to delete: ${(error as Error).message}`, 'error');
  }
}

export async function toggleVisibility(context: FileActionContext, file: StorageObject) {
  const { volcano, bucketName, showMessage, loadFiles } = context;
  if (!volcano) return;

  const newVisibility = !file.is_public;
  try {
    const { error } = await volcano.storage.from(bucketName).updateVisibility(file.name, newVisibility);

    if (error) {
      showMessage(`Failed to update visibility: ${error.message}`, 'error');
      return;
    }

    showMessage(`${file.name} is now ${newVisibility ? 'public' : 'private'}`, 'success');
    loadFiles(bucketName);
  } catch (error) {
    showMessage(`Failed to update visibility: ${(error as Error).message}`, 'error');
  }
}

export async function copyToClipboard(text: string) {
  // Use modern Clipboard API if available (requires HTTPS)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for non-HTTPS or older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.append(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  }
}
