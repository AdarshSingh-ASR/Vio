import React from "react";
import { Brain, Target, Users, Zap, BookOpen, Video, Search, BarChart3 } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-20">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-3xl font-medium text-foreground mb-6 tracking-tight">
          About Vio
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Your AI-native learning companion. We&apos;re building the future of intelligent education, 
          where documents, images, videos, and web content work together with AI-powered learning and knowledge creation.
        </p>
      </div>

      {/* Mission Section */}
      <section className="mb-20">
        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-lg font-medium text-foreground mb-6">Our Mission</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            In an age of information overload, we believe everyone deserves an AI-native learning platform 
            that truly understands their documents, learning goals, and knowledge gaps.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Vio transforms how you learn—from scattered documents, images, videos, and web links to a unified, intelligent system 
            that generates personalized learning paths, creates educational content, and tracks your progress across all content types.
          </p>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="mb-20">
        <h2 className="text-lg font-medium text-foreground mb-12 text-center">What Makes Vio Special</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-primary/10 rounded-lg p-3 mb-3">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2">Universal Content Intelligence</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload documents, images, YouTube videos, or save website links. AI extracts, analyzes, and organizes all content types intelligently.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="bg-primary/10 rounded-lg p-3 mb-3">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2">AI Learning Agents</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multi-step AI workflows that create learning paths, research topics, and orchestrate study sessions.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="bg-primary/10 rounded-lg p-3 mb-3">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2">Content Creation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate educational video scripts, quizzes, and summaries from your documents automatically.
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="bg-primary/10 rounded-lg p-3 mb-3">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2">Progress Analytics</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Track your learning journey with detailed analytics and performance insights.
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="mb-20">
        <h2 className="text-lg font-medium text-foreground mb-12 text-center">What Drives Us</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Intelligence</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI that adapts to your unique way of thinking and learning, making knowledge work effortless.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Focus</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cut through the noise. We help you focus on what matters most in your learning journey.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Community</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Knowledge grows when shared. We&apos;re building tools that connect minds and ideas.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-lg p-2 flex-shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Simplicity</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Powerful doesn&apos;t mean complex. The best tools disappear into your workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="mb-20">
        <div className="bg-muted/30 rounded-lg p-8">
          <h2 className="text-lg font-medium text-foreground mb-6">Our Story</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We started with a simple observation: despite having access to more information than ever, 
              people struggle to make meaningful connections between what they learn.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Traditional learning platforms treat documents as static files. AI tools give you answers 
              but don&apos;t help you learn systematically. We wanted something different—an AI-native system 
              that understands your learning goals and creates personalized educational experiences.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Today, Vio combines advanced AI agents with robust document management to serve learners, 
              educators, and knowledge workers who want to transform information into actionable insights.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center">
        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Join the Journey</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl mx-auto">
            We&apos;re just getting started. Help us build the future of learning and knowledge management.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>🧠 AI-Native</span>
            <span>•</span>
            <span>📚 Universal Content</span>
            <span>•</span>
            <span>🎬 Video & Web Support</span>
            <span>•</span>
            <span>⚡ Lightning Fast</span>
          </div>
        </div>
      </section>
    </main>
  );
} 