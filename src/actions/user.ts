import { transformAppwriteUser } from "@/lib/appwrite-server";
import { 
  Query,
  COLLECTIONS,
  listDocuments,
  createDocument,
  deleteDocument,
  updateDocument
} from "@/lib/appwrite";
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

export const onAuthenticateUser = async (ctx: any = "_unknown") => {
    try {
        const appwriteUser = await getCurrentUserFromCookies();
        console.log(ctx);
        if (!appwriteUser) {
            return {status: 403, message: "Unauthorized"};
        }

        const userData = transformAppwriteUser(appwriteUser);
        
        const userExists = await listDocuments(COLLECTIONS.USERS, [
            Query.equal('appwriteId', appwriteUser.$id)
        ]);

        if(userExists.documents.length > 0) {
            return {status: 200, message: "User already exists", user: userExists.documents[0]};
        }

        console.log("Creating new user with data:", {
            appwriteId: appwriteUser.$id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            imageUrl: userData.imageUrl
        });

        // Create user in database
        const newUser = await createDocument(COLLECTIONS.USERS, {
            userId: appwriteUser.$id,
            appwriteId: appwriteUser.$id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            imageUrl: userData.imageUrl,
            image: userData.imageUrl,
            createdAt: new Date().toISOString()
        });

        // Create default workspace
        const workspace = await createDocument(COLLECTIONS.WORKSPACES, {
            name: `${userData.firstName || userData.username || 'My'}'s Workspace`,
            userId: appwriteUser.$id,
            createdAt: new Date().toISOString()
        });

        return {
            status: 201, 
            message: "User created", 
            user: {
                ...newUser,
                workspaces: [workspace]
            }
        };
    } catch (e) {
        console.error(e);
        return {status: 500, message: "Internal server error"};
    }
};

export const deleteUser = async () => {
    try {
        const appwriteUser = await getCurrentUserFromCookies();
        if (!appwriteUser) return { status: 404 };
        
        const userExists = await listDocuments(COLLECTIONS.USERS, [
            Query.equal('appwriteId', appwriteUser.$id)
        ]);

        if (userExists.documents.length === 0) {
            return { status: 404 };
        }

        const deletedUser = await deleteDocument(COLLECTIONS.USERS, userExists.documents[0].$id);
        
        return { status: 200, data: deletedUser };
    } catch (error) {
        return { status: 400 };
    }
};

export const getUserProfile = async () => {
    try {
        const appwriteUser = await getCurrentUserFromCookies();
        if (!appwriteUser) return { status: 404 };
        
        const userExists = await listDocuments(COLLECTIONS.USERS, [
            Query.equal('appwriteId', appwriteUser.$id)
        ]);

        if (userExists.documents.length > 0) {
            const user = userExists.documents[0];
            return { 
                status: 200, 
                data: {
                    id: user.$id,
                    userId: user.userId,
                    appwriteId: user.appwriteId,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    image: user.image,
                    imageUrl: user.imageUrl,
                    createdAt: user.createdAt
                }
            };
        }
        
        return { status: 404 };
    } catch (error) {
        return { status: 400 };
    }
};
