'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, MessageSquare, Activity } from 'lucide-react';
import { statsApi } from '@/lib/api';

interface StatsData {
  totalLeads: number;
  messagesToday: number;
  activeConversations: number;
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
  isLoading,
}: {
  label: string;
  value: number | undefined;
  description: string;
  icon: React.ElementType;
  iconClass: string;
  isLoading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {isLoading ? (
          <div className="mt-1 h-8 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">
            {value ?? '—'}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function StatsCards() {
  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        label="Leads totales"
        value={data?.totalLeads}
        description="Prospectos capturados"
        icon={Users}
        iconClass="bg-blue-50 text-blue-600"
        isLoading={isLoading}
      />
      <StatCard
        label="Mensajes hoy"
        value={data?.messagesToday}
        description="Desde medianoche"
        icon={MessageSquare}
        iconClass="bg-green-50 text-green-600"
        isLoading={isLoading}
      />
      <StatCard
        label="Conversaciones activas"
        value={data?.activeConversations}
        description="Estado: active"
        icon={Activity}
        iconClass="bg-purple-50 text-purple-600"
        isLoading={isLoading}
      />
    </div>
  );
}
