import { OrdersTable } from "@/components/orders/orders-table";
import { OrdersSummaryBar } from "@/components/orders/orders-summary-bar";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
        <p className="text-gray-500 text-sm mt-1">Pedidos tomados por el agente</p>
      </div>
      <OrdersSummaryBar />
      <OrdersTable />
    </div>
  );
}
