import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamContactListProps {
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export const TeamContactList = ({ selectedUserId, onSelectUser }: TeamContactListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: teamMembers, isLoading } = useTeamMembers();

  const filteredMembers = teamMembers?.filter(member =>
    member.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect with your colleagues at PharmVista
        </p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Contact List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredMembers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No team members found
            </div>
          ) : (
            filteredMembers?.map((member) => (
              <button
                key={member.id}
                onClick={() => onSelectUser(member.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-accent ${
                  selectedUserId === member.id ? 'bg-accent' : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getInitials(member.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm truncate">
                    {member.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {member.job_title}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
