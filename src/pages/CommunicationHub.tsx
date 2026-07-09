import { useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TeamContactList } from '@/components/communications/TeamContactList';
import { DirectMessageChat } from '@/components/communications/DirectMessageChat';

const CommunicationHub = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex h-screen overflow-hidden bg-card">
          <TeamContactList
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
          />
          <DirectMessageChat selectedUserId={selectedUserId} />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default CommunicationHub;
