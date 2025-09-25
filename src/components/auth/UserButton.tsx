"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User, RefreshCw } from "lucide-react";
import { refreshGoogleProfilePicture } from "@/lib/appwrite-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export const UserButton = () => {
  const { user, signOut, isSignedIn, refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  if (!isSignedIn || !user) {
    return null;
  }

  const initials = user.firstName && user.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email[0].toUpperCase();

  const handleRefreshProfilePicture = async () => {
    setIsRefreshing(true);
    try {
      const success = await refreshGoogleProfilePicture();
      if (success) {
        toast.success("Profile picture updated successfully!");
        // Refresh the user data in the auth context
        if (refreshUser) {
          await refreshUser();
        }
      } else {
        toast.info("No profile picture update needed or not a Google account");
      }
    } catch (error) {
      console.error("Error refreshing profile picture:", error);
      toast.error("Failed to refresh profile picture");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProfileClick = () => {
    router.push('/dashboard/settings?tab=profile');
  };

  const handleSettingsClick = () => {
    router.push('/dashboard/settings?tab=appearance');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarImage src={user.imageUrl} alt={user.firstName || user.email} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.username || "User"
              }
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSettingsClick} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleRefreshProfilePicture}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Profile Picture</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}; 