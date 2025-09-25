# Vio - Quick Setup Guide for Hackathon Judges

## 🚀 Quick Start (5 minutes)

## Prerequisites

1. **TiDB Cloud Account**: Sign up at [TiDB Cloud](https://tidbcloud.com/)
2. **Node.js 18+**: Ensure you have Node.js installed
3. **Environment Variables**: Configure your database credentials

## Step 1: Create TiDB Cloud Database

1. Go to [TiDB Cloud Console](https://tidbcloud.com/)
2. Create a new cluster or use an existing one
3. Note down your connection details:
   - **Host**: Your cluster endpoint
   - **Port**: Usually 4000
   - **Username**: Your database user
   - **Password**: Your database password
   - **Database**: Create a database (e.g., `vio_database`)

## Step 2: Configure Environment Variables
 1. Clone the Repository
```bash
git clone https://github.com/your-username/vio.git
cd vio
```

 2. Install Dependencies
```bash
npm install
```

 3. Environment Setup
```bash
cp .env.example .env.local
```

**Required Environment Variables:**
```env
# TiDB Configuration
TIDB_HOST=your-cluster-endpoint.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=your-username
TIDB_PASSWORD=your-password
TIDB_DATABASE=vio_database
TIDB_SSL=true

# Appwrite Configuration 
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key

# AI Services 
OPENAI_API_KEY=your-openai-key
OPENAI_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
```

 4. Database Setup
```bash
npm run setup:tidb
```
This will create the following tables:
- `users` - User profiles and authentication data
- `workspaces` - Learning workspaces for organization
- `folders` - Hierarchical folder structure
- `dashboard_items` - Universal learning content (documents, images, videos, web links)
- `item_folders` - Many-to-many relationships between items and folders
- `item_notes` - AI-generated and user notes
- `quiz_results` - Quiz performance tracking
- `file_metadata` - File storage metadata and URLs
- `learning_paths` - AI-generated personalized learning paths
- `learning_steps` - Individual steps within learning paths
- `study_sessions` - Adaptive study sessions with progress tracking
- `research_queries` - Research assistant queries and results
- `video_generations` - Educational video script generation requests and results

 5. Start the Application
```bash
npm run dev
```

 6. Access the Application
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎯 Demo Scenarios for Judges

### Scenario 1: Content Upload & Processing
1. **Sign up/Login** to create an account
2. **Upload a PDF document** (any educational content)
3. **Upload a YouTube video** (educational content)
4. **Upload a web link** (educational article)
5. **Observe** how content is automatically processed and organized

### Scenario 2: AI-Powered Learning
1. **Navigate to Chat** section
2. **Ask questions** about your uploaded content
3. **Generate a quiz** from your content
4. **Take the quiz** and see immediate feedback
5. **View performance analytics**

### Scenario 3: Learning Path Generation
1. **Go to Learning Paths** section
2. **Generate a learning path** based on your content
3. **Follow the generated steps**
4. **Create a study session** from the learning path
5. **Experience adaptive learning**

### Scenario 4: Advanced Features
1. **Use Research Assistant** to find information across all content
2. **Generate video scripts** from your content
3. **Create folders** to organize content
4. **Search across all content** using the search feature

## 🔧 Troubleshooting

### Common Issues

**Database Connection Error:**
- Verify TiDB connection string is correct
- Ensure database is accessible from your network

**AI API Errors:**
- Check API keys are valid and have sufficient credits
- Verify internet connection for API calls

**File Upload Issues:**
- Ensure files are under 10MB
- Check file format is supported (PDF, DOC, PPT, XLS, images, YouTube links)

**Authentication Issues:**
- Clear browser cache and cookies
- Verify Appwrite configuration

### Getting Help
- Check the console for error messages
- Review the README.md for detailed documentation
- Contact: [your-email@example.com]

## 📊 Key Features to Highlight

### 1. Universal Content Processing
- Upload any format (PDF, Word, PowerPoint, Excel, images, YouTube, web links)
- Automatic content extraction and processing
- Smart organization and categorization

### 2. AI-Powered Intelligence
- Multi-model AI architecture (Groq, OpenAI, Gemini)
- Context-aware responses based on your content
- Intelligent fallback system for reliability

### 3. Adaptive Learning
- Personalized learning paths
- Dynamic quiz generation
- Real-time performance tracking
- Adaptive difficulty adjustment

### 4. Advanced Analytics
- Comprehensive learning analytics
- Performance insights and recommendations
- Progress tracking across all content

### 5. Content Creation Tools
- Video script generation
- Research assistant
- Study session orchestration
- Interactive learning interfaces

## 🏆 Hackathon Judging Criteria Alignment

### Educational Impact ✅
- Solves real-world problems in education
- Improves learning accessibility and personalization
- Provides measurable learning outcomes

### Innovation & Creativity ✅
- Novel approach to universal content processing
- Multi-model AI architecture with intelligent fallbacks
- Adaptive learning engine that evolves with users

### Functionality ✅
- Fully functional prototype with comprehensive features
- Robust error handling and user feedback
- Scalable architecture supporting multiple users

### Technical Excellence ✅
- Modern tech stack with best practices
- Clean, maintainable code structure
- Comprehensive documentation and setup guides

---

**Ready to experience the future of personalized learning!** 🚀
