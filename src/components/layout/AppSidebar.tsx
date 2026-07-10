import { useCompanySettings } from "@/hooks/useCompanySettings";
import React, { useState, useEffect } from "react";
import { BarChart3, Package, Calendar, Shield, Wrench, DollarSign, User, FileText, LogOut, ShoppingCart, Users, UserCog, Activity, Archive, ClipboardList, TrendingUp, ClipboardCheck, Clipboard, MessageSquare, Beaker, ChevronRight, Calculator, Receipt, Sparkles, Lock, FolderKanban, CheckSquare, Bot, ScanText, ArrowLeftRight, FolderArchive, FolderOpen, Rocket, KanbanSquare, GanttChart, Table as TableIcon, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { goToCustomerLogin } from "@/lib/portalHost";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Menu structure following manufacturing workflow
const menuGroups = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3, type: "single" },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, type: "single" },
  { title: "Assistant", url: "/assistant", icon: Sparkles, type: "single" },

  // Sales & customers
  {
    title: "Sales", icon: Users, type: "group",
    items: [
      { title: "Order Management", url: "/order-management", icon: ClipboardCheck },
      { title: "Customer Orders", url: "/orders", icon: ClipboardCheck },
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Inquiries", url: "/inquiries", icon: MessageSquare },
      { title: "Quoting", url: "/quoting", icon: Calculator, requiresFinancialAccess: true },
      { title: "Customer Invoicing", url: "/invoicing", icon: Receipt },
    ]
  },

  // Materials & purchasing
  {
    title: "Materials", icon: Package, type: "group",
    items: [
      { title: "Material Requirements", url: "/material-requirements", icon: ClipboardList },
      { title: "Inventory", url: "/inventory", icon: Package },
      { title: "Receive (Scan)", url: "/receive", icon: ScanText },
      { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart, requiresFinancialAccess: true },
      { title: "Vendors", url: "/supplier", icon: User },
      { title: "Forecasting", url: "/forecasting", icon: TrendingUp },
    ]
  },

  // Production
  {
    title: "Production", icon: Calendar, type: "group",
    items: [
      { title: "Schedule", url: "/production", icon: Calendar },
      { title: "Employee Schedule", url: "/schedule", icon: Users },
      { title: "Formula", url: "/formula", icon: FileText },
      { title: "R&D Projects", url: "/rd-projects", icon: Beaker },
    ]
  },

  // Quality, packaging, shipping
  {
    title: "Fulfillment", icon: Truck, type: "group",
    items: [
      { title: "Quality & Yield", url: "/quality", icon: Shield },
      { title: "Packaging", url: "/packaging", icon: Package },
      { title: "Shipping", url: "/shipping", icon: Truck },
    ]
  },

  // Finance (gated)
  {
    title: "Finance", icon: DollarSign, type: "group", requiresFinancialAccess: true,
    items: [
      { title: "Production Costs", url: "/production-costs", icon: Calculator, requiresFinancialAccess: true },
      { title: "Profitability", url: "/profitability", icon: DollarSign, requiresFinancialAccess: true },
    ]
  },

  // Projects
  {
    title: "Projects", icon: FolderKanban, type: "group",
    items: [
      { title: "All Projects", url: "/projects", icon: FolderOpen },
      { title: "Project Dashboard", url: "/projects/dashboard", icon: BarChart3 },
      { title: "Project Tasks", url: "/projects/tasks", icon: KanbanSquare },
      { title: "Timeline", url: "/projects/timeline", icon: GanttChart },
    ]
  },

  // Documents & reports
  {
    title: "Documents & Reports", icon: FolderArchive, type: "group",
    items: [
      { title: "Documents", url: "/documents", icon: FolderArchive },
      { title: "Reports", url: "/reports", icon: BarChart3 },
      { title: "Supplement Facts", url: "/tools/supplement-facts", icon: FileText },
      { title: "Label Review", url: "/agents/label-review", icon: Bot },
      { title: "Communications", url: "/communications", icon: MessageSquare },
    ]
  },

  // Admin & settings
  {
    title: "Admin", icon: Wrench, type: "group",
    items: [
      { title: "Users", url: "/users", icon: UserCog, adminOnly: true },
      { title: "Activity Tracker", url: "/activity-tracker", icon: Activity, adminOnly: true },
      { title: "Office Supplies", url: "/office-supplies", icon: Clipboard },
      { title: "Maintenance", url: "/maintenance", icon: Wrench },
      { title: "Archived Materials", url: "/archived-materials", icon: Archive },
    ]
  },
];


