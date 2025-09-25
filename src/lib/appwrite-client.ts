import { Account, Client, ID, Models, OAuthProvider } from "appwrite";

// Client-side Appwrite instance
const createClientSideClient = () => {
  const client = new Client();
  client
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
  return client;
};

// Export client
export const clientSideClient = createClientSideClient();

// Account service
export const clientAccount = new Account(clientSideClient);

// Types
export interface AppwriteUser extends Models.User<Models.Preferences> {
  $id: string;
  name: string;
  email: string;
  emailVerification: boolean;
  prefs: Models.Preferences;
  registration: string;
  status: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
}

// Helper function to transform Appwrite user to our app's user format
export const transformAppwriteUser = (appwriteUser: AppwriteUser): AuthUser => {
  const nameParts = appwriteUser.name.split(' ');
  return {
    id: appwriteUser.$id,
    email: appwriteUser.email,
    firstName: nameParts[0] || appwriteUser.name,
    lastName: nameParts.slice(1).join(' ') || undefined,
    username: (appwriteUser.prefs as any).username || appwriteUser.name,
    imageUrl: (appwriteUser.prefs as any).avatar || undefined,
  };
};

// Client-side authentication functions
export const signIn = async (email: string, password: string) => {
  return await clientAccount.createEmailPasswordSession(email, password);
};

export const signUp = async (email: string, password: string, name: string) => {
  return await clientAccount.create(ID.unique(), email, password, name);
};

export const signOut = async () => {
  return await clientAccount.deleteSession('current');
};

export const getAccount = async () => {
  try {
    return await clientAccount.get();
  } catch (error) {
    return null;
  }
};

// Google OAuth authentication
export const signInWithGoogle = async () => {
  try {
    console.log("Initiating Google OAuth...");
    console.log("Current origin:", window.location.origin);
    
    // Create OAuth2 session with Google - redirect to a callback page that will handle the session
    // Include 'profile' scope to get access to user's profile picture
    await clientAccount.createOAuth2Session(
      OAuthProvider.Google,
      `${window.location.origin}/auth/oauth-callback?provider=google`, // Success URL - dedicated callback
      `${window.location.origin}/auth/sign-in?error=oauth_failed`, // Failure URL
      ['profile'] // Include profile scope to get picture from Google
    );
    
    console.log("OAuth2 session creation completed");
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

// Handle OAuth callback and set session cookie + create JWT
export const handleOAuthCallback = async () => {
  try {
    console.log("Handling OAuth callback...");
    
    // Get the current session after OAuth
    const session = await clientAccount.getSession('current');
    console.log("OAuth session found:", session ? session.$id : 'none');
    
    if (session) {
      // Set session cookie for client-side compatibility
      document.cookie = `appwrite-session=${session.$id}; path=/; samesite=lax; max-age=86400`; // 24 hours
      console.log("Session cookie set:", session.$id);
      
      // Get user account first
      const user = await clientAccount.get();
      console.log("User authenticated:", user.email);
      
      // Check if this is a Google OAuth login and try to get profile picture
      if (session.provider === 'google' && session.providerAccessToken) {
        try {
          console.log("Google OAuth detected, attempting to fetch profile picture...");
          
          // Use the provider access token to call Google's userinfo endpoint
          const userinfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
              'Authorization': `Bearer ${session.providerAccessToken}`
            }
          });
          
          if (userinfoResponse.ok) {
            const userInfo = await userinfoResponse.json();
            console.log("Google userinfo response:", userInfo);
            
            // If we got a picture URL, store it in user preferences
            if (userInfo.picture) {
              console.log("Found Google profile picture:", userInfo.picture);
              
              // Check if we already have this picture stored to avoid unnecessary updates
              const currentAvatar = user.prefs?.avatar;
              if (currentAvatar !== userInfo.picture) {
                // Update user preferences with the profile picture
                await clientAccount.updatePrefs({
                  ...user.prefs,
                  avatar: userInfo.picture,
                  googleProfilePicture: userInfo.picture, // Keep a backup reference
                  lastProfileUpdate: new Date().toISOString()
                });
                
                console.log("Successfully stored Google profile picture in user preferences");
              } else {
                console.log("Google profile picture already up to date");
              }
            } else {
              console.log("No profile picture available in Google userinfo response");
            }
          } else {
            console.log("Could not fetch Google userinfo:", userinfoResponse.status, userinfoResponse.statusText);
          }
        } catch (profileError) {
          console.warn("Could not fetch Google profile picture:", profileError);
          // Don't fail the whole auth process if profile picture fetch fails
        }
      }
      
      // Create JWT for server-side authentication
      try {
        const jwtResponse = await clientAccount.createJWT();
        console.log("JWT created for server-side auth");
        
        // Store JWT in localStorage for API calls
        localStorage.setItem('appwrite-jwt', jwtResponse.jwt);
        
        return { success: true, user, jwt: jwtResponse.jwt };
      } catch (jwtError) {
        console.error("Failed to create JWT:", jwtError);
        // Continue without JWT - client-side auth will still work
        return { success: true, user, jwt: null };
      }
    } else {
      console.log("No session found after OAuth");
      return { success: false, error: 'No session found' };
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    return { success: false, error: (error as Error).message || 'Unknown error' };
  }
};

