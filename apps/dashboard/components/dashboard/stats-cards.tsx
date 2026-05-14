export function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {['Leads totales', 'Mensajes hoy', 'Conversaciones activas'].map((label) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">—</p>
        </div>
      ))}
    </div>
  );
}
