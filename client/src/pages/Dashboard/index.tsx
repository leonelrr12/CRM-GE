import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, UserPlus, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import type { DashboardStats } from '../../types';
import { STATUSES } from '../../types';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then((res) => {
      setStats(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-600', bg: 'bg-brand/10' },
    { label: 'Nuevos esta semana', value: stats.newThisWeek, icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Tasa de conversión', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Crecimiento', value: `${stats.growthPercent}%`, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const statusData = stats.byStatus.map((s) => {
    const status = STATUSES.find((st) => st.value === s.status);
    return { name: status?.label || s.status, value: s.count, color: status?.color || '' };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${bg}`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads por fuente</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.bySource.map((s) => ({ name: s.source === 'web' ? 'Web' : s.source === 'ig_ads' ? 'IG Ads' : s.source, count: s.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads por estado</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">Fuente</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLeads.map((lead) => {
                const status = STATUSES.find((s) => s.value === lead.status);
                return (
                  <tr key={lead.id} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-900">{lead.name}</td>
                    <td className="py-2.5 text-gray-500">{lead.source === 'web' ? 'Web' : lead.source === 'ig_ads' ? 'IG Ads' : lead.source}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status?.color}`}>
                        {status?.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500">{new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5">
                      <Link to={`/leads/${lead.id}`} className="text-blue-600 hover:underline text-xs">Ver</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
