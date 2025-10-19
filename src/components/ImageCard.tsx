"use client";

export type ImageCardProps = {
  id: string;
  url: string;
  caption?: string;
  onDownload?: (url: string, filename: string) => void;
  onSave?: () => void;
};

export default function ImageCard({ id, url, caption, onDownload, onSave }: ImageCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <img src={url} alt={caption || `Generated image ${id}`} className="w-full h-auto" />
      <div className="p-3 bg-gray-50 flex justify-between items-center">
        <span className="text-sm text-gray-600 truncate">{caption}</span>
        <div className="flex space-x-2">
          <button
            onClick={() => onDownload?.(url, `car-listing-${id}`)}
            className="p-1.5 text-gray-600 hover:text-blue-600"
            title="Download"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={onSave}
            className="p-1.5 text-gray-600 hover:text-green-600"
            title="Save to Gallery"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
