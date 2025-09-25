import { Client, Databases, Account, Storage, Users } from 'node-appwrite';
import { cookies } from "next/headers";

// Types for our app
interface AppwriteUser {
  $id: string;
  name: string;
  email: string;
  emailVerification: boolean;
  status: boolean;
  labels: string[];
  prefs: Record<string, any>;
  accessedAt: string;
  registration: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
}

// Create server client with API key for admin operations
const createServerClient = () => {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');
};

// Server client for admin operations
export const serverClient = createServerClient();

// Create Appwrite services
export const databases = new Databases(serverClient);
export const storage = new Storage(serverClient);
export const serverAccount = new Account(serverClient);
export const users = new Users(serverClient);

// Helper function to transform Appwrite user to our app's user format
export const transformAppwriteUser = (appwriteUser: AppwriteUser): AuthUser => {
  const nameParts = appwriteUser.name.split(' ');
  return {
    id: appwriteUser.$id,
    email: appwriteUser.email,
    firstName: nameParts[0] || appwriteUser.name,
    lastName: nameParts.slice(1).join(' ') || undefined,
    username: appwriteUser.prefs.username || appwriteUser.name,
    imageUrl: appwriteUser.prefs.avatar || undefined,
  };
};

// Get JWT token from request headers
export const getJWTFromRequest = (request: Request): string | null => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove "Bearer " prefix
    }
    return null;
  } catch (error) {
    console.error('Error extracting JWT from request:', error);
    return null;
  }
};

// Create authenticated client using JWT
export const createAuthenticatedClient = (jwt: string) => {
  const authClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID || '')
    .setJWT(jwt);
  
  return {
    client: authClient,
    account: new Account(authClient),
    databases: new Databases(authClient),
    storage: new Storage(authClient)
  };
};

// Get current user from JWT
export const getCurrentUser = async (request: Request) => {
  try {
    const jwt = getJWTFromRequest(request);
    
    if (!jwt) {
      console.log('No JWT token found in request headers');
      return null;
    }

    // Create authenticated client with JWT
    const { account } = createAuthenticatedClient(jwt);
    
    // Get current user
    const user = await account.get();
    console.log('Server-side user authenticated via JWT:', user.email);
    
    return user;
  } catch (error) {
    console.error('Server-side authentication failed:', error);
    return null;
  }
};

// Get authenticated services for a request
export const getAuthenticatedServices = async (request: Request) => {
  try {
    const jwt = getJWTFromRequest(request);
    
    if (!jwt) {
      throw new Error('No JWT token found in request headers');
    }

    const services = createAuthenticatedClient(jwt);
    
    // Verify the JWT works by getting the user
    const user = await services.account.get();
    console.log('Authenticated services created for user:', user.email);
    
    return {
      ...services,
      user
    };
  } catch (error) {
    console.error('Failed to create authenticated services:', error);
    throw error;
  }
};

// Session management for server components
export const getServerSession = async () => {
  try {
    const client = createServerClient();
    const account = new Account(client);
    const session = await account.getSession('current');
    return session;
  } catch (error) {
    return null;
  }
};

// Verify user authentication server-side
export const verifyAuth = async (): Promise<AppwriteUser | null> => {
  try {
    const client = createServerClient();
    const account = new Account(client);
    const user = await account.get();
    return user as AppwriteUser;
  } catch (error) {
    return null;
  }
}; 