export function AppSidebar() {
  const { settings: companySettings } = useCompanySettings();
  const companyName = companySettings?.company_name || "ERP.ai";

  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { user, signOut, hasPermission } = useAuth();
  const { canAccessFinancialData } = useUserRoles();
  const { toast } = useToast();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const SIDEBAR_GROUPS_KEY = "pharmvista:sidebar-expanded-groups";
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch { /* ignore */ }
    return new Set(['Dashboard']);
  });

  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";

  // Helper to determine if a group should be open (contains active route)
  const shouldGroupBeOpen = (group: any) => {
    if (group.type === 'single') return false;
    return group.items?.some((item: any) => isActive(item.url));
  };

  // Auto-expand the group containing the active route, merging with persisted set
  useEffect(() => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      menuGroups.forEach(group => {
        if (shouldGroupBeOpen(group)) next.add(group.title);
      });
      return next;
    });
  }, [currentPath]);

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupTitle)) next.delete(groupTitle);
      else next.add(groupTitle);
      try {
        localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  };

  // Fetch profile data
  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setJobTitle(data.job_title || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          job_title: jobTitle,
          full_name: displayName,
        }
      });

      if (authError) throw authError;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          email: user?.email,
          display_name: displayName,
          full_name: displayName,
          job_title: jobTitle,
        });

      if (profileError) throw profileError;

      await fetchProfile(); // Refresh profile data
      setIsProfileOpen(false);

      toast({
        title: "Profile updated!",
        description: "Your profile information has been saved.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={cn("py-6", isCollapsed ? "px-2" : "px-4")}>
          <div className="flex items-center gap-2 justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white font-bold text-sm tracking-tight">ai</span>
                </div>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{companyName} — Manufacturing ERP</p>
                </TooltipContent>
              )}
            </Tooltip>
            {!isCollapsed && (
              <div>
                <h1 className="font-bold text-lg">{companyName}</h1>
                <p className="text-xs text-muted-foreground">Manufacturing ERP</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Main Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuGroups.map((group) => {
                // Check if this group requires financial access
                // ADMIN BYPASS: Admin users always have full access - never locked out
                const isAdmin = hasPermission('admin');
                const isLockedGroup = group.requiresFinancialAccess && !isAdmin && !canAccessFinancialData();

                // Single item (no submenu)
                if (group.type === 'single') {
                  if (isCollapsed) {
                    return (
                      <SidebarMenuItem key={group.title}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild isActive={isActive(group.url!)}>
                              <NavLink to={group.url!} end className="justify-center">
                                <group.icon className="h-4 w-4" />
                              </NavLink>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">{group.title}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={group.title}>
                      <SidebarMenuButton asChild isActive={isActive(group.url!)}>
                        <NavLink to={group.url!} end>
                          <group.icon className="mr-2 h-4 w-4" />
                          <span>{group.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Group with submenu
                const isGroupExpanded = expandedGroups.has(group.title);
                const hasActiveChild = group.items?.some((item: any) => isActive(item.url));
                const visibleItems = group.items?.filter((item: any) => {
                  if (item.adminOnly && !hasPermission('admin')) return false;
                  if (item.requiresFinancialAccess && !canAccessFinancialData()) return false;
                  return true;
                });

                // For locked groups, show with lock icon
                if (isLockedGroup) {
                  return (
                    <div key={group.title} className="space-y-1">
                      <SidebarMenuItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              className={cn("cursor-not-allowed opacity-60", isCollapsed && "justify-center")}
                              disabled
                            >
                              <group.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                              {!isCollapsed && (
                                <>
                                  <span>{group.title}</span>
                                  <Lock className="ml-auto h-4 w-4 text-muted-foreground" />
                                </>
                              )}
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>{group.title} - Access restricted</p>
                          </TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    </div>
                  );
                }

                if (visibleItems?.length === 0) return null;

                // Collapsed state: show icon with tooltip dropdown
                if (isCollapsed) {
                  return (
                    <div key={group.title} className="space-y-1">
                      <SidebarMenuItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              isActive={hasActiveChild}
                              className="justify-center"
                            >
                              <group.icon className="h-4 w-4" />
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="flex flex-col gap-1 p-2">
                            <p className="font-medium mb-1">{group.title}</p>
                            {visibleItems?.map((item: any) => (
                              <NavLink 
                                key={item.title} 
                                to={item.url} 
                                className={cn(
                                  "text-sm px-2 py-1 rounded hover:bg-accent",
                                  isActive(item.url) && "bg-accent font-medium"
                                )}
                              >
                                {item.title}
                              </NavLink>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    </div>
                  );
                }

                // Expanded state: show full group with submenu
                return (
                  <div key={group.title} className="space-y-1">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => toggleGroup(group.title)}
                        isActive={hasActiveChild}
                        className="cursor-pointer"
                      >
                        <group.icon className="mr-2 h-4 w-4" />
                        <span>{group.title}</span>
                        <ChevronRight
                          className={`ml-auto h-4 w-4 transition-transform ${
                            isGroupExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Submenu items */}
                    {isGroupExpanded && (
                      <div className="ml-6 space-y-1">
                        {visibleItems?.map((item: any) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isActive(item.url)} size="sm">
                              <NavLink to={item.url} end>
                                <item.icon className="mr-2 h-3 w-3" />
                                <span className="text-sm">{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Switch to Customer Portal */}
              {isCollapsed ? (
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        className="justify-center"
                        onClick={async () => {
                          await signOut();
                          goToCustomerLogin();
                        }}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">Login to Customer Portal</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={async () => {
                      await signOut();
                      goToCustomerLogin();
                    }}
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    <span>Login to Customer Portal</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <div className={cn("py-4 mt-auto space-y-3", isCollapsed ? "px-2" : "px-4")}>
          {isCollapsed ? (
            <>
              {/* Collapsed: Icon-only profile button */}
              <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <button 
                        className="flex items-center justify-center p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors w-full"
                        onClick={() => {
                          setDisplayName(profile?.display_name || profile?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
                          setJobTitle(profile?.job_title || user?.user_metadata?.job_title || '');
                          setIsProfileOpen(true);
                        }}
                      >
                        <User className="h-4 w-4" />
                      </button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'Profile'}</p>
                  </TooltipContent>
                </Tooltip>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                    <DialogDescription>
                      Update your name and job title.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Read-only)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Full Name</Label>
                      <Input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Enter your job title"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading} className="flex-1">
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsProfileOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              
              {/* Collapsed: Icon-only sign out */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleSignOut}
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              {/* Expanded: Full profile section */}
              <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogTrigger asChild>
                  <button 
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors w-full text-left"
                    onClick={() => {
                      setDisplayName(profile?.display_name || profile?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
                      setJobTitle(profile?.job_title || user?.user_metadata?.job_title || '');
                      setIsProfileOpen(true);
                    }}
                  >
                    <User className="h-4 w-4" />
                    <div className="text-sm">
                      <p className="font-medium truncate">
                        {profile?.display_name || profile?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.job_title || user?.user_metadata?.job_title || 'User'}
                      </p>
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                    <DialogDescription>
                      Update your name and job title.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Read-only)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Full Name</Label>
                      <Input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Enter your job title"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading} className="flex-1">
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsProfileOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
