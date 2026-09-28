import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAuth } from 'firebase/auth';

interface UploadResult {
  url: string;
  key: string;
}

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const uploadImage = async (file: File, folder: string): Promise<UploadResult | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Get pre-signed URL from our API
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated properly');

      const res = await fetch('/api/upload/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          contentType: file.type,
          folder,
          filename: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, publicUrl, key } = await res.json();

      // 2. Upload file directly to Cloudflare R2 via PUT request
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to R2');
      }

      // 3. Return the public URL
      return { url: publicUrl, key };
    } catch (err: unknown) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading, error };
}
