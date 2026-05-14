'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { conversationsApi, type ConversationItem } from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const MODE_CONFIG: Record<
  ConversationItem['mode'],
  { label: string; className: string }
> = {
  ai: { label: 'Bot activo', className: 'bg-green-100 text-green-800' },
  human: { label: 'Handoff', className: 'bg-orange-100 text-orange-800' },
  hybrid: { label: 'Supervisado', className: 'bg-blue-100 text-blue-800' },
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-px">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-gray-100">
          <div className="flex justify-between mb-2">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            <div className="h-3 w-12 bg-gray-100 rounded" />
          </div>
          <div className="h-3 w-16 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConversationList({
  selectedId,
}: {
  selectedId?: string | null;
}) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationsApi.list(),
    refetchInterval: 30_000,
  });

  const conversations = data?.data ?? [];
  const filtered = search
    ? conversations.filter((c) =>
        c.phone.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  return (
    <div className="w-full md:w-80 md:shrink-0 flex flex-col border-r border-gray-200">
      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por teléfono…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <Skeleton />
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            {search ? 'Sin resultados' : 'No hay conversaciones'}
          </div>
        ) : (
          filtered.map((conv) => {
            const mode = MODE_CONFIG[conv.mode];
            const isSelected = conv.id === selectedId;

            return (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className={`block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-green-50 border-l-[3px] border-l-green-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-gray-900 font-medium truncate">
                    {conv.phone}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {relativeTime(conv.started_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${mode.className}`}
                  >
                    {mode.label}
                  </span>
                  {conv.primary_intent && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                      {conv.primary_intent}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
