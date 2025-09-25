"use client";
import Image from "next/image";
import React from "react";
import { Button } from "@/components/ui/button";
import vioImage from "@/assets/images/vio.svg";
// import chromeImage from "@/assets/images/chromeImage.svg"
import bgImage from "@/assets/images/backgroundImage.png"
import { Upload, Send } from "lucide-react";
import vector from "@/assets/images/Vector.svg"
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {

  const features = [
    "chat with documents, images, videos & web links",
    "AI study agents that guide & plan your learning",
    "flashcards/highlights",
    "smart summaries",
    "adaptive quizzes",
    "listening tests",
    "learning script studio",
 ];

  const { user } = useAuth();
  const isSignedIn = !!user;
  const router = useRouter();
  const [inputValue, setInputValue] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const saveItem = async (input: string, fileName?: string, fileData?: string) => {
    try {
      const formData = new FormData();
      
      if (file) {
        formData.append('file', file);
        formData.append('type', 'file');
        formData.append('displayName', fileName || file.name);
      } else if (input) {
        formData.append('url', input);
        formData.append('type', 'link');
        formData.append('displayName', input);
      }

      const response = await fetch('/api/dashboard/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  // On mount, check if there's a pending upload after login
  React.useEffect(() => {
    if (isSignedIn && typeof window !== "undefined") {
      const pending = window.sessionStorage.getItem("pending-upload");
      if (pending) {
        const { inputValue: pendingInput, fileName } = JSON.parse(pending);
        // Call your save API here
        saveItem(pendingInput, fileName);
        window.sessionStorage.removeItem("pending-upload");
      }
    }
  }, [isSignedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue && !file) return;

    if (!isSignedIn) {
      // Store the data for after login
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("pending-upload", JSON.stringify({
          inputValue,
          fileName: file?.name,
        }));
      }
      router.push('/auth/sign-in');
      return;
    }

    await saveItem(inputValue);
  };

  return (
    <main className="w-full flex flex-col items-center pt-12 gap-16 mt-8 pb-0">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto px-6">
        <Image
          src={vioImage}
          alt="vio"
          className="mb-6"
          width={320}
          height={80}
        />
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
          Your second brain. Save, recall and learn
        </p>
        
        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
          <div className="flex bg-card border border-border rounded-lg p-2 shadow-sm">
            <input
              type="text"
              placeholder={file ? file.name : "Paste URL or upload a file"}
              className="bg-transparent px-4 py-2 flex-1 text-sm outline-none placeholder:text-muted-foreground"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center mr-2 p-1"
            >
              <Upload size={18} />
            </label>
            <Button
              type="submit"  
              className="whitespace-nowrap px-6 py-2 text-sm font-medium"
              disabled={!inputValue && !file}
            >
              {isSignedIn ? 'Get Started' : 'Get Started'}
            </Button>
          </div>
        </form>

        {/* Features */}
        <div className="flex flex-wrap gap-3 items-center justify-center max-w-3xl">
          {features.map((feature) => (
            <div
              key={feature} 
              className="text-foreground bg-card flex items-center justify-between px-4 py-2 rounded-lg gap-2 border border-border shadow-sm"
            >
              <span className="text-sm font-medium flex-1">{feature}</span>
              <span className="text-white w-4 h-4 flex-shrink-0 rounded-full inline-flex justify-center items-center text-xs bg-green-500">
                ✓
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Chrome Extension CTA */}
      {/* <div className="flex justify-center items-center">
        <Button 
          className="rounded-full text-white gap-3 px-6 py-3 bg-primary hover:bg-primary/90 border-2 border-primary/20"
        >
          <Image src={chromeImage} alt="chrome" className="w-5 h-5" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-normal">Install the</span>
            <span className="text-sm font-semibold">Chrome Extension</span>
          </div>
        </Button>
      </div> */}

      {/* Bottom Section with Chat Interface */}
      <section
        className="w-screen relative -mx-6 md:-mx-16 lg:-mx-32 mb-0 mt-8"
        style={{
          backgroundImage: `url(${bgImage.src})`, 
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: '300px',
          display: 'flex',
          alignItems: 'flex-end',
          marginBottom: '-0.1px',
          position: 'relative',
          bottom: 0,
          padding: 0,
        }}
      >
        <div className="flex items-center justify-center w-full mb-0">
          <div className="relative w-full px-4 pb-0 max-w-4xl">
            {/* Chat Interface Preview */}
            <div className="flex flex-col bg-white rounded-2xl px-3 py-2 shadow-lg mx-auto mb-0 h-32">
              <button className="text-xs text-foreground flex items-center gap-2 ml-1 mb-1 mt-2 self-start px-2 py-1">
                <span className="bg-muted text-foreground rounded flex items-center justify-center w-6 h-6">
                  <Image src={vector} alt="vector" className="rounded" width={12} height={12} />
                </span>
                select context
              </button>
              <div className="flex items-center bg-white rounded-md px-3 py-2 h-full w-full">
                <input
                  type="text"
                  placeholder="Ask your data"
                  className="bg-transparent flex-1 outline-none text-xl text-muted-foreground/50"
                  readOnly
                />
                <button className="bg-primary/10 rounded-xl flex items-center justify-center w-12 h-12">
                  <Send size={20} className="text-primary" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
