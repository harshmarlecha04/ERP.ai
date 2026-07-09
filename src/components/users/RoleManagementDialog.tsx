import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, Plus, Minus } from 'lucide-react';
import { useRoleManagement } from '@/hooks/useRoleManagement';

type AppRole = 'admin' | 'rd_manager' | 'production_manager' | 'quality_manager' | 'user' | 'hr_manager';

const AVAILABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'rd_manager', label: 'R&D Manager' },
  { value: 'production_manager', label: 'Production Manager' },
  { value: 'quality_manager', label: 'Quality Manager' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'user', label: 'User' }
];

interface RoleManagementDialogProps {
  onUserUpdated?: () => void;
}

export const RoleManagementDialog: React.FC<RoleManagementDialogProps> = ({ onUserUpdated }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const { updateUserRole, getUserByEmail, loading } = useRoleManagement();

  const handleSearch = async () => {
    if (!email.trim()) return;
    
    setSearchLoading(true);
    const user = await getUserByEmail(email.trim());
    setCurrentUser(user);
    setSearchLoading(false);
  };

  const handleRoleToggle = async (role: AppRole, hasRole: boolean) => {
    if (!currentUser) return;
    
    const success = await updateUserRole(currentUser.email, role, !hasRole);
    if (success.success) {
      // Refresh user data
      const updatedUser = await getUserByEmail(currentUser.email);
      setCurrentUser(updatedUser);
      onUserUpdated?.();
    }
  };

  const hasRole = (role: string) => {
    return currentUser?.roles?.includes(role) || false;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Manage Roles
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage User Roles</DialogTitle>
          <DialogDescription>
            Search for a user by email and manage their roles.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={searchLoading || !email.trim()}
              className="mt-6"
            >
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {currentUser && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h4 className="font-medium">{currentUser.display_name}</h4>
                <p className="text-sm text-muted-foreground">{currentUser.email}</p>
              </div>
              
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="grid gap-2">
                  {AVAILABLE_ROLES.map((role) => {
                    const userHasRole = hasRole(role.value);
                    return (
                      <div key={role.value} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{role.label}</span>
                          {userHasRole && <Badge variant="secondary">Active</Badge>}
                        </div>
                        <Button
                          variant={userHasRole ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleRoleToggle(role.value, userHasRole)}
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : userHasRole ? (
                            <>
                              <Minus className="h-4 w-4 mr-1" />
                              Remove
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Grant
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {email && !currentUser && !searchLoading && (
            <p className="text-sm text-muted-foreground">User not found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};