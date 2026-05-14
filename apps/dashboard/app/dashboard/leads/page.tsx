import { LeadsTable } from "@/components/leads/leads-table";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-gray-500 text-sm mt-1">Clientes y prospectos captados</p>
      </div>
      <LeadsTable />
    </div>
  );
}
