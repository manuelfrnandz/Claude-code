import { StatsCards } from "@/components/dashboard/stats-cards";
import { OrdersKanban } from "@/components/orders/orders-kanban";
import { RecentConversations } from "@/components/chat/recent-conversations";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen de actividad de hoy</p>
      </div>
      <StatsCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrdersKanban />
        <RecentConversations />
      </div>
    </div>
  );
}
