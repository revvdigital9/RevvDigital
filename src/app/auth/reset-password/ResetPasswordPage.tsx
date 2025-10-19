'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mail, Car, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;
      
      setSuccess(true);
      toast.success('Password reset link sent to your email');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setError(message);
      toast.error(message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-neutral-950">
      {/* Car lineup background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="flex gap-8 animate-[scroll_40s_linear_infinite]">
          {/* Row of cars */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex-shrink-0">
              <Car className="w-64 h-64 text-neutral-600" strokeWidth={0.5} />
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {[...Array(8)].map((_, i) => (
            <div key={`dup-${i}`} className="flex-shrink-0">
              <Car className="w-64 h-64 text-neutral-600" strokeWidth={0.5} />
            </div>
          ))}
        </div>
      </div>

      {/* Reset password card with frosted glass */}
      <div className="relative w-full max-w-md z-10">
        <div className="bg-neutral-900/80 backdrop-blur-2xl rounded-2xl border border-neutral-800 p-8 shadow-2xl">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Car className="w-8 h-8 text-neutral-400" />
              <h1 className="text-2xl font-bold text-white">Car Sales</h1>
            </div>
            <h2 className="text-xl text-neutral-300">Reset your password</h2>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-6 bg-green-950/50 border border-green-900/50 rounded-lg p-4">
              <p className="text-sm text-green-300">
                We've sent a password reset link to your email. Please check your inbox and follow the instructions.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-950/50 border border-red-900/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleResetPassword} className="space-y-5">
            {/* Email field */}
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-neutral-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <Input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || success}
                  className="pl-12 h-12 bg-neutral-800/50 border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600"
                />
              </div>
            </div>

            {/* Submit button */}
            <Button 
              type="submit" 
              disabled={loading || success}
              className="w-full h-12 bg-white hover:bg-neutral-200 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Sending reset link...
                </span>
              ) : success ? (
                'Reset Link Sent'
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-400">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-white hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}