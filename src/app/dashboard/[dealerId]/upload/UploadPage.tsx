'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Car, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace('/auth/login');
    },
  });

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="w-12 h-12 border-2 border-neutral-700 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-neutral-800/50 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Car className="w-6 h-6 text-neutral-400" />
              <h1 className="text-2xl font-bold text-white">Upload New Vehicle</h1>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-neutral-900/50 backdrop-blur-xl rounded-xl border border-neutral-800 overflow-hidden">
          <div className="px-6 py-8 sm:p-10 text-center">
            <Car className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-3">Vehicle Upload</h2>
            <p className="text-neutral-400 max-w-md mx-auto">
              This is where you can upload new vehicle listings. The upload functionality is integrated into the main dashboard.
            </p>
            <div className="mt-8">
              <Link href="/dashboard">
                <Button className="bg-white hover:bg-neutral-200 text-black font-medium">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}