import React from "react";
import { 
  Brain, 
  MessageSquare, 
  FileText, 
  Search, 
  Lightbulb, 
  BookOpen, 
  Zap, 
  Shield,
  Globe,
  Smartphone,
  Users,
  BarChart,
  Video,
  Target,
  Play,
  Mic,
  TrendingUp,
  FolderOpen,
  CheckCircle
} from "lucide-react";

export default function FeaturesPage() {
  const mainFeatures = [
    {
      icon: FileText,
      title: "Universal Content Intelligence",
      description: "Upload documents (PDF, Word, PowerPoint, Excel), images, YouTube videos, or save website links. AI extracts, analyzes, and organizes all content types intelligently.",
      benefits: ["Multi-format support", "OCR for images", "YouTube transcript extraction", "Website content parsing"]
    },
    {
      icon: Brain,
      title: "AI Learning Agents",
      description: "Multi-step AI workflows that create personalized learning paths, conduct research, orchestrate study sessions, and generate educational content.",
      benefits: ["Learning Path Generator", "Research Assistant", "Study Session Orchestrator", "Adaptive learning"]
    },
    {
      icon: MessageSquare,
      title: "Intelligent Chat",
      description: "Chat naturally with your documents using Groq and OpenAI. Get contextual answers, generate summaries, and explore ideas with AI assistance.",
      benefits: ["Context-aware responses", "Document-based chat", "Multi-model AI", "Real-time conversations"]
    },
    {
      icon: Video,
      title: "Learning Script Studio",
      description: "Generate engaging educational video scripts and video from your documents. Create structured content with examples, visuals, and quiz questions.",
      benefits: ["AI script generation", "Educational content", "Visual elements", "Interactive quizzes"]
    },
    {
      icon: CheckCircle,
      title: "Smart Assessment",
      description: "Transform your content into interactive quizzes and listening tests. Track your progress with detailed analytics and performance insights.",
      benefits: ["Auto-generated quizzes", "Listening comprehension", "Performance tracking", "Progress analytics"]
    },
    {
      icon: FolderOpen,
      title: "Universal Workspace Organization",
      description: "Organize documents, images, videos, and web links with hierarchical folders, semantic search, and intelligent content categorization.",
      benefits: ["Multi-media support", "Hierarchical folders", "Semantic search", "Smart content discovery"]
    }
  ];

  const additionalFeatures = [
    {
      icon: Target,
      title: "Learning Path Generator",
      description: "AI creates personalized learning paths based on your documents and learning goals with adaptive difficulty progression."
    },
    {
      icon: Search,
      title: "Research Assistant",
      description: "Conduct comprehensive research across your documents with AI-powered analysis and knowledge synthesis."
    },
    {
      icon: Play,
      title: "Study Session Orchestrator",
      description: "Create adaptive study sessions with real-time difficulty adjustment and interactive question-answering."
    },
    {
      icon: Mic,
      title: "Listening Tests",
      description: "Audio-based comprehension tests with text-to-speech integration for enhanced learning experiences."
    },
    {
      icon: TrendingUp,
      title: "Performance Analytics",
      description: "Detailed analytics showing learning trends, improvement areas, and personalized recommendations."
    },
    {
      icon: Zap,
      title: "Multi-Model AI",
      description: "Powered by Groq, OpenAI, and Gemini AI with intelligent fallback mechanisms for optimal performance."
    },
    {
      icon: Shield,
      title: "Secure & Scalable",
      description: "Built on TiDB for enterprise-grade scalability with robust authentication and data protection."
    },
    {
      icon: Smartphone,
      title: "Responsive Design",
      description: "Works seamlessly across desktop and mobile devices with adaptive UI and touch-friendly interactions."
    },
    {
      icon: BarChart,
      title: "Progress Tracking",
      description: "Monitor your learning journey with detailed progress tracking and performance insights across all features."
    }
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-3xl font-medium text-foreground mb-6 tracking-tight">
          AI-Native Learning Companion
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          From documents and images to YouTube videos and web links, Vio provides a complete AI-powered platform 
          for modern learners, educators, and knowledge workers to organize and learn from any content type.
        </p>
      </div>

      {/* Main Features Grid */}
      <section className="mb-20">
        <h2 className="text-lg font-medium text-foreground mb-12 text-center">
          Core Learning Features
        </h2>
        <div className="grid lg:grid-cols-2 gap-12">
          {mainFeatures.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="flex gap-6">
                <div className="bg-primary/10 rounded-lg p-3 flex-shrink-0">
                  <IconComponent className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {feature.description}
                  </p>
                  <ul className="space-y-1">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Additional Features */}
      <section className="mb-20">
        <h2 className="text-lg font-medium text-foreground mb-12 text-center">
          AI Agents & Advanced Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {additionalFeatures.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="bg-card border border-border rounded-lg p-6">
                <div className="bg-primary/10 rounded-lg p-2 w-fit mb-4">
                  <IconComponent className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Technology Section */}
      <section className="mb-20">
        <div className="bg-muted/30 rounded-lg p-8">
          <h2 className="text-lg font-medium text-foreground mb-6 text-center">
            Powered by Advanced Technology
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
            Built with cutting-edge AI models and enterprise-grade infrastructure for 
            reliable, scalable, and intelligent learning experiences.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              "Groq AI", "OpenAI GPT", "Gemini AI", "TiDB Database", 
              "Next.js 14", "Appwrite Auth", "React 18", "Tailwind CSS"
            ].map((tech, index) => (
              <div key={index} className="bg-card border border-border rounded-lg p-4 text-center">
                <span className="text-xs font-medium text-foreground">{tech}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mb-20">
        <h2 className="text-lg font-medium text-foreground mb-12 text-center">
          Perfect For
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-primary/10 rounded-lg p-4 w-fit mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-3">Students & Learners</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create personalized learning paths, generate study materials, and track progress with AI-powered insights.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-primary/10 rounded-lg p-4 w-fit mx-auto mb-4">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-3">Educators & Trainers</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate educational content, create video scripts, and develop interactive learning experiences.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-primary/10 rounded-lg p-4 w-fit mx-auto mb-4">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-3">Knowledge Workers</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Organize documents, conduct research, and transform information into actionable insights with AI assistance.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center">
        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-lg font-medium text-foreground mb-4">
            Ready to Experience AI-Native Learning?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl mx-auto">
            Experience the future of intelligent education. Start your journey with personalized learning paths, 
            AI-generated content, and comprehensive progress tracking.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>🎬 Video Script Generation</span>
            <span>🧠 Multi-AI Agents</span>
            <span>📊 Progress Analytics</span>
          </div>
        </div>
      </section>
    </main>
  );
} 