// Function to manually refresh Google profile picture for existing users
export const refreshGoogleProfilePicture = async (): Promise<boolean> => {
  try {
    console.log("Manually refreshing Google profile picture...");
    
    // Get current session to check if it's a Google OAuth session
    const session = await clientAccount.getSession('current');
    
    if (!session || session.provider !== 'google' || !session.providerAccessToken) {
      console.log("Not a Google OAuth session or no access token available");
      return false;
    }
    
    // Get current user
    const user = await clientAccount.get();
    
    // Call Google's userinfo endpoint
    const userinfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${session.providerAccessToken}`
      }
    });
    
    if (userinfoResponse.ok) {
      const userInfo = await userinfoResponse.json();
      console.log("Google userinfo response for manual refresh:", userInfo);
      
      if (userInfo.picture) {
        // Check if we need to update the picture
        const currentAvatar = user.prefs?.avatar;
        if (currentAvatar !== userInfo.picture) {
          // Update user preferences with the profile picture
          await clientAccount.updatePrefs({
            ...user.prefs,
            avatar: userInfo.picture,
            googleProfilePicture: userInfo.picture,
            lastProfileUpdate: new Date().toISOString()
          });
          
          console.log("Successfully updated Google profile picture");
          return true;
        } else {
          console.log("Google profile picture is already up to date");
          return true;
        }
      } else {
        console.log("No profile picture available in Google userinfo");
        return false;
      }
    } else {
      console.log("Failed to fetch Google userinfo:", userinfoResponse.status, userinfoResponse.statusText);
      return false;
    }
  } catch (error) {
    console.error("Error refreshing Google profile picture:", error);
    return false;
  }
};

// JWT storage with expiration
interface StoredJWT {
  token: string;
  expiresAt: number;
}

// Clear old JWT format from localStorage
export const clearOldJWTFormat = () => {
  try {
    const storedJWT = localStorage.getItem('appwrite-jwt');
    if (storedJWT && !storedJWT.startsWith('{')) {
      // Old format detected (just a string), remove it
      console.log('Clearing old JWT format from localStorage');
      localStorage.removeItem('appwrite-jwt');
      localStorage.removeItem('last-jwt-creation'); // Also clear rate limiting tracker
    }
  } catch (error) {
    console.log('Error clearing old JWT format:', error);
  }
};

// Create JWT for authenticated API calls
export const createJWT = async (): Promise<string | null> => {
  try {
    // Check rate limiting before attempting to create JWT
    const lastJWTCreation = localStorage.getItem('last-jwt-creation');
    const now = Date.now();
    
    // Only allow JWT creation every 60 seconds to prevent rate limiting
    if (lastJWTCreation && (now - parseInt(lastJWTCreation)) < 60000) {
      console.log('JWT creation rate limited, please wait...');
      return null;
    }
    
    console.log('Creating new JWT...');
    const jwtResponse = await clientAccount.createJWT();
    const jwt = jwtResponse.jwt;
    
    // JWT expires in 15 minutes by default, store with expiration timestamp
    const expiresAt = Date.now() + (14 * 60 * 1000); // 14 minutes to be safe
    const storedJWT: StoredJWT = {
      token: jwt,
      expiresAt
    };
    
    // Store in localStorage for future use
    localStorage.setItem('appwrite-jwt', JSON.stringify(storedJWT));
    localStorage.setItem('last-jwt-creation', now.toString());
    console.log("JWT created and stored with expiration");
    
    return jwt;
  } catch (error) {
    console.error('Failed to create JWT:', error);
    
    // If rate limited, set a longer wait time
    if (error instanceof Error && error.message.includes('Rate limit')) {
      const now = Date.now();
      localStorage.setItem('last-jwt-creation', now.toString());
      console.log('Rate limited - will wait before next attempt');
    }
    
    return null;
  }
};

// Get stored JWT or create a new one
export const getValidJWT = async (): Promise<string | null> => {
  try {
    // Clear old format first
    clearOldJWTFormat();
    
    // First, check if we have a stored JWT
    const storedJWTString = localStorage.getItem('appwrite-jwt');
    
    if (storedJWTString) {
      try {
        const storedJWT: StoredJWT = JSON.parse(storedJWTString);
        
        // Check if JWT is still valid (not expired)
        if (storedJWT.expiresAt > Date.now()) {
          console.log("Using cached JWT");
          return storedJWT.token;
        } else {
          console.log("Stored JWT expired, removing from cache");
          localStorage.removeItem('appwrite-jwt');
        }
      } catch (parseError) {
        // If stored JWT is in old format (just string), remove it
        console.log("Removing invalid JWT format from cache");
        localStorage.removeItem('appwrite-jwt');
      }
    }
    
    // If no valid stored JWT, try to create a new one
    return await createJWT();
  } catch (error) {
    console.error('Failed to get valid JWT:', error);
    return null;
  }
};

// Make authenticated API call with JWT
export const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  const jwt = await getValidJWT();
  
  if (!jwt) {
    throw new Error('No valid JWT available');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
    ...options.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};

// Check if user is authenticated and get current session
export const getCurrentSession = async () => {
  try {
    return await clientAccount.getSession('current');
  } catch (error) {
    return null;
  }
}; 