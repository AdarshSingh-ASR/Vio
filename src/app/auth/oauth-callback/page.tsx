'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleOAuthCallback } from '@/lib/appwrite-client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function OAuthCallbackPage() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Setting up your account...');
  const router = useRouter();

  useEffect(() => {
    const processCallback = async () => {
      try {
        setMessage('Completing authentication...');
        
        const result = await handleOAuthCallback();
        
        if (result.success && result.user) {
          setStatus('success');
          setMessage('Welcome! Redirecting to your dashboard...');
          
          // Show success briefly, then redirect
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
          
        } else {
          setStatus('error');
          setMessage('Authentication failed. Redirecting to sign in...');
          
          // Redirect to sign-in after showing error
          setTimeout(() => {
            router.push('/auth/sign-in?error=oauth_failed');
          }, 2500);
        }
      } catch (error) {
        setStatus('error');
        setMessage('Something went wrong. Redirecting to sign in...');
        
        setTimeout(() => {
          router.push('/auth/sign-in?error=oauth_error');
        }, 2500);
      }
    };

    processCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          {/* Status Icon */}
          <div className="mb-8">
            {status === 'processing' && (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="flex justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            )}
            {status === 'error' && (
              <div className="flex justify-center">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="space-y-4">
            <h1 className="text-lg font-medium text-foreground">
              {status === 'processing' && 'Setting up your account'}
              {status === 'success' && 'Authentication successful'}
              {status === 'error' && 'Authentication failed'}
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>

            {/* Progress indicator dots */}
            {status === 'processing' && (
              <div className="flex justify-center space-x-1 mt-6">
                <div className="w-2 h-2 bg-primary/30 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary/50 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              </div>
            )}
          </div>
        </div>

        {/* Status Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-muted-foreground">
            {status === 'processing' && 'This may take a few moments...'}
            {status === 'success' && 'Taking you to your dashboard'}
            {status === 'error' && 'Please try signing in again'}
          </p>
        </div>
      </div>
    </div>
  );
} 