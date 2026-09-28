/* eslint-disable @next/next/no-img-element */
import { useState, useRef } from 'react';
import { useImageUpload } from '@/hooks/useImageUpload';

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void;
  folder: string;
  currentImage?: string;
  className?: string;
  label?: string;
}

export function ImageUpload({ onUploadSuccess, folder, currentImage, className = '', label = 'Upload Image' }: ImageUploadProps) {
  const { uploadImage, uploading, error } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Upload
    const result = await uploadImage(file, folder);
    if (result) {
      onUploadSuccess(result.url);
    } else {
      // Revert preview on failure
      setPreview(currentImage || null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`w-full h-full min-h-[120px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-colors ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-4">
            <span className="block text-2xl mb-2">📸</span>
            <span className="text-sm font-medium text-gray-600">{label}</span>
          </div>
        )}
        
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-semibold">Mengunggah...</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
      />
    </div>
  );
}
