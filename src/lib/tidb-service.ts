import { executeQuery, executeSingle, withTransaction, TABLES, escapeId, escapeValue } from './tidb';
import { ID } from 'appwrite';

// Types for our application
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  appwriteUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  parentFolderId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardItem {
  id: string;
  title: string;
  displayName: string;
  description?: string;
  content?: string;
  previewImageUrl?: string;
  fileType?: string;
  fileSize?: number;
  fileUrl?: string;
  appwriteFileId?: string;
  appwriteBucketId?: string;
  workspaceId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemNote {
  id: string;
  itemId: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizResult {
  id: string;
  userId: string;
  itemId?: string;
  itemName?: string;
  quizType: string;
  questions?: any[];
  answers?: any[];
  score: number;
  totalQuestions: number;
  timeSpent?: number;
  percentage?: number;
  topicAnalysis?: any;
  completedAt: Date;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  userId: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  createdAt: Date;
}

export interface LearningPath {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  description?: string;
  subjectArea?: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  status: 'draft' | 'active' | 'completed' | 'paused';
  knowledgeGaps?: any;
  learningObjectives?: any;
  progressPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningStep {
  id: string;
  learningPathId: string;
  stepOrder: number;
  stepType: 'reading' | 'quiz' | 'listening' | 'review' | 'practice';
  title: string;
  description?: string;
  contentReferences?: any;
  prerequisites?: any;
  learningObjectives?: any;
  estimatedDuration: number;
  isCompleted: boolean;
  completedAt?: Date;
  completionCriteria?: any;
  adaptiveDifficulty: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudySession {
  id: string;
  userId: string;
  learningPathId?: string;
  sessionType: 'adaptive' | 'review' | 'practice' | 'assessment';
  title: string;
  description?: string;
  contentSelection?: any;
  difficultyProgression?: any;
  sessionData?: any;
  performanceMetrics?: any;
  adaptiveFeedback?: any;
  startTime?: Date;
  endTime?: Date;
  durationMinutes: number;
  status: 'scheduled' | 'active' | 'completed' | 'paused';
  questionsCount?: number;
  createdAt: Date;
}

export interface ResearchQuery {
  id: string;
  userId: string;
  workspaceId: string;
  queryText: string;
  queryType: 'search' | 'analysis' | 'synthesis' | 'exploration';
  searchScope?: string;
  documentIds?: string[];
  searchResults?: any;
  findings?: any[];
  sourceDocuments?: any[];
  summary?: string;
  relatedTopics?: any[];
  followUpQuestions?: any[];
  confidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoGeneration {
  id: string;
  userId: string;
  workspaceId: string;
  topic: string;
  selectedDocuments?: string[];
  learningLevel: 'beginner' | 'intermediate' | 'advanced';
  videoStyle: 'explainer' | 'tutorial' | 'story' | 'interactive';
  durationMinutes: number;
  includeExamples: boolean;
  includeVisuals: boolean;
  includeQuiz: boolean;
  script?: any;
  status: 'generated' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface FileMetadata {
  id: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  appwriteFileId: string;
  appwriteBucketId: string;
  fileUrl?: string;
  uploadDate: Date;
  uploadedBy: string;
}

export interface ItemFolder {
  id: string;
  itemId: string;
  folderId: string;
  createdAt: Date;
}

// User operations
// Helper function to map database row to User interface
const mapUserRow = (row: any): User => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  username: row.username,
  imageUrl: row.image_url,
  appwriteUserId: row.appwrite_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Helper function to map database row to Folder interface
const mapFolderRow = (row: any): Folder => ({
  id: row.id,
  name: row.name,
  description: row.description,
  workspaceId: row.workspace_id,
  parentFolderId: row.parent_folder_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Helper function to map database row to Workspace interface
const mapWorkspaceRow = (row: any): Workspace => ({
  id: row.id,
  name: row.name,
  description: row.description,
  userId: row.user_id,
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Helper function to map database row to DashboardItem interface
const mapDashboardItemRow = (row: any): DashboardItem => ({
  id: row.id,
  title: row.title,
  displayName: row.display_name || row.title, // Fallback to title if display_name is null
  description: row.description,
  content: row.content,
  previewImageUrl: row.preview_image_url,
  fileType: row.file_type,
  fileSize: row.file_size,
  fileUrl: row.file_url,
  appwriteFileId: row.appwrite_file_id,
  appwriteBucketId: row.appwrite_bucket_id,
  workspaceId: row.workspace_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const userService = {
  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.USERS} 
      (id, email, first_name, last_name, username, image_url, appwrite_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, 
      user.email, 
      user.firstName || null, 
      user.lastName || null, 
      user.username || null, 
      user.imageUrl || null, 
      user.appwriteUserId || null
    ]);
    const createdUser = await userService.getById(id);
    if (!createdUser) {
      throw new Error('Failed to create user');
    }
    return createdUser;
  },

  async getById(id: string): Promise<User | null> {
    const query = `SELECT * FROM ${TABLES.USERS} WHERE id = ?`;
    const users = await executeQuery(query, [id]);
    return users[0] ? mapUserRow(users[0]) : null;
  },

  async getByEmail(email: string): Promise<User | null> {
    const query = `SELECT * FROM ${TABLES.USERS} WHERE email = ?`;
    const users = await executeQuery(query, [email]);
    return users[0] ? mapUserRow(users[0]) : null;
  },

  async getByAppwriteUserId(appwriteUserId: string): Promise<User | null> {
    const query = `SELECT * FROM ${TABLES.USERS} WHERE appwrite_user_id = ?`;
    const users = await executeQuery(query, [appwriteUserId]);
    return users[0] ? mapUserRow(users[0]) : null;
  },

  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    // Map camelCase fields to snake_case database columns
    const fieldMapping: Record<string, string> = {
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      username: 'username',
      imageUrl: 'image_url',
      appwriteUserId: 'appwrite_user_id'
    };
    
    const fields = Object.keys(updates)
      .filter(key => fieldMapping[key])
      .map(key => `${fieldMapping[key]} = ?`)
      .join(', ');
    
    const values = Object.keys(updates)
      .filter(key => fieldMapping[key])
      .map(key => updates[key as keyof typeof updates] || null);
    
    if (fields.length === 0) {
      // No valid fields to update
      const user = await userService.getById(id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    }
    
    const query = `UPDATE ${TABLES.USERS} SET ${fields} WHERE id = ?`;
    await executeSingle(query, [...values, id]);
    const updatedUser = await userService.getById(id);
    if (!updatedUser) {
      throw new Error('Failed to update user');
    }
    return updatedUser;
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.USERS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Workspace operations
export const workspaceService = {
  async create(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.WORKSPACES} 
      (id, name, description, user_id, is_default)
      VALUES (?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, 
      workspace.name || null, 
      workspace.description || null, 
      workspace.userId || null, 
      workspace.isDefault || null
    ]);
    const createdWorkspace = await workspaceService.getById(id);
    if (!createdWorkspace) {
      throw new Error('Failed to create workspace');
    }
    return createdWorkspace;
  },

  async getById(id: string): Promise<Workspace | null> {
    const query = `SELECT * FROM ${TABLES.WORKSPACES} WHERE id = ?`;
    const workspaces = await executeQuery(query, [id]);
    return workspaces[0] ? mapWorkspaceRow(workspaces[0]) : null;
  },

  async getByUserId(userId: string): Promise<Workspace[]> {
    const query = `SELECT * FROM ${TABLES.WORKSPACES} WHERE user_id = ? ORDER BY created_at DESC`;
    const workspaces = await executeQuery(query, [userId]);
    return workspaces.map(mapWorkspaceRow);
  },

  async getDefaultByUserId(userId: string): Promise<Workspace | null> {
    const query = `SELECT * FROM ${TABLES.WORKSPACES} WHERE user_id = ? AND is_default = TRUE LIMIT 1`;
    const workspaces = await executeQuery(query, [userId]);
    return workspaces[0] ? mapWorkspaceRow(workspaces[0]) : null;
  },

  async update(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Workspace> {
    // Map camelCase fields to snake_case database columns
    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      userId: 'user_id',
      isDefault: 'is_default'
    };
    
    const fields = Object.keys(updates)
      .filter(key => fieldMapping[key])
      .map(key => `${fieldMapping[key]} = ?`)
      .join(', ');
    
    const values = Object.keys(updates)
      .filter(key => fieldMapping[key])
      .map(key => updates[key as keyof typeof updates]);
    
    if (fields.length === 0) {
      // No valid fields to update
      const workspace = await workspaceService.getById(id);
      if (!workspace) {
        throw new Error('Workspace not found');
      }
      return workspace;
    }
    
    const query = `UPDATE ${TABLES.WORKSPACES} SET ${fields} WHERE id = ?`;
    await executeSingle(query, [...values, id]);
    const updatedWorkspace = await workspaceService.getById(id);
    if (!updatedWorkspace) {
      throw new Error('Failed to update workspace');
    }
    return updatedWorkspace;
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.WORKSPACES} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Folder operations
export const folderService = {
  async create(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.FOLDERS} 
      (id, name, description, workspace_id, parent_folder_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, 
      folder.name || null, 
      folder.description || null, 
      folder.workspaceId || null,
      folder.parentFolderId || null, 
      folder.createdBy || null
    ]);
    const createdFolder = await folderService.getById(id);
    if (!createdFolder) {
      throw new Error('Failed to create folder');
    }
    return createdFolder;
  },

  async update(id: string, updates: Partial<Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Folder> {
    const updateFields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      values.push(updates.name || null);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      values.push(updates.description || null);
    }
    if (updates.workspaceId !== undefined) {
      updateFields.push('workspace_id = ?');
      values.push(updates.workspaceId || null);
    }
    if (updates.parentFolderId !== undefined) {
      updateFields.push('parent_folder_id = ?');
      values.push(updates.parentFolderId || null);
    }
    if (updates.createdBy !== undefined) {
      updateFields.push('created_by = ?');
      values.push(updates.createdBy || null);
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const query = `
      UPDATE ${TABLES.FOLDERS} 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    await executeSingle(query, values);
    
    const updatedFolder = await folderService.getById(id);
    if (!updatedFolder) {
      throw new Error('Failed to update folder');
    }
    return updatedFolder;
  },

  async getById(id: string): Promise<Folder | null> {
    const query = `SELECT * FROM ${TABLES.FOLDERS} WHERE id = ?`;
    const folders = await executeQuery(query, [id]);
    return folders[0] ? mapFolderRow(folders[0]) : null;
  },

  async getByWorkspaceId(workspaceId: string): Promise<Folder[]> {
    const query = `SELECT * FROM ${TABLES.FOLDERS} WHERE workspace_id = ? ORDER BY created_at DESC`;
    const folders = await executeQuery(query, [workspaceId]);
    return folders.map(mapFolderRow);
  },

  async getByParentFolderId(parentFolderId: string): Promise<Folder[]> {
    const query = `SELECT * FROM ${TABLES.FOLDERS} WHERE parent_folder_id = ? ORDER BY created_at DESC`;
    const folders = await executeQuery(query, [parentFolderId]);
    return folders.map(mapFolderRow);
  },

  async search(query: string, workspaceId?: string, userId?: string): Promise<Folder[]> {
    let whereClause = `WHERE (name LIKE ? OR description LIKE ?)`;
    const params = [`%${query}%`, `%${query}%`];
    
    if (workspaceId) {
      whereClause += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    
    if (userId) {
      whereClause += ` AND created_by = ?`;
      params.push(userId);
    }
    
    const sql = `SELECT * FROM ${TABLES.FOLDERS} ${whereClause} ORDER BY created_at DESC LIMIT 10`;
    const folders = await executeQuery(sql, params);
    return folders.map(mapFolderRow);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.FOLDERS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Dashboard Item operations
export const dashboardItemService = {
  async create(item: Omit<DashboardItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardItem> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.DASHBOARD_ITEMS} 
      (id, title, display_name, description, content, preview_image_url, file_type, file_size, file_url, 
       appwrite_file_id, appwrite_bucket_id, workspace_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, 
      item.title || null, 
      item.displayName || item.title || null, // Use displayName, fallback to title
      item.description || null, 
      item.content || null, 
      item.previewImageUrl || null,
      item.fileType || null,
      item.fileSize || null, 
      item.fileUrl || null, 
      item.appwriteFileId || null, 
      item.appwriteBucketId || null,
      item.workspaceId || null, 
      item.createdBy || null
    ]);
    const createdItem = await dashboardItemService.getById(id);
    if (!createdItem) {
      throw new Error('Failed to create dashboard item');
    }
    return createdItem;
  },

  async update(id: string, updates: Partial<Omit<DashboardItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DashboardItem> {
    const updateFields = [];
    const values = [];
    
    // Map camelCase to snake_case for database columns
    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title || null);
    }
    if (updates.displayName !== undefined) {
      updateFields.push('display_name = ?');
      values.push(updates.displayName || null);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      values.push(updates.description || null);
    }
    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      values.push(updates.content || null);
    }
    if (updates.previewImageUrl !== undefined) {
      updateFields.push('preview_image_url = ?');
      values.push(updates.previewImageUrl || null);
    }
    if (updates.fileType !== undefined) {
      updateFields.push('file_type = ?');
      values.push(updates.fileType || null);
    }
    if (updates.fileSize !== undefined) {
      updateFields.push('file_size = ?');
      values.push(updates.fileSize || null);
    }
    if (updates.fileUrl !== undefined) {
      updateFields.push('file_url = ?');
      values.push(updates.fileUrl || null);
    }
    if (updates.appwriteFileId !== undefined) {
      updateFields.push('appwrite_file_id = ?');
      values.push(updates.appwriteFileId || null);
    }
    if (updates.appwriteBucketId !== undefined) {
      updateFields.push('appwrite_bucket_id = ?');
      values.push(updates.appwriteBucketId || null);
    }
    if (updates.workspaceId !== undefined) {
      updateFields.push('workspace_id = ?');
      values.push(updates.workspaceId || null);
    }
    if (updates.createdBy !== undefined) {
      updateFields.push('created_by = ?');
      values.push(updates.createdBy || null);
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const query = `
      UPDATE ${TABLES.DASHBOARD_ITEMS} 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    await executeSingle(query, values);
    
    const updatedItem = await dashboardItemService.getById(id);
    if (!updatedItem) {
      throw new Error('Failed to update dashboard item');
    }
    return updatedItem;
  },

  async getById(id: string): Promise<DashboardItem | null> {
    const query = `SELECT * FROM ${TABLES.DASHBOARD_ITEMS} WHERE id = ?`;
    const items = await executeQuery(query, [id]);
    return items[0] ? mapDashboardItemRow(items[0]) : null;
  },

  async getByWorkspaceId(workspaceId: string, limit: number = 50, offset: number = 0): Promise<DashboardItem[]> {
    const limitNum = parseInt(String(limit), 10);
    const offsetNum = parseInt(String(offset), 10);
    
    const query = `
      SELECT * FROM ${TABLES.DASHBOARD_ITEMS} 
      WHERE workspace_id = ? 
      ORDER BY created_at DESC 
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;
    console.log('getByWorkspaceId query:', query);
    console.log('getByWorkspaceId params:', [workspaceId]);
    const items = await executeQuery(query, [workspaceId]);
    return items.map(mapDashboardItemRow);
  },

  async getAllByWorkspaceId(workspaceId: string): Promise<DashboardItem[]> {
    const query = `
      SELECT * FROM ${TABLES.DASHBOARD_ITEMS} 
      WHERE workspace_id = ? 
      ORDER BY created_at DESC
    `;
    console.log('getAllByWorkspaceId query:', query);
    console.log('getAllByWorkspaceId workspaceId:', workspaceId);
    const items = await executeQuery(query, [workspaceId]);
    console.log('getAllByWorkspaceId raw results:', items.length, 'items');
    const mappedItems = items.map(mapDashboardItemRow);
    console.log('getAllByWorkspaceId mapped results:', mappedItems.length, 'items');
    return mappedItems;
  },

  async getByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<DashboardItem[]> {
    const query = `
      SELECT * FROM ${TABLES.DASHBOARD_ITEMS} 
      WHERE created_by = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const items = await executeQuery(query, [userId, Number(limit), Number(offset)]);
    return items.map(mapDashboardItemRow);
  },

  async getAllByUserId(userId: string): Promise<DashboardItem[]> {
    const query = `
      SELECT * FROM ${TABLES.DASHBOARD_ITEMS} 
      WHERE created_by = ? 
      ORDER BY created_at DESC
    `;
    const items = await executeQuery(query, [userId]);
    return items.map(mapDashboardItemRow);
  },

  async getByFolderId(folderId: string): Promise<DashboardItem[]> {
    const query = `
      SELECT di.* FROM ${TABLES.DASHBOARD_ITEMS} di
      INNER JOIN ${TABLES.ITEM_FOLDERS} item_folders ON di.id = item_folders.item_id
      WHERE item_folders.folder_id = ?
      ORDER BY di.created_at DESC
    `;
    const items = await executeQuery(query, [folderId]);
    return items.map(mapDashboardItemRow);
  },

  async searchByTitle(title: string, workspaceId?: string): Promise<DashboardItem[]> {
    let query = `SELECT * FROM ${TABLES.DASHBOARD_ITEMS} WHERE title LIKE ?`;
    const params = [`%${title}%`];
    
    if (workspaceId) {
      query += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    
    query += ` ORDER BY created_at DESC`;
    const items = await executeQuery(query, params);
    return items.map(mapDashboardItemRow);
  },

  async search(query: string, workspaceId?: string, userId?: string): Promise<DashboardItem[]> {
    let whereClause = `WHERE (title LIKE ? OR display_name LIKE ? OR content LIKE ? OR description LIKE ?)`;
    const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
    
    if (workspaceId) {
      whereClause += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }
    
    if (userId) {
      whereClause += ` AND created_by = ?`;
      params.push(userId);
    }
    
    const sql = `SELECT * FROM ${TABLES.DASHBOARD_ITEMS} ${whereClause} ORDER BY created_at DESC LIMIT 20`;
    const items = await executeQuery(sql, params);
    return items.map(mapDashboardItemRow);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.DASHBOARD_ITEMS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Item Note operations
export const itemNoteService = {
  async create(note: Omit<ItemNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<ItemNote> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.ITEM_NOTES} 
      (id, item_id, content, created_by)
      VALUES (?, ?, ?, ?)
    `;
    await executeSingle(query, [id, note.itemId, note.content, note.createdBy]);
    const createdNote = await itemNoteService.getById(id);
    if (!createdNote) {
      throw new Error('Failed to create item note');
    }
    return createdNote;
  },

  async getById(id: string): Promise<ItemNote | null> {
    const query = `SELECT * FROM ${TABLES.ITEM_NOTES} WHERE id = ?`;
    const notes = await executeQuery<ItemNote>(query, [id]);
    return notes[0] || null;
  },

  async getByItemId(itemId: string): Promise<ItemNote[]> {
    const query = `SELECT * FROM ${TABLES.ITEM_NOTES} WHERE item_id = ? ORDER BY created_at DESC`;
    return executeQuery<ItemNote>(query, [itemId]);
  },

  async update(id: string, updates: Partial<Omit<ItemNote, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ItemNote> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const query = `UPDATE ${TABLES.ITEM_NOTES} SET ${fields} WHERE id = ?`;
    await executeSingle(query, [...values, id]);
    const updatedNote = await itemNoteService.getById(id);
    if (!updatedNote) {
      throw new Error('Failed to update item note');
    }
    return updatedNote;
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.ITEM_NOTES} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Helper function to safely parse JSON fields
const safeJsonParse = (data: string | object | null, fallback: any = null) => {
  // If data is already an object/array, return it directly
  if (data && typeof data === 'object') {
    return data;
  }
  
  // If data is null or not a string, return fallback
  if (!data || typeof data !== 'string') {
    return fallback;
  }
  
  // Check if it's already a stringified object (not [object Object])
  if (data.includes('[object Object]')) {
    console.warn('Found corrupted JSON data:', data);
    return fallback;
  }
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to parse JSON:', data, error);
    return fallback;
  }
};

// Quiz Result operations
export const quizResultService = {
  async create(result: Omit<QuizResult, 'id' | 'completedAt' | 'createdAt'>): Promise<QuizResult> {
    const id = ID.unique();
    
    console.log('💾 Saving quiz result to TiDB:', {
      id,
      userId: result.userId,
      itemId: result.itemId,
      itemName: result.itemName,
      quizType: result.quizType,
      questionsLength: result.questions?.length || 0,
      answersLength: result.answers?.length || 0,
      questions: result.questions,
      answers: result.answers,
      score: result.score,
      totalQuestions: result.totalQuestions
    });
    
    const query = `
      INSERT INTO ${TABLES.QUIZ_RESULTS} 
      (id, user_id, item_id, item_name, quiz_type, questions, answers, score, total_questions, time_spent, percentage, topic_analysis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, 
      result.userId, 
      result.itemId || null,
      result.itemName || null,
      result.quizType, 
      JSON.stringify(result.questions || []), 
      JSON.stringify(result.answers || []),
      result.score, 
      result.totalQuestions,
      result.timeSpent || 0,
      result.percentage || Math.round((result.score / result.totalQuestions) * 100),
      JSON.stringify(result.topicAnalysis || {})
    ]);
    const createdResult = await quizResultService.getById(id);
    if (!createdResult) {
      throw new Error('Failed to create quiz result');
    }
    return createdResult;
  },

  async getById(id: string): Promise<QuizResult | null> {
    const query = `SELECT * FROM ${TABLES.QUIZ_RESULTS} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      
      console.log('🔍 Retrieved quiz result from TiDB:', {
        id: result.id,
        rawQuestions: result.questions,
        rawAnswers: result.answers,
        questionsType: typeof result.questions,
        answersType: typeof result.answers
      });
      
      const parsedQuestions = safeJsonParse(result.questions, []);
      const parsedAnswers = safeJsonParse(result.answers, []);
      
      console.log('🔍 Parsed quiz result data:', {
        id: result.id,
        parsedQuestions,
        parsedAnswers,
        questionsLength: parsedQuestions?.length || 0,
        answersLength: parsedAnswers?.length || 0
      });
      
      return {
        id: result.id,
        userId: result.user_id,
        itemId: result.item_id,
        itemName: result.item_name,
        quizType: result.quiz_type,
        questions: parsedQuestions,
        answers: parsedAnswers,
        score: result.score,
        totalQuestions: result.total_questions,
        timeSpent: result.time_spent,
        percentage: result.percentage,
        topicAnalysis: safeJsonParse(result.topic_analysis, {}),
        completedAt: result.completed_at,
        createdAt: result.created_at
      };
    }
    return null;
  },

  async getByUserId(userId: string): Promise<QuizResult[]> {
    const query = `SELECT * FROM ${TABLES.QUIZ_RESULTS} WHERE user_id = ? ORDER BY completed_at DESC`;
    const results = await executeQuery(query, [userId]);
    // Parse JSON fields for all results
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      itemId: result.item_id,
      itemName: result.item_name,
      quizType: result.quiz_type,
      questions: safeJsonParse(result.questions, []),
      answers: safeJsonParse(result.answers, []),
      score: result.score,
      totalQuestions: result.total_questions,
      timeSpent: result.time_spent,
      percentage: result.percentage,
      topicAnalysis: safeJsonParse(result.topic_analysis, {}),
      completedAt: result.completed_at,
      createdAt: result.created_at
    }));
  },

  async search(query: string, userId?: string): Promise<QuizResult[]> {
    let whereClause = `WHERE (item_name LIKE ? OR quiz_type LIKE ?)`;
    const params = [`%${query}%`, `%${query}%`];
    
    if (userId) {
      whereClause += ` AND user_id = ?`;
      params.push(userId);
    }
    
    const sql = `SELECT * FROM ${TABLES.QUIZ_RESULTS} ${whereClause} ORDER BY completed_at DESC LIMIT 10`;
    const results = await executeQuery(sql, params);
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      itemId: result.item_id,
      itemName: result.item_name,
      quizType: result.quiz_type,
      questions: safeJsonParse(result.questions, []),
      answers: safeJsonParse(result.answers, []),
      score: result.score,
      totalQuestions: result.total_questions,
      timeSpent: result.time_spent,
      percentage: result.percentage,
      topicAnalysis: safeJsonParse(result.topic_analysis, {}),
      completedAt: result.completed_at,
      createdAt: result.created_at
    }));
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.QUIZ_RESULTS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Chat Message operations
export const chatMessageService = {
  async create(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.CHAT_MESSAGES} 
      (id, user_id, chat_id, role, content, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id,
      message.userId,
      message.chatId,
      message.role,
      message.content,
      JSON.stringify(message.metadata || {})
    ]);
    const createdMessage = await chatMessageService.getById(id);
    if (!createdMessage) {
      throw new Error('Failed to create chat message');
    }
    return createdMessage;
  },

  async getById(id: string): Promise<ChatMessage | null> {
    const query = `SELECT * FROM ${TABLES.CHAT_MESSAGES} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      return {
        id: result.id,
        userId: result.user_id,
        chatId: result.chat_id,
        role: result.role,
        content: result.content,
        metadata: safeJsonParse(result.metadata),
        createdAt: result.created_at
      };
    }
    return null;
  },

  async getByChatId(chatId: string): Promise<ChatMessage[]> {
    const query = `SELECT * FROM ${TABLES.CHAT_MESSAGES} WHERE chat_id = ? ORDER BY created_at ASC`;
    const results = await executeQuery(query, [chatId]);
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      chatId: result.chat_id,
      role: result.role,
      content: result.content,
      metadata: safeJsonParse(result.metadata),
      createdAt: result.created_at
    }));
  },

  async getByUserId(userId: string): Promise<ChatMessage[]> {
    const query = `SELECT * FROM ${TABLES.CHAT_MESSAGES} WHERE user_id = ? ORDER BY created_at DESC`;
    const results = await executeQuery(query, [userId]);
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      chatId: result.chat_id,
      role: result.role,
      content: result.content,
      metadata: safeJsonParse(result.metadata),
      createdAt: result.created_at
    }));
  },

  async deleteByChatId(chatId: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.CHAT_MESSAGES} WHERE chat_id = ?`;
    await executeSingle(query, [chatId]);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.CHAT_MESSAGES} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// File Metadata operations
export const fileMetadataService = {
  async create(metadata: Omit<FileMetadata, 'id' | 'uploadDate'>): Promise<FileMetadata> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.FILE_METADATA} 
      (id, file_name, file_type, file_size, appwrite_file_id, appwrite_bucket_id, file_url, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, metadata.fileName, metadata.fileType, metadata.fileSize,
      metadata.appwriteFileId, metadata.appwriteBucketId, metadata.fileUrl, metadata.uploadedBy
    ]);
    const createdMetadata = await fileMetadataService.getById(id);
    if (!createdMetadata) {
      throw new Error('Failed to create file metadata');
    }
    return createdMetadata;
  },

  async getById(id: string): Promise<FileMetadata | null> {
    const query = `SELECT * FROM ${TABLES.FILE_METADATA} WHERE id = ?`;
    const metadata = await executeQuery<FileMetadata>(query, [id]);
    return metadata[0] || null;
  },

  async getByAppwriteFileId(appwriteFileId: string): Promise<FileMetadata | null> {
    const query = `SELECT * FROM ${TABLES.FILE_METADATA} WHERE appwrite_file_id = ?`;
    const metadata = await executeQuery<FileMetadata>(query, [appwriteFileId]);
    return metadata[0] || null;
  },

  async getByUserId(userId: string): Promise<FileMetadata[]> {
    const query = `SELECT * FROM ${TABLES.FILE_METADATA} WHERE uploaded_by = ? ORDER BY upload_date DESC`;
    return executeQuery<FileMetadata>(query, [userId]);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.FILE_METADATA} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Item-Folder relationship operations
export const itemFolderService = {
  async create(itemFolder: Omit<ItemFolder, 'id' | 'createdAt'>): Promise<ItemFolder> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.ITEM_FOLDERS} 
      (id, item_id, folder_id)
      VALUES (?, ?, ?)
    `;
    await executeSingle(query, [id, itemFolder.itemId, itemFolder.folderId]);
    const createdItemFolder = await itemFolderService.getById(id);
    if (!createdItemFolder) {
      throw new Error('Failed to create item-folder relationship');
    }
    return createdItemFolder;
  },

  async getById(id: string): Promise<ItemFolder | null> {
    const query = `SELECT * FROM ${TABLES.ITEM_FOLDERS} WHERE id = ?`;
    const itemFolders = await executeQuery(query, [id]);
    return itemFolders[0] || null;
  },

  async getByFolderId(folderId: string): Promise<ItemFolder[]> {
    const query = `SELECT * FROM ${TABLES.ITEM_FOLDERS} WHERE folder_id = ? ORDER BY created_at DESC`;
    const itemFolders = await executeQuery(query, [folderId]);
    return itemFolders.map(row => ({
      id: row.id,
      itemId: row.item_id,
      folderId: row.folder_id,
      createdAt: row.created_at
    }));
  },

  async getByItemId(itemId: string): Promise<ItemFolder[]> {
    const query = `SELECT * FROM ${TABLES.ITEM_FOLDERS} WHERE item_id = ? ORDER BY created_at DESC`;
    const itemFolders = await executeQuery(query, [itemId]);
    return itemFolders.map(row => ({
      id: row.id,
      itemId: row.item_id,
      folderId: row.folder_id,
      createdAt: row.created_at
    }));
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.ITEM_FOLDERS} WHERE id = ?`;
    await executeSingle(query, [id]);
  },

  async deleteByItemAndFolder(itemId: string, folderId: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.ITEM_FOLDERS} WHERE item_id = ? AND folder_id = ?`;
    await executeSingle(query, [itemId, folderId]);
  }
};

// Learning Path operations
export const learningPathService = {
  async create(path: Omit<LearningPath, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningPath> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.LEARNING_PATHS} 
      (id, user_id, workspace_id, title, description, subject_area, difficulty_level, estimated_duration, 
       status, knowledge_gaps, learning_objectives, progress_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, path.userId, path.workspaceId, path.title, path.description, path.subjectArea,
      path.difficultyLevel, path.estimatedDuration, path.status,
      JSON.stringify(path.knowledgeGaps || {}), 
      JSON.stringify(path.learningObjectives || {}), 
      path.progressPercentage
    ]);
    const createdPath = await learningPathService.getById(id);
    if (!createdPath) {
      throw new Error('Failed to create learning path');
    }
    return createdPath;
  },

  async getById(id: string): Promise<LearningPath | null> {
    const query = `SELECT * FROM ${TABLES.LEARNING_PATHS} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      return {
        id: result.id,
        userId: result.user_id,
        workspaceId: result.workspace_id,
        title: result.title,
        description: result.description,
        subjectArea: result.subject_area,
        difficultyLevel: result.difficulty_level,
        estimatedDuration: result.estimated_duration,
        status: result.status,
        knowledgeGaps: safeJsonParse(result.knowledge_gaps, {}),
        learningObjectives: safeJsonParse(result.learning_objectives, {}),
        progressPercentage: result.progress_percentage,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  },

  async getByUserId(userId: string): Promise<LearningPath[]> {
    const query = `SELECT * FROM ${TABLES.LEARNING_PATHS} WHERE user_id = ? ORDER BY created_at DESC`;
    const results = await executeQuery(query, [userId]);
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      workspaceId: result.workspace_id,
      title: result.title,
      description: result.description,
      subjectArea: result.subject_area,
      difficultyLevel: result.difficulty_level,
      estimatedDuration: result.estimated_duration,
      status: result.status,
      knowledgeGaps: safeJsonParse(result.knowledge_gaps, {}),
      learningObjectives: safeJsonParse(result.learning_objectives, {}),
      progressPercentage: result.progress_percentage,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  },

  async update(id: string, updates: Partial<LearningPath>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'knowledgeGaps' || key === 'learningObjectives') {
        fields.push(`${key === 'knowledgeGaps' ? 'knowledge_gaps' : 'learning_objectives'} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'progressPercentage') {
        fields.push('progress_percentage = ?');
        values.push(value);
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return;
    
    values.push(id);
    const query = `UPDATE ${TABLES.LEARNING_PATHS} SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await executeSingle(query, values);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.LEARNING_PATHS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Learning Step operations
export const learningStepService = {
  async create(step: Omit<LearningStep, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningStep> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.LEARNING_STEPS} 
      (id, learning_path_id, step_order, step_type, title, description, content_references, 
       prerequisites, learning_objectives, estimated_duration, completion_criteria, adaptive_difficulty, is_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, step.learningPathId, step.stepOrder, step.stepType, step.title, step.description,
      JSON.stringify(step.contentReferences || {}),
      JSON.stringify(step.prerequisites || {}),
      JSON.stringify(step.learningObjectives || {}),
      step.estimatedDuration,
      JSON.stringify(step.completionCriteria || {}),
      step.adaptiveDifficulty,
      false // is_completed defaults to false
    ]);
    const createdStep = await learningStepService.getById(id);
    if (!createdStep) {
      throw new Error('Failed to create learning step');
    }
    return createdStep;
  },

  async getById(id: string): Promise<LearningStep | null> {
    const query = `SELECT * FROM ${TABLES.LEARNING_STEPS} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      return {
        id: result.id,
        learningPathId: result.learning_path_id,
        stepOrder: result.step_order,
        stepType: result.step_type,
        title: result.title,
        description: result.description,
        contentReferences: safeJsonParse(result.content_references, {}),
        prerequisites: safeJsonParse(result.prerequisites, {}),
        learningObjectives: safeJsonParse(result.learning_objectives, {}),
        estimatedDuration: result.estimated_duration,
        isCompleted: result.is_completed,
        completedAt: result.completed_at,
        completionCriteria: safeJsonParse(result.completion_criteria, {}),
        adaptiveDifficulty: result.adaptive_difficulty,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  },

  async getByLearningPathId(learningPathId: string): Promise<LearningStep[]> {
    const query = `SELECT * FROM ${TABLES.LEARNING_STEPS} WHERE learning_path_id = ? ORDER BY step_order ASC`;
    const results = await executeQuery(query, [learningPathId]);
    return results.map(result => ({
      id: result.id,
      learningPathId: result.learning_path_id,
      stepOrder: result.step_order,
      stepType: result.step_type,
      title: result.title,
      description: result.description,
      contentReferences: safeJsonParse(result.content_references, {}),
      prerequisites: safeJsonParse(result.prerequisites, {}),
      learningObjectives: safeJsonParse(result.learning_objectives, {}),
      estimatedDuration: result.estimated_duration,
      isCompleted: result.is_completed,
      completedAt: result.completed_at,
      completionCriteria: safeJsonParse(result.completion_criteria, {}),
      adaptiveDifficulty: result.adaptive_difficulty,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  },

  async update(id: string, updates: Partial<LearningStep>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'contentReferences' || key === 'prerequisites' || key === 'learningObjectives' || key === 'completionCriteria') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'adaptiveDifficulty') {
        fields.push('adaptive_difficulty = ?');
        values.push(value);
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return;
    
    values.push(id);
    const query = `UPDATE ${TABLES.LEARNING_STEPS} SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await executeSingle(query, values);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.LEARNING_STEPS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Study Session operations
export const studySessionService = {
  async create(session: Omit<StudySession, 'id' | 'createdAt'>): Promise<StudySession> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.STUDY_SESSIONS} 
      (id, user_id, learning_path_id, session_type, title, description, content_selection, 
       difficulty_progression, session_data, performance_metrics, adaptive_feedback, 
       start_time, end_time, duration_minutes, questions_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, session.userId, session.learningPathId, session.sessionType, session.title, session.description,
      JSON.stringify(session.contentSelection || {}),
      JSON.stringify(session.difficultyProgression || {}),
      JSON.stringify(session.sessionData || {}),
      JSON.stringify(session.performanceMetrics || {}),
      JSON.stringify(session.adaptiveFeedback || {}),
      session.startTime, session.endTime || null, session.durationMinutes || null, 
      session.questionsCount || 0, session.status
    ]);
    const createdSession = await studySessionService.getById(id);
    if (!createdSession) {
      throw new Error('Failed to create study session');
    }
    return createdSession;
  },

  async getById(id: string): Promise<StudySession | null> {
    const query = `SELECT * FROM ${TABLES.STUDY_SESSIONS} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      return {
        id: result.id,
        userId: result.user_id,
        learningPathId: result.learning_path_id,
        sessionType: result.session_type,
        title: result.title,
        description: result.description,
        contentSelection: safeJsonParse(result.content_selection, {}),
        difficultyProgression: safeJsonParse(result.difficulty_progression, {}),
        sessionData: safeJsonParse(result.session_data, {}),
        performanceMetrics: safeJsonParse(result.performance_metrics, {}),
        adaptiveFeedback: safeJsonParse(result.adaptive_feedback, {}),
        startTime: result.start_time,
        endTime: result.end_time,
        durationMinutes: result.duration_minutes,
        status: result.status,
        questionsCount: result.questions_count || 0,
        createdAt: result.created_at
      };
    }
    return null;
  },

  async getByUserId(userId: string): Promise<StudySession[]> {
    const query = `SELECT * FROM ${TABLES.STUDY_SESSIONS} WHERE user_id = ? ORDER BY created_at DESC`;
    const results = await executeQuery(query, [userId]);
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      learningPathId: result.learning_path_id,
      sessionType: result.session_type,
      title: result.title,
      description: result.description,
      contentSelection: safeJsonParse(result.content_selection, {}),
      difficultyProgression: safeJsonParse(result.difficulty_progression, {}),
      sessionData: safeJsonParse(result.session_data, {}),
      performanceMetrics: safeJsonParse(result.performance_metrics, {}),
      adaptiveFeedback: safeJsonParse(result.adaptive_feedback, {}),
      startTime: result.start_time,
      endTime: result.end_time,
      durationMinutes: result.duration_minutes,
      status: result.status,
      questionsCount: result.questions_count || 0,
      createdAt: result.created_at
    }));
  },

  async update(id: string, updates: Partial<StudySession>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'contentSelection' || key === 'difficultyProgression' || key === 'sessionData' || 
          key === 'performanceMetrics' || key === 'adaptiveFeedback') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === 'startTime' || key === 'endTime') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value || null); // Convert undefined to null
      } else if (key === 'questionsCount') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value || 0); // Convert undefined to 0
      } else if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return;
    
    values.push(id);
    const query = `UPDATE ${TABLES.STUDY_SESSIONS} SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await executeSingle(query, values);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.STUDY_SESSIONS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Research Query operations
export const researchQueryService = {
  async create(query: Omit<ResearchQuery, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResearchQuery> {
    const id = ID.unique();
    const querySql = `
      INSERT INTO ${TABLES.RESEARCH_QUERIES} 
      (id, user_id, workspace_id, query_text, query_type, search_scope, document_ids, 
       search_results, summary, follow_up_questions, related_topics, confidence_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(querySql, [
      id, query.userId, query.workspaceId, query.queryText, query.queryType,
      query.searchScope,
      JSON.stringify(query.documentIds || []),
      JSON.stringify(query.searchResults || {}),
      query.summary || null,
      JSON.stringify(query.followUpQuestions || []),
      JSON.stringify(query.relatedTopics || []),
      query.confidenceScore || 0.0
    ]);
    const createdQuery = await researchQueryService.getById(id);
    if (!createdQuery) {
      throw new Error('Failed to create research query');
    }
    return createdQuery;
  },

  async getById(id: string): Promise<ResearchQuery | null> {
    const query = `SELECT * FROM ${TABLES.RESEARCH_QUERIES} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      const searchResults = safeJsonParse(result.search_results, {});
      return {
        id: result.id,
        userId: result.user_id,
        workspaceId: result.workspace_id,
        queryText: result.query_text,
        queryType: result.query_type,
        searchScope: result.search_scope,
        documentIds: safeJsonParse(result.document_ids, []),
        searchResults: searchResults,
        findings: searchResults.keyFindings || [],
        sourceDocuments: searchResults.sourceDocuments || [],
        summary: result.summary,
        relatedTopics: safeJsonParse(result.related_topics, []),
        followUpQuestions: safeJsonParse(result.follow_up_questions, []),
        confidenceScore: result.confidence_score || 0.0,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  },

  async getByUserId(userId: string): Promise<ResearchQuery[]> {
    const query = `SELECT * FROM ${TABLES.RESEARCH_QUERIES} WHERE user_id = ? ORDER BY created_at DESC`;
    const results = await executeQuery(query, [userId]);
    return results.map(result => {
      const searchResults = safeJsonParse(result.search_results, {});
      return {
        id: result.id,
        userId: result.user_id,
        workspaceId: result.workspace_id,
        queryText: result.query_text,
        queryType: result.query_type,
        searchScope: result.search_scope,
        documentIds: safeJsonParse(result.document_ids, []),
        searchResults: searchResults,
        findings: searchResults.keyFindings || [],
        sourceDocuments: searchResults.sourceDocuments || [],
        summary: result.summary,
        relatedTopics: safeJsonParse(result.related_topics, []),
        followUpQuestions: safeJsonParse(result.follow_up_questions, []),
        confidenceScore: result.confidence_score || 0.0,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    });
  },

  async update(id: string, updates: Partial<ResearchQuery>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    console.log('ResearchQuery update called with:', { id, updates });
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'documentIds' || key === 'searchResults' || key === 'relatedTopics' || 
          key === 'followUpQuestions') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(JSON.stringify(value));
        console.log(`JSON field ${key} -> ${dbKey}:`, JSON.stringify(value));
      } else if (key === 'confidenceScore') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(Number(value)); // Ensure it's a number
        console.log(`Number field ${key} -> ${dbKey}:`, Number(value));
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
        console.log(`Other field ${key} -> ${dbKey}:`, value);
      }
    });
    
    if (fields.length === 0) return;
    
    values.push(id);
    const query = `UPDATE ${TABLES.RESEARCH_QUERIES} SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    console.log('Update query:', query);
    console.log('Update values:', values);
    await executeSingle(query, values);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.RESEARCH_QUERIES} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};

