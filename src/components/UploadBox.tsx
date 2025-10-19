"use client";

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export type UploadBoxProps = {
  onFiles: (files: File[]) => void;
  maxFiles?: number;
  className?: string;
};

export default function UploadBox({ onFiles, maxFiles = 10, className = '' }: UploadBoxProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles?.length) return;
      onFiles(acceptedFiles);
    },
    [onFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    onDrop,
    maxFiles,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
      } ${className}`}
    >
      <input {...getInputProps()} />
      <div className="space-y-2">
        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm text-gray-600">
          {isDragActive ? 'Drop the files here...' : 'Drag and drop images here, or click to select files'}
        </p>
        <p className="text-xs text-gray-500">Supports JPG, PNG, WEBP (max {maxFiles} images)</p>
      </div>
    </div>
  );
}
