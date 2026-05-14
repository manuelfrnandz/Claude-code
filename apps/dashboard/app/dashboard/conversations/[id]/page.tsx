import { ConversationList } from '@/components/chat/conversation-list';
import { ConversationView } from '@/components/chat/conversation-view';

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div
      className="flex border border-gray-200 rounded-xl overflow-hidden bg-white"
      style={{ height: 'calc(100vh - 7rem)' }}
    >
      <ConversationList selectedId={id} />
      <ConversationView conversationId={id} />
    </div>
  );
}
