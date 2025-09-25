"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserButton } from "@/components/auth/UserButton";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import vioImage from "@/assets/images/vio.svg";

export function LandingPageNavbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const isSignedIn = !!user;

  // Prevent layout shift when dropdowns open
  useEffect(() => {
    // Add scrollbar compensation to prevent page jumping
    const style = document.createElement('style');
    style.textContent = `
      /* Prevent page shake when dropdown opens */
      html {
        overflow-anchor: none;
        scroll-behavior: smooth;
      }
      
      /* Stabilize dropdown animations */
      [data-radix-popper-content-wrapper] {
        will-change: transform;
        transform: translateZ(0);
      }
      
      /* Smooth dropdown transitions */
      [data-state="open"] {
        animation-duration: 150ms;
        animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      [data-state="closed"] {
        animation-duration: 100ms;
        animation-timing-function: ease-in;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const routes = [
    {
      href: "/pricing",
      label: "Pricing",
    },
    {
      href: "/features", 
      label: "Features",
    },
    {
      href: "/about",
      label: "About",
    },
  ];

  // Get user initials for fallback
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl py-4 px-6 mb-16 shadow-sm">
      <header className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Logo */}
          <div className="flex-shrink-0 z-20">
            <Link href="/" className="block hover:opacity-80 transition-opacity">
              <Image src={vioImage} alt="Vio" className="h-8 w-auto" />
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden md:flex py-2 absolute left-0 right-0 justify-center z-10">
            <div className="flex items-center justify-center space-x-8 bg-muted/30 backdrop-blur-sm rounded-full px-6 py-2">
              {routes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`text-sm font-medium transition-all duration-200 hover:text-primary relative px-3 py-1.5 rounded-full ${
                    pathname === route.href 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {route.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-3 z-20">
            {isSignedIn ? (
              <div className="flex items-center space-x-3">
                <Link 
                  href="/dashboard" 
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </Link>
                <div className="relative">
                  {/* Stabilizing container to prevent layout shifts */}
                  <div className="transition-transform hover:scale-105 duration-200 transform-gpu will-change-transform">
                    <UserButton />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/auth/sign-in">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs font-medium h-8 px-3 hover:bg-muted rounded-md"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button 
                    size="sm" 
                    className="text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
                  >
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-full z-20"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-6 pt-6 border-t border-border/50">
            <nav className="flex flex-col space-y-3">
              {routes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`text-sm font-medium transition-all duration-200 px-3 py-2 rounded-lg ${
                    pathname === route.href 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {route.label}
                </Link>
              ))}
              
              <div className="pt-4 space-y-3 border-t border-border/30 mt-4">
                {isSignedIn ? (
                  <div className="flex flex-col space-y-3">
                    <Link 
                      href="/dashboard" 
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
                    >
                      <Home className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <div className="flex items-center space-x-2 px-3 py-1.5">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user?.imageUrl} alt={user?.firstName || user?.email} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-foreground">
                        {user.firstName || user.username}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <Link href="/auth/sign-in" className="w-full">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start text-xs font-medium h-8 hover:bg-muted rounded-md"
                      >
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/auth/sign-up" className="w-full">
                      <Button 
                        size="sm" 
                        className="w-full justify-start text-xs font-medium h-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
                      >
                        Sign Up
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    </div>
  );
} 