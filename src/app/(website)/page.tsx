"use client";
import Image from "next/image";
import React from "react";
import { Button } from "@/components/ui/button";
import vioImage from "@/assets/images/vio.svg";
// import chromeImage from "@/assets/images/chromeImage.svg"
import bgImage from "@/assets/images/backgroundImage.png"
import { Check, Upload, Send } from "lucide-react";
import vector from "@/assets/images/Vector.svg"
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { uploadClassroomFilesDirect } from "@/lib/classroom-upload-client";

export default function Home() {

  const features = [
    "Chat with documents and links",
    "Plan with AI study agents",
    "Create flashcards and highlights",
    "Generate grounded summaries",
    "Practice with adaptive quizzes",
    "Train with listening tests",
 ];

  const { user, getAuthenticatedFetch } = useAuth();
  const isSignedIn = !!user;
  const router = useRouter();
  const [inputValue, setInputValue] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const saveItem = React.useCallback(async (input: string, fileName?: string) => {
    try {
      if (file) {
        const [stored] = await uploadClassroomFilesDirect([file]);
        const response = await getAuthenticatedFetch()('/api/dashboard/upload/register', { method: 'POST', body: JSON.stringify({ fileId: stored.fileId, bucketId: stored.bucketId, displayName: fileName || file.name }) });
        if (response.ok) router.push('/dashboard');
        return;
      } else if (input) {
        const formData = new FormData();
        formData.append('link', input);
        formData.append('type', 'link');
        formData.append('displayName', input);
        const response = await getAuthenticatedFetch()('/api/dashboard/upload', { method: 'POST', body: formData });
        if (response.ok) router.push('/dashboard');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  }, [file, getAuthenticatedFetch, router]);

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
  }, [isSignedIn, saveItem]);

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
        <form onSubmit={handleSubmit} className="mb-8 w-full max-w-3xl">
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5">
            <input
              type="text"
              placeholder={file ? file.name : "Paste URL or upload a file"}
              aria-label="Paste a learning resource URL"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground sm:px-4"
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
              aria-label="Upload a learning resource"
              title="Upload a file"
              className="inline-flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Upload className="h-[18px] w-[18px]" />
            </label>
            <Button
              type="submit"  
              className="h-10 flex-shrink-0 whitespace-nowrap rounded-xl px-4 text-sm font-semibold shadow-sm sm:px-6"
              disabled={!inputValue && !file}
            >
              Get Started
            </Button>
          </div>
        </form>

        {/* Features */}
        <div className="grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature} 
              className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-foreground transition-colors hover:border-primary/45 hover:bg-card/45"
            >
              <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary/70 text-primary">
                <Check className="h-3 w-3" strokeWidth={2.75} aria-hidden="true" />
              </span>
              <span className="text-sm font-medium leading-5">{feature}</span>
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
