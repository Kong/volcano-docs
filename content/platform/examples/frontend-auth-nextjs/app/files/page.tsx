'use client';

import Link from 'next/link';
import { useVolcano } from '../../lib/useVolcano';
import ConfigPrompt from '../../components/ConfigPrompt';
import LoadingScreen from '../../components/LoadingScreen';
import PageNav from '../../components/PageNav';
import BucketSelector from './BucketSelector';
import FileList from './FileList';
import { SetupInstructions, StorageInfo } from './StorageHelp';
import UploadDropzone from './UploadDropzone';
import { useFileStorage } from './useFileStorage';

export default function FilesPage() {
  const { volcano, configured, loading: sdkLoading, reload } = useVolcano();
  const storage = useFileStorage(volcano);

  if (!configured) {
    return <ConfigPrompt onConfigured={reload} />;
  }

  if (sdkLoading || storage.loading) {
    return <LoadingScreen text="Loading..." />;
  }

  return (
    <div className="container">
      <PageNav title="🌋 Volcano Storage">
        <Link href="/dashboard">← Back to Dashboard</Link>
      </PageNav>

      <div className="card">
        <h1>📁 File Storage</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Upload, download, and manage your files using Volcano Storage.
        </p>

        <BucketSelector storage={storage} />

        {storage.message && <div className={`alert ${storage.messageType}`}>{storage.message}</div>}

        {/* Upload Section */}
        <div style={{ marginBottom: '30px' }}>
          <h2>Upload Files</h2>
          <UploadDropzone storage={storage} />
        </div>

        {/* Files List */}
        <h2>Your Files</h2>
        <FileList storage={storage} />

        <StorageInfo />
        <SetupInstructions />
      </div>
    </div>
  );
}