// Video Generation operations
export const videoGenerationService = {
  async create(videoGeneration: Omit<VideoGeneration, 'id' | 'createdAt' | 'updatedAt'>): Promise<VideoGeneration> {
    const id = ID.unique();
    const query = `
      INSERT INTO ${TABLES.VIDEO_GENERATIONS} 
      (id, user_id, workspace_id, topic, selected_documents, learning_level, video_style, 
       duration_minutes, include_examples, include_visuals, include_quiz, script, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await executeSingle(query, [
      id, 
      videoGeneration.userId, 
      videoGeneration.workspaceId, 
      videoGeneration.topic,
      JSON.stringify(videoGeneration.selectedDocuments || []),
      videoGeneration.learningLevel,
      videoGeneration.videoStyle,
      videoGeneration.durationMinutes,
      videoGeneration.includeExamples,
      videoGeneration.includeVisuals,
      videoGeneration.includeQuiz,
      JSON.stringify(videoGeneration.script || {}),
      videoGeneration.status
    ]);
    const createdVideoGeneration = await videoGenerationService.getById(id);
    if (!createdVideoGeneration) {
      throw new Error('Failed to create video generation');
    }
    return createdVideoGeneration;
  },

  async getById(id: string): Promise<VideoGeneration | null> {
    const query = `SELECT * FROM ${TABLES.VIDEO_GENERATIONS} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    if (results[0]) {
      const result = results[0];
      return {
        id: result.id,
        userId: result.user_id,
        workspaceId: result.workspace_id,
        topic: result.topic,
        selectedDocuments: safeJsonParse(result.selected_documents, []),
        learningLevel: result.learning_level,
        videoStyle: result.video_style,
        durationMinutes: result.duration_minutes,
        includeExamples: result.include_examples,
        includeVisuals: result.include_visuals,
        includeQuiz: result.include_quiz,
        script: safeJsonParse(result.script, {}),
        status: result.status,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    }
    return null;
  },

  async getByUserId(userId: string): Promise<VideoGeneration[]> {
    const query = `SELECT * FROM ${TABLES.VIDEO_GENERATIONS} WHERE user_id = ? ORDER BY created_at DESC`;
    const results = await executeQuery(query, [userId]);
    return results.map(result => ({
      id: result.id,
      userId: result.user_id,
      workspaceId: result.workspace_id,
      topic: result.topic,
      selectedDocuments: safeJsonParse(result.selected_documents, []),
      learningLevel: result.learning_level,
      videoStyle: result.video_style,
      durationMinutes: result.duration_minutes,
      includeExamples: result.include_examples,
      includeVisuals: result.include_visuals,
      includeQuiz: result.include_quiz,
      script: safeJsonParse(result.script, {}),
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  },

  async update(id: string, updates: Partial<Omit<VideoGeneration, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'selectedDocuments' || key === 'script') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(JSON.stringify(value));
      } else if (key !== 'userId' && key !== 'workspaceId' && value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE ${TABLES.VIDEO_GENERATIONS} SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await executeSingle(query, values);
  },

  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${TABLES.VIDEO_GENERATIONS} WHERE id = ?`;
    await executeSingle(query, [id]);
  }
};
