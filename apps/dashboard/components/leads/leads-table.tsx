'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { leadsApi, type Lead } from '@/lib/api';
import { useToast } from '@/components/ui/toaster';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

const STAGE_CONFIG: Record<Lead['stage'], string> = {
  nuevo: 'bg-gray-100 text-gray-700',
  calificado: 'bg-blue-100 text-blue-800',
  convertido: 'bg-green-100 text-green-800',
  perdido: 'bg-red-100 text-red-700',
};

// ─── Inline name editor ───────────────────────────────────────────────────────

function NameCell({
  lead,
  onSave,
}: {
  lead: Lead;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lead.name ?? '');

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (value !== (lead.name ?? '')) onSave(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setEditing(false);
            if (value !== (lead.name ?? '')) onSave(value);
          }
          if (e.key === 'Escape') {
            setValue(lead.name ?? '');
            setEditing(false);
          }
        }}
        className="w-full border border-green-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm text-gray-700 hover:text-gray-900 text-left w-full truncate"
      title="Click para editar"
    >
      {lead.name ?? <span className="text-gray-400 italic">Sin nombre</span>}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100">
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-5 w-16 bg-gray-100 rounded-full" />
          <div className="h-3 w-14 bg-gray-100 rounded" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeadsTable() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page],
    queryFn: () => leadsApi.list(page),
    refetchInterval: 60_000,
  });

  const leads = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: Lead['stage'] }) =>
      leadsApi.update(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['leads', page] });
      const prev = queryClient.getQueryData<typeof data>(['leads', page]);
      queryClient.setQueryData<typeof data>(['leads', page], (old) =>
        old
          ? {
              ...old,
              data: old.data.map((l) => (l.id === id ? { ...l, stage } : l)),
            }
          : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['leads', page], ctx?.prev);
      toast({ title: 'Error al actualizar stage', variant: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', page] });
    },
  });

  const nameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      leadsApi.update(id, { name }),
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ['leads', page] });
      const prev = queryClient.getQueryData<typeof data>(['leads', page]);
      queryClient.setQueryData<typeof data>(['leads', page], (old) =>
        old
          ? {
              ...old,
              data: old.data.map((l) => (l.id === id ? { ...l, name } : l)),
            }
          : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['leads', page], ctx?.prev);
      toast({ title: 'Error al actualizar nombre', variant: 'error' });
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Teléfono
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Intent
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Último contacto
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <Skeleton />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  No hay leads registrados
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-gray-900">{lead.phone_number}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[160px]">
                    <NameCell
                      lead={lead}
                      onSave={(name) => nameMutation.mutate({ id: lead.id, name })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.stage}
                      onChange={(e) =>
                        stageMutation.mutate({
                          id: lead.id,
                          stage: e.target.value as Lead['stage'],
                        })
                      }
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        STAGE_CONFIG[lead.stage]
                      }`}
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="calificado">Calificado</option>
                      <option value="convertido">Convertido</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {lead.intent_detected ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {lead.intent_detected}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {relativeTime(lead.last_contact_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        <span className="text-xs text-gray-500">
          Página {page} de {totalPages}
          {total > 0 && ` · ${total} leads`}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
