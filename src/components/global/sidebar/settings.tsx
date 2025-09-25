"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTheme } from "next-themes";
import { themes } from "@/lib/themes";
import { Check, Monitor, Moon, Palette, Sun, User, Trash2, Loader2, Save } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { clientAccount } from "@/lib/appwrite-client";
import { useRouter, useSearchParams } from "next/navigation";

const SettingsContentInner = () => {
  const { theme: currentTheme, setTheme } = useTheme();
  const { user, signOut, refreshUser, getAuthenticatedFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = React.useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Get initial tab from URL parameters or default to 'appearance'
  const initialTab = searchParams.get('tab') || 'appearance';
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    email: user?.email || '',
  });

  React.useEffect(() => {
    setMounted(true);
    // Update form when user data changes
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        email: user.email || '',
      });
    }
  }, [user]);

  // Update active tab when URL parameters change
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && (tabFromUrl === 'appearance' || tabFromUrl === 'profile')) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Ensure theme is properly applied on mount
  useEffect(() => {
    if (mounted && currentTheme) {
      const resolvedTheme = currentTheme === 'system' ? 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
        currentTheme;
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  }, [mounted, currentTheme]);

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-32"></div>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded w-24"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      // Update user name and preferences
      await clientAccount.updateName(`${profileForm.firstName} ${profileForm.lastName}`.trim());
      
      // Update user preferences
      await clientAccount.updatePrefs({
        username: profileForm.username,
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
      });

      // Refresh user data in context
      await refreshUser();
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Call our API endpoint to delete the user account
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/user/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }
      
      // Clear user state and sign out
      await signOut();
      
      // Show success message
      toast.success("Account deleted successfully");
      
      // Explicit redirect to landing page after a short delay
      setTimeout(() => {
        router.push('/');
      }, 1000);
      
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  const ThemeCard = ({ theme }: { theme: typeof themes[number] }) => {
    const isActive = currentTheme === theme.value;
    return (
      <div
        className={`relative rounded-md p-4 cursor-pointer border-2 transition-all ${
          isActive
            ? 'border-primary ring-2 ring-primary/30'
            : 'border hover:border-primary/50'
        }`}
        onClick={() => setTheme(theme.value)}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-medium">{theme.name}</h3>
          {isActive && <Check className="h-5 w-5 text-primary" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 rounded" style={{ backgroundColor: theme.preview.background }}></div>
          <div className="h-8 rounded" style={{ backgroundColor: theme.preview.primary }}></div>
          <div className="h-8 rounded" style={{ backgroundColor: theme.preview.accent }}></div>
          <div className="h-8 rounded" style={{ backgroundColor: theme.preview.foreground, opacity: 0.1 }}></div>
        </div>
      </div>
    );
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of your email client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Theme</h3>
                  <RadioGroup defaultValue={currentTheme} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="system" id="system" onClick={() => setTheme("system")} />
                      <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer">
                        <Monitor className="h-4 w-4" />
                        System
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="light" id="light" onClick={() => setTheme("light")} />
                      <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                        <Sun className="h-4 w-4" />
                        Light
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dark" id="dark" onClick={() => setTheme("dark")} />
                      <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                        <Moon className="h-4 w-4" />
                        Dark
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="notion-light" id="notion-light" onClick={() => setTheme("notion-light")} />
                      <Label htmlFor="notion-light" className="flex items-center gap-2 cursor-pointer">
                        <Palette className="h-4 w-4" />
                        Notion Light
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="notion-dark" id="notion-dark" onClick={() => setTheme("notion-dark")} />
                      <Label htmlFor="notion-dark" className="flex items-center gap-2 cursor-pointer">
                        <Palette className="h-4 w-4" />
                        Notion Dark
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">Color Schemes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {themes.map((theme) => (
                      <ThemeCard key={theme.value} theme={theme} />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Profile</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Manage your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Profile Picture Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.imageUrl} alt={user?.firstName || user?.email} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">Profile Picture</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {user?.imageUrl ? 'Your profile picture from Google account' : 'No profile picture set'}
                  </p>
                </div>
              </div>

              {/* Profile Form */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="h-9 text-sm"
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="h-9 text-sm"
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Username
                  </Label>
                  <Input
                    id="username"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                    className="h-9 text-sm"
                    placeholder="Enter your username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    disabled
                    className="h-9 text-sm bg-muted/50 cursor-not-allowed"
                    placeholder="Your email address"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed for security reasons
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-start">
                  <Button 
                    onClick={handleProfileUpdate}
                    disabled={isUpdating}
                    className="h-9 px-4 text-sm"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-red-600 dark:text-red-400">
                Danger Zone
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 border rounded-lg border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-foreground">Delete Account</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="h-8 px-3 text-xs ml-4"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>This action cannot be undone. This will permanently delete your account and remove all your data from our servers.</p>
                          <p className="font-medium">This includes:</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            <li>All saved items and content</li>
                            <li>All folders and organization</li>
                            <li>All quiz results and progress</li>
                            <li>Your profile and settings</li>
                          </ul>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="h-9 text-sm">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          className="h-9 text-sm bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                          Yes, delete my account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SettingsContent = () => {
  return (
    <Suspense fallback={
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-32"></div>
        <div className="space-y-4">
          <div className="h-6 bg-muted rounded w-24"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    }>
      <SettingsContentInner />
    </Suspense>
  );
};

export default SettingsContent; 