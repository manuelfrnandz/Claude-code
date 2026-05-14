import { ConversationList } from '@/components/chat/conversation-list';
import { MessageSquare } from 'lucide-react';

export default function ConversationsPage() {
  return (
    <div
      className="flex border border-gray-200 rounded-xl overflow-hidden bg-white"
      style={{ height: 'calc(100vh - 7rem)' }}
    >
      <ConversationList selectedId={null} />
      <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-3 text-gray-400">
        <MessageSquare className="w-10 h-10 text-gray-200" />
        <p className="text-sm">Selecciona una conversación</p>
      </div>
    </div>
  );
}
