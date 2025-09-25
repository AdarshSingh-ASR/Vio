export interface NotificationsProps {
  _count: {
    notifications: number;
  };
}

export interface WorkspaceProps {
  id: string;
  name: string;
  icon: string;
  createdAt: Date;
  type: "PERSONAL" | "PUBLIC";
}

export interface FolderProps {
  id: string;
  name: string;
  _count: {
    _all: number;
  };
}

export interface User {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  appwriteId: string;
  image: string | null;
  imageUrl: string | null;
}
