import React from "react";
import { useMyProfile } from "@/hooks/useProfiles";
import { format } from "date-fns";
import { Sun, Moon, Sunset, Coffee } from "lucide-react";

export function WelcomeHeader() {
  const { profile } = useMyProfile();
  const now = new Date();
  const hour = now.getHours();
  
  const getGreeting = () => {
    if (hour >= 5 && hour < 12) return { text: "Good morning", icon: Coffee };
    if (hour >= 12 && hour < 17) return { text: "Good afternoon", icon: Sun };
    if (hour >= 17 && hour < 21) return { text: "Good evening", icon: Sunset };
    return { text: "Good night", icon: Moon };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  
  // Use display_name from profile, extract first name (first word)
  const getFirstName = () => {
    const displayName = profile?.display_name;
    if (displayName) {
      // Get first word/name from display_name
      const firstName = displayName.split(' ')[0];
      return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
    return 'there';
  };

  const firstName = getFirstName();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <GreetingIcon className="h-5 w-5 text-warning animate-pulse" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {greeting.text}, {firstName}
          </h1>
        </div>
        <p className="text-muted-foreground">
          Here's what's happening with your operations today
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border border-border/50">
        <span className="text-sm font-medium">{format(now, 'EEEE')}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-sm text-muted-foreground">{format(now, 'MMM d, yyyy')}</span>
      </div>
    </div>
  );
}
