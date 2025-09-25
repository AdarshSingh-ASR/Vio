# Vio - Architecture Documentation

## 📊 Database Schema Architecture

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ WORKSPACES : creates
    USERS ||--o{ DASHBOARD_ITEMS : uploads
    USERS ||--o{ QUIZ_RESULTS : takes
    USERS ||--o{ CHAT_MESSAGES : sends
    USERS ||--o{ LEARNING_PATHS : generates
    USERS ||--o{ STUDY_SESSIONS : creates
    USERS ||--o{ RESEARCH_QUERIES : conducts
    USERS ||--o{ VIDEO_GENERATIONS : creates
    
    WORKSPACES ||--o{ DASHBOARD_ITEMS : contains
    WORKSPACES ||--o{ FOLDERS : organizes
    WORKSPACES ||--o{ VIDEO_GENERATIONS : contains
    
    FOLDERS ||--o{ DASHBOARD_ITEMS : groups
    
    LEARNING_PATHS ||--o{ LEARNING_STEPS : contains
    
    USERS {
        string id PK
        string email
        string first_name
        string last_name
        string appwrite_user_id UK
        timestamp created_at
        timestamp updated_at
    }
    
    WORKSPACES {
        string id PK
        string user_id FK
        string name
        boolean is_default
        timestamp created_at
        timestamp updated_at
    }
    
    DASHBOARD_ITEMS {
        string id PK
        string user_id FK
        string workspace_id FK
        string title
        string display_name
        string file_type
        string content_type
        text content
        text extracted_content
        json metadata
        string source_url
        timestamp created_at
        timestamp updated_at
    }
    
    QUIZ_RESULTS {
        string id PK
        string user_id FK
        string item_id FK
        json questions
        json answers
        integer score
        json performance_analysis
        timestamp created_at
    }
    
    CHAT_MESSAGES {
        string id PK
        string user_id FK
        string message
        string response
        json metadata
        timestamp created_at
    }
    
    LEARNING_PATHS {
        string id PK
        string user_id FK
        string title
        text description
        string subject_area
        string difficulty_level
        json knowledge_gaps
        json learning_objectives
        decimal progress_percentage
        timestamp created_at
        timestamp updated_at
    }
    
    LEARNING_STEPS {
        string id PK
        string learning_path_id FK
        integer step_order
        string step_type
        string title
        text description
        integer estimated_duration
        json content_references
        boolean is_completed
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }
    
    STUDY_SESSIONS {
        string id PK
        string user_id FK
        string learning_path_id FK
        string session_type
        string title
        text description
        json content_selection
        json difficulty_progression
        json session_data
        json performance_metrics
        json adaptive_feedback
        timestamp start_time
        timestamp end_time
        integer duration_minutes
        integer questions_count
        string status
        timestamp created_at
        timestamp updated_at
    }
    
    RESEARCH_QUERIES {
        string id PK
        string user_id FK
        string workspace_id FK
        text query_text
        string query_type
        string search_scope
        json document_ids
        json search_results
        text summary
        json follow_up_questions
        json related_topics
        decimal confidence_score
        timestamp created_at
        timestamp updated_at
    }
    
    VIDEO_GENERATIONS {
        string id PK
        string user_id FK
        string workspace_id FK
        string topic
        json selected_documents
        string learning_level
        string video_style
        integer duration_minutes
        boolean include_examples
        boolean include_visuals
        boolean include_quiz
        json script
        string status
        timestamp created_at
        timestamp updated_at
    }
```

## 🔄 Data Flow Diagrams

### Universal Content Upload & Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant P as Content Processor
    participant T as TiDB
    participant S as Appwrite Storage
    participant Y as YouTube API
    participant W as Web Scraper
    
    U->>F: Upload Content (Document/Image/YouTube/Web Link)
    F->>A: POST /api/dashboard/upload
    
    alt Document Upload
        A->>P: Process Document (PDF/Word/PPT/Excel)
        P->>P: Extract Text Content
    else Image Upload
        A->>P: Process Image
        P->>P: OCR Text Extraction
    else YouTube Upload
        A->>Y: Extract Video Metadata & Transcript
        Y-->>A: Video Content & Transcript
    else Web Link Upload
        A->>W: Scrape Website Content
        W-->>A: Parsed Web Content
    end
    
    P->>P: Clean & Structure Data
    A->>S: Store File/Content
    A->>T: Store Metadata & Content
    T-->>A: Content ID
    A-->>F: Success Response
    F-->>U: Content Available
```

### AI Chat Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant T as TiDB
    participant G as Groq API
    participant O as OpenAI API
    
    U->>F: Send Message
    F->>A: POST /api/chat
    A->>T: Get User Documents
    A->>A: Build Context
    A->>G: Generate Response
    alt Groq Success
        G-->>A: AI Response
    else Groq Fails
        A->>O: Fallback to OpenAI
        O-->>A: AI Response
    end
    A->>T: Store Message & Response
    A-->>F: Response
    F-->>U: Display Response
```

### Study Session Orchestration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant T as TiDB
    participant AI as AI Models
    
    U->>F: Create Study Session
    F->>A: POST /api/dashboard/study-sessions/orchestrate
    A->>T: Get User Documents
    A->>AI: Assess Knowledge Level
    A->>AI: Select Optimal Content
    A->>AI: Generate Adaptive Questions
    A->>T: Create Study Session
    A->>T: Store Questions & Progress
    A-->>F: Session Created
    F-->>U: Start Study Session
    
    loop Interactive Study
        U->>F: Answer Question
        F->>A: POST /api/dashboard/study-sessions/[id]/answer
        A->>A: Check Answer
        A->>T: Update Progress
        A-->>F: Feedback & Next Question
        F-->>U: Show Results
    end
```

### Learning Path Generation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant T as TiDB
    participant AI as AI Models
    
    U->>F: Generate Learning Path
    F->>A: POST /api/dashboard/learning-paths/generate
    A->>T: Get User Documents
    A->>AI: Analyze Content
    A->>AI: Identify Knowledge Gaps
    A->>AI: Generate Learning Steps
    A->>T: Create Learning Path
    A->>T: Store Learning Steps
    A-->>F: Learning Path Created
    F-->>U: Display Path & Steps
```

### Video Generation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant T as TiDB
    participant G as Groq API
    participant O as OpenAI API
    
    U->>F: Configure Video Script
    F->>A: POST /api/dashboard/video-generator
    A->>T: Get Selected Documents
    A->>A: Build Context from Documents
    A->>G: Generate Video Script
    alt Groq Success
        G-->>A: Generated Script
    else Groq Fails
        A->>O: Fallback to OpenAI
        O-->>A: Generated Script
    end
    A->>T: Store Video Generation
    A-->>F: Script Response
    F-->>U: Display Generated Script
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Appwrite
    participant API as API Routes
    participant T as TiDB
    
    U->>F: Login Request
    F->>A: Authenticate User
    A-->>F: JWT Token
    F->>API: API Request with JWT
    API->>A: Verify JWT
    A-->>API: User Data
    API->>T: Get/Create User Record
    T-->>API: User Data
    API-->>F: Protected Response
    F-->>U: Authenticated Content
```

## 🤖 AI Integration Architecture

### Multi-Model Architecture

```mermaid
graph TB
    subgraph "AI Model Selection"
        A[User Request] --> B{Model Selection}
        B --> C[Groq - Primary]
        B --> D[OpenAI - Fallback]
        B --> E[Gemini - Summarization]
    end
    
    subgraph "Groq API"
        C --> F[llama-3.1-8b-instant]
        F --> G[Chat Responses]
        F --> H[Quiz Generation]
        F --> I[Question Generation]
        F --> J[Video Script Generation]
    end
    
    subgraph "OpenAI API"
        D --> K[gpt-3.5-turbo]
        K --> L[Fallback Chat]
        K --> M[Fallback Video Scripts]
    end
    
    subgraph "Gemini AI"
        E --> N[gemini-2.0-flash-exp]
        N --> O[Content Summarization]
        N --> P[Document Analysis]
    end
```

### Data Processing Pipeline

```mermaid
graph TB
    A[File Upload] --> B[File Validation]
    B --> C[Type Detection]
    C --> D[Content Extraction]
    D --> E[Text Cleaning]
    E --> F[Content Analysis]
    F --> G[Metadata Generation]
    G --> H[Database Storage]
    H --> I[AI Processing]
    I --> J[Ready for Use]
    
    subgraph "Content Extraction"
        D1[PDF Parser]
        D2[Word Parser]
        D3[PowerPoint Parser]
        D4[Excel Parser]
        D5[OCR for Images]
        D6[YouTube Transcript Extractor]
        D7[Web Content Scraper]
    end
    
    D --> D1
    D --> D2
    D --> D3
    D --> D4
    D --> D5
    D --> D6
    D --> D7
```

### AI Processing Pipeline

```mermaid
graph TB
    A[User Request] --> B[Context Retrieval]
    B --> C[Model Selection]
    C --> D[Prompt Construction]
    D --> E[AI Processing]
    E --> F[Response Generation]
    F --> G[Response Validation]
    G --> H[Storage]
    H --> I[User Response]
    
    subgraph "Context Building"
        B1[Document Content]
        B2[Chat History]
        B3[User Preferences]
        B4[Session Context]
    end
    
    B --> B1
    B --> B2
    B --> B3
    B --> B4
```

## 🗄️ Database Layer Details

### Core Tables

#### Users & Authentication
- **`users`**: User profiles and authentication data
- **`workspaces`**: User workspace organization with default workspace support

#### Content Management
- **`dashboard_items`**: Universal content metadata, content, and extracted text (documents, images, videos, web links)
- **`folders`**: Hierarchical content organization
- **`item_folders`**: Many-to-many relationship between items and folders

#### Learning & Assessment
- **`quiz_results`**: Quiz attempts, scores, and detailed performance analysis
- **`chat_messages`**: Conversation history and AI interactions
- **`learning_paths`**: AI-generated personalized learning paths
- **`learning_steps`**: Individual steps within learning paths
- **`study_sessions`**: Adaptive study sessions with progress tracking
- **`research_queries`**: Research assistant queries and results
- **`video_generations`**: Educational video script generation requests and results

### Data Relationships

```mermaid
graph LR
    A[Users] --> B[Workspaces]
    A --> C[Dashboard Items]
    A --> D[Quiz Results]
    A --> E[Chat Messages]
    A --> F[Learning Paths]
    A --> G[Study Sessions]
    A --> H[Research Queries]
    A --> Q[Video Generations]
    
    B --> C
    B --> Q
    F --> I[Learning Steps]
    
    C --> J[Folders]
    C --> K[Item Folders]
```

## 🔐 Security Architecture

### Authentication & Authorization

```mermaid
graph TB
    A[User Login] --> B[Appwrite Auth]
    B --> C[JWT Token]
    C --> D[API Request]
    D --> E[Token Validation]
    E --> F[User Context]
    F --> G[Database Query]
    G --> H[User-Scoped Data]
    
    subgraph "Security Layers"
        I[Input Validation]
        J[SQL Injection Prevention]
        K[XSS Protection]
        L[Rate Limiting]
    end
    
    D --> I
    G --> J
    H --> K
    E --> L
```

## 🛠️ Recent System Improvements

### API Enhancements (Latest Updates)

#### Search Functionality
- **TiDB Integration**: Migrated search from Appwrite to TiDB for better performance
- **User ID Mapping**: Implemented proper Appwrite-to-TiDB user ID mapping
- **Multi-Content Search**: Search across documents, folders, and quiz results
- **Workspace Scoping**: Search results scoped to user's workspace

#### Delete Operations
- **Learning Paths**: Added DELETE endpoint for learning path management
- **Research Queries**: Implemented research query deletion with user verification
- **Study Sessions**: Added study session deletion with proper authorization
- **Security**: All delete operations include ownership verification

#### UI/UX Improvements
- **Scrollable Content**: Made context selection and generated content lists scrollable
- **Hover Effects**: Added delete buttons that appear on hover for better UX
- **Auto-resize Textarea**: Fixed textarea auto-resize for programmatic content insertion
- **Sidebar Navigation**: Improved active tab highlighting with URL synchronization

#### Error Handling
- **JSON Parsing**: Enhanced AI response parsing with regex extraction and fallback handling
- **API Fallbacks**: Improved error handling for AI service failures
- **User Feedback**: Better error messages and loading states

### System Reliability Features

#### Robust AI Integration
- **Multi-Model Fallback**: Groq → OpenAI → Gemini fallback chain
- **Response Validation**: JSON parsing with regex extraction and error recovery
- **Context Management**: Improved context building for AI responses
- **Rate Limiting**: Built-in protection against API abuse

#### Data Consistency
- **Transaction Safety**: ACID compliance for critical operations
- **User Isolation**: Proper data segregation and access control
- **Workspace Management**: Default workspace handling and user verification
- **Content Integrity**: Validation and sanitization of all user inputs

## 📊 Performance Considerations

### Caching Strategy

```mermaid
graph TB
    A[User Request] --> B{Cache Check}
    B -->|Hit| C[Return Cached Data]
    B -->|Miss| D[Database Query]
    D --> E[Process Data]
    E --> F[Update Cache]
    F --> G[Return Data]
    
    subgraph "Cache Layers"
        H[Browser Cache]
        I[API Response Cache]
        J[Database Query Cache]
    end
    
    B --> H
    F --> I
    D --> J
```

### Scalability Architecture

```mermaid
graph TB
    subgraph "Load Balancer"
        A[User Requests]
    end
    
    subgraph "Application Layer"
        B[Next.js App Instance 1]
        C[Next.js App Instance 2]
        D[Next.js App Instance N]
    end
    
    subgraph "Database Layer"
        E[TiDB Cluster]
        F[Read Replicas]
        G[Write Primary]
    end
    
    A --> B
    A --> C
    A --> D
    B --> E
    C --> E
    D --> E
    E --> F
    E --> G
```
