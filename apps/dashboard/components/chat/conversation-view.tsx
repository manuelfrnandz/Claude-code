'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi, type ConversationItem } from '@/lib/api';
import { useToast } from '@/components/ui/toaster';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MODE_CONFIG: Record<
  ConversationItem['mode'],
  { label: string; badgeClass: string }
> = {
  ai: { label: 'Bot activo', badgeClass: 'bg-green-100 text-green-800' },
  human: { label: 'Handoff', badgeClass: 'bg-orange-100 text-orange-800' },
  hybrid: { label: 'Supervisado', badgeClass: 'bg-blue-100 text-blue-800' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ConversationView({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conv, isLoading: convLoading } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationsApi.get(conversationId),
  });

  const { data: msgData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => conversationsApi.messages(conversationId),
    refetchInterval: 5_000,
  });

  const messages = msgData?.data ?? [];

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const modeMutation = useMutation({
    mutationFn: (newMode: 'ai' | 'human') =>
      conversationsApi.setMode(conversationId, newMode),
    onMutate: async (newMode) => {
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      const prev = queryClient.getQueryData<ConversationItem>(['conversation', conversationId]);
      queryClient.setQueryData<ConversationItem>(
        ['conversation', conversationId],
        (old) => (old ? { ...old, mode: newMode } : old),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['conversation', conversationId], ctx?.prev);
      toast({ title: 'Error al cambiar el modo', variant: 'error' });
    },
    onSuccess: (_data, newMode) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({
        title: newMode === 'human' ? 'Control tomado' : 'Bot reactivado',
      });
    },
  });

  const mode = conv?.mode ?? 'ai';
  const modeConfig = MODE_CONFIG[mode];

  if (convLoading || msgsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Conversación no encontrada
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gray-900">{conv.phone}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${modeConfig.badgeClass}`}
          >
            {modeConfig.label}
          </span>
        </div>
        <div>
          {(mode === 'ai' || mode === 'hybrid') && (
            <button
              onClick={() => modeMutation.mutate('human')}
              disabled={modeMutation.isPending}
              className="px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Tomar control
            </button>
          )}
          {mode === 'human' && (
            <button
              onClick={() => modeMutation.mutate('ai')}
              disabled={modeMutation.isPending}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Devolver al bot
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">
            Sin mensajes
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBot ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 text-sm text-gray-800 shadow-sm ${
                    isBot
                      ? 'bg-[#dcfce7] rounded-t-2xl rounded-bl-2xl rounded-br-sm'
                      : 'bg-white border border-gray-200 rounded-t-2xl rounded-br-2xl rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
