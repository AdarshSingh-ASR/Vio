"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { 
  getCurrentSession, 
  signOut as appwriteSignOut,
  signIn as signInWithEmailPassword,
  signUp as signUpWithEmailPassword,
  signInWithGoogle as signInWithGoogleOAuth,
  handleOAuthCallback as handleOAuthCallbackClient,
  createJWT,
  getValidJWT,
  getAccount,
  transformAppwriteUser,
  AppwriteUser,
  AuthUser,
  clearOldJWTFormat
} from "@/lib/appwrite-client";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  getAuthenticatedFetch: () => (url: string, options?: RequestInit) => Promise<Response>;
  clearJWTCache: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Function to manually clear JWT cache
  const clearJWTCache = useCallback(() => {
    console.log('Manually clearing JWT cache...');
    localStorage.removeItem('appwrite-jwt');
    localStorage.removeItem('last-jwt-creation');
    clearOldJWTFormat();
    toast.success('JWT cache cleared');
  }, []);

  // Function to create authenticated fetch with JWT
  const getAuthenticatedFetch = useCallback(() => {
    return async (url: string, options: RequestInit = {}) => {
      try {
        // Get a valid JWT token (this will refresh if needed)
        const jwt = await getValidJWT();
        
        if (!jwt) {
          // If we can't get a JWT, check if we have a session and try once more
          const session = await getCurrentSession();
          if (session) {
            console.log('No JWT but session exists, trying to create JWT once more...');
            const newJwt = await createJWT();
            if (!newJwt) {
              throw new Error('No valid JWT token available - please try again in a minute due to rate limiting');
            }
          } else {
            throw new Error('No valid JWT token available - please sign in again');
          }
        }

        // Build headers properly to avoid TypeScript errors
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${jwt}`,
          ...(options.headers as Record<string, string> || {}),
        };

        // Only add Content-Type if not FormData
        if (!(options.body instanceof FormData)) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
          ...options,
          headers,
        });

        // If we get a 401, try to refresh the token once
        if (response.status === 401) {
          console.log('JWT expired, attempting to refresh...');
          
          // Force refresh the JWT - but add rate limiting
          const lastJWTCreation = localStorage.getItem('last-jwt-creation');
          const now = Date.now();
          
          // Only allow JWT refresh every 10 seconds to prevent rate limiting
          if (!lastJWTCreation || (now - parseInt(lastJWTCreation)) > 10000) {
          localStorage.removeItem('appwrite-jwt');
            localStorage.setItem('last-jwt-creation', now.toString());
            
          const newJwt = await getValidJWT();
          
          if (newJwt) {
            // Retry the request with new token
            const retryHeaders: Record<string, string> = {
              'Authorization': `Bearer ${newJwt}`,
              ...(options.headers as Record<string, string> || {}),
            };

            // Only add Content-Type if not FormData
            if (!(options.body instanceof FormData)) {
              retryHeaders['Content-Type'] = 'application/json';
            }

            return fetch(url, {
              ...options,
              headers: retryHeaders,
            });
            }
          } else {
            console.log('JWT refresh rate limited, waiting...');
            const waitTime = Math.ceil((60000 - (now - parseInt(lastJWTCreation))) / 1000);
            throw new Error(`Rate limited - please wait ${waitTime} seconds before making more requests`);
          }
        }

        return response;
      } catch (error) {
        console.error('Authenticated fetch error:', error);
        throw error;
      }
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      console.log("Creating account with email/password...");
      
      // Create account
      await signUpWithEmailPassword(email, password, name);
      console.log("Account created successfully");
      
      // Automatically sign in after successful registration
      const session = await signInWithEmailPassword(email, password);
      console.log("Auto sign-in successful:", session.$id);
      
      // Get user account and create JWT
      const appwriteUser = await getAccount();
      if (appwriteUser) {
        const transformedUser = transformAppwriteUser(appwriteUser as AppwriteUser);
        setUser(transformedUser);
        
        // Create JWT for API calls
        await createJWT();
        console.log("JWT created for new account");
        
        // Set session cookie
        document.cookie = `appwrite-session=${session.$id}; path=/; samesite=lax; max-age=86400`;
        
        // Redirect to dashboard
        router.push('/dashboard');
        toast.success("Account created and signed in successfully");
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast.error("Failed to create account. Please try again.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("Initiating Google OAuth...");
      
      // Initiate OAuth with Google (will redirect)
      await signInWithGoogleOAuth();
      
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast.error("Failed to sign in with Google");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log("Signing in with email/password...");
      
      // Sign in with email and password
      const session = await signInWithEmailPassword(email, password);
      console.log("Email/password sign-in successful:", session.$id);
      
      // Get user account and create JWT
      const appwriteUser = await getAccount();
      if (appwriteUser) {
        const transformedUser = transformAppwriteUser(appwriteUser as AppwriteUser);
        setUser(transformedUser);
        
        // Create JWT for API calls
        await createJWT();
        console.log("JWT created for email/password session");
        
        // Set session cookie
        document.cookie = `appwrite-session=${session.$id}; path=/; samesite=lax; max-age=86400`;
        
        // Redirect to dashboard
        router.push('/dashboard');
        toast.success("Signed in successfully");
      }
    } catch (error) {
      console.error('Email/password sign-in error:', error);
      toast.error("Failed to sign in. Please check your credentials.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("Handling OAuth callback in AuthContext...");
      
      const result = await handleOAuthCallbackClient();
      
      if (result.success && result.user) {
        console.log("OAuth callback successful, user:", result.user.email);
        const transformedUser = transformAppwriteUser(result.user as AppwriteUser);
        setUser(transformedUser);
        
        console.log("JWT stored:", result.jwt ? 'Yes' : 'No');
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        console.error("OAuth callback failed:", result.error);
        router.push('/auth/sign-in?error=' + encodeURIComponent(result.error || 'OAuth failed'));
      }
    } catch (error) {
      console.error('OAuth callback error in AuthContext:', error);
      router.push('/auth/sign-in?error=' + encodeURIComponent('OAuth callback failed'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Clear stored JWT
      localStorage.removeItem('appwrite-jwt');
      
      // Sign out from Appwrite
      await appwriteSignOut();
      
      // Clear user state
      setUser(null);
      
      // Clear session cookie
      document.cookie = 'appwrite-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      
      // Redirect to home
      router.push('/');
      toast.success("Signed out successfully");
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error("Failed to sign out");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Function to refresh user data from Appwrite
  const refreshUser = useCallback(async () => {
    try {
      console.log("Refreshing user data...");
      
      // Get current user account from Appwrite
      const appwriteUser = await getAccount();
      if (appwriteUser) {
        const transformedUser = transformAppwriteUser(appwriteUser as AppwriteUser);
        setUser(transformedUser);
        console.log("User data refreshed successfully");
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      // Don't throw error to avoid breaking the UI
    }
  }, []);

  // Check authentication on mount and route changes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // Handle OAuth callback if we're on the callback page
        if (pathname === '/auth/oauth-callback') {
          await handleOAuthCallback();
          return;
        }
        
        // Check if user has active session
        const session = await getCurrentSession();
        
        if (session) {
          console.log("Active session found:", session.$id);
          
          // Get user account
          const appwriteUser = await getAccount();
          if (appwriteUser) {
            const transformedUser = transformAppwriteUser(appwriteUser as AppwriteUser);
            setUser(transformedUser);
            console.log("User authenticated:", transformedUser.email);
            
            // Ensure we have a JWT for API calls
            const jwt = await getValidJWT();
            if (!jwt) {
              console.log("No JWT found, creating one...");
              await createJWT();
            }
          }
        } else {
          console.log("No active session found");
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, handleOAuthCallback]);

  const value: AuthContextType = {
    user,
    isLoading,
    isSignedIn: !!user,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    getAuthenticatedFetch,
    clearJWTCache,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useUser = () => {
  const { user } = useAuth();
  return user;
}; 