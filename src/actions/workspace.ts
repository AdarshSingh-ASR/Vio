"use server"
import { transformAppwriteUser } from "@/lib/appwrite-server"
import { 
  Query,
  COLLECTIONS,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument
} from "@/lib/appwrite"
import { cookies } from "next/headers";
import { Client, Account } from "node-appwrite";

// Helper function to get current user in server actions
const getCurrentUserFromCookies = async () => {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('appwrite-session');
    
    if (!sessionCookie) {
      return null;
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID || '')
      .setSession(sessionCookie.value);

    const account = new Account(client);
    const user = await account.get();
    return user;
  } catch (error) {
    console.error('Failed to get user from cookies:', error);
    return null;
  }
};

export const verifyWorkspaceAccess = async (workspaceId: string) => {
    try {
        const appwriteUser = await getCurrentUserFromCookies()
        if(!appwriteUser) return {
            status: 403,
            data: {error: "Unauthorized"}
        }

        // Check if workspace exists and user has access
        const workspace = await getDocument(COLLECTIONS.WORKSPACES, workspaceId)
        
        if(!workspace || workspace.userId !== appwriteUser.$id) {
            return {
                status: 404,
                data: {error: "Workspace not found or access denied"}
            }
        }

        return {
            status: 200,
            data: workspace
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            data: {error: "Internal server error"}
        }
    }
}

export async function getWorkspaces() {
    try {
        const appwriteUser = await getCurrentUserFromCookies()
        if(!appwriteUser) return {
            status: 403,
            data: {error: "Unauthorized"}
        }

        const workspaces = await listDocuments(COLLECTIONS.WORKSPACES, [
            Query.equal('userId', appwriteUser.$id),
            Query.orderDesc('$createdAt')
        ])

        return {
            status: 200,
            data: workspaces.documents
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            data: {error: "Internal server error"}
        }
    }
}

export const createWorkspace = async (name: string) => {
    try {
        const appwriteUser = await getCurrentUserFromCookies()
        if(!appwriteUser) return {
            status: 404,
            data: "User not found"
        }

        const workspace = await createDocument(COLLECTIONS.WORKSPACES, {
            name,
            userId: appwriteUser.$id,
            createdAt: new Date().toISOString()
        })

        if(workspace) return {
            status: 200,
            data: workspace
        }

        return {
            status: 400,
            data: "Failed to create workspace"
        }
    } catch(error) {
        console.log(error)
        return {
            status: 403,
            data: "Internal server error"
        }
    }
}
