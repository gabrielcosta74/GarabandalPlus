"use client";

import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import { Heart, Users, FileText, CheckCircle, TrendingUp } from 'lucide-react';

export default function AdminDoacoesPage() {
  return (
    <AdminLayout title="Campanhas e Doações">

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <AdminStatCard
          title="Campanha Atual"
          value="1.830 €"
          subtitle="Objetivo: 2.500 €"
          icon={TrendingUp}
          color="gold"
        />
        <AdminStatCard
          title="Dadores Recorrentes"
          value="34"
          subtitle="Membros ativos"
          icon={Users}
          color="blue"
        />
        <AdminStatCard
          title="Recibos Pendentes"
          value="12"
          subtitle="Por emitir"
          icon={FileText}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Campaign Progress Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-garabandal-gold" /> Progresso da Campanha
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium text-gray-700">
              <span>Progresso (73%)</span>
              <span>1.830 € / 2.500 €</span>
            </div>
            <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-garabandal-gold rounded-full" style={{ width: '73%' }}></div>
            </div>
            <p className="text-sm text-gray-500">
              A campanha atual está a decorrer bem. Faltam 670 € para atingir o objetivo mensal.
            </p>
            <div className="pt-4 flex gap-3">
              <button className="flex-1 py-2 px-4 bg-garabandal-dark text-white font-medium rounded-lg hover:bg-gray-900 transition-colors">
                Ver Detalhes
              </button>
              <button className="flex-1 py-2 px-4 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Editar Meta
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" /> Ações Pendentes
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Emissão de Recibos</p>
                <p className="text-sm text-gray-500">12 recibos por emitir</p>
              </div>
              <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                Gerar Recibos
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Agradecimentos</p>
                <p className="text-sm text-gray-500">Enviar email aos novos dadores</p>
              </div>
              <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                Enviar
              </button>
            </div>
          </div>
        </div>

        {/* Recent Donations List (Mock based on previous file) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-6">Doações Recentes</h2>
          <div className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-gray-400 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="pb-3 pl-2">Dador</th>
                  <th className="pb-3">Data</th>
                  <th className="pb-3 text-right">Valor</th>
                  <th className="pb-3 text-right pr-2">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-2 font-medium text-gray-900">Maria Lopes</td>
                  <td className="py-3 text-gray-500">Hoje</td>
                  <td className="py-3 text-right font-bold text-gray-900">16,50 €</td>
                  <td className="py-3 text-right pr-2">
                    <button className="text-garabandal-gold hover:text-garabandal-dark font-medium text-xs uppercase tracking-wide">
                      Ver Detalhe
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-2 font-medium text-gray-900">Carlos Braga</td>
                  <td className="py-3 text-gray-500">Ontem</td>
                  <td className="py-3 text-right font-bold text-gray-900">25,00 €</td>
                  <td className="py-3 text-right pr-2">
                    <button className="text-garabandal-gold hover:text-garabandal-dark font-medium text-xs uppercase tracking-wide">
                      Ver Detalhe
                    </button>
                  </td>
                </tr>
                {/* Added a few more mock rows for visuals */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-2 font-medium text-gray-900">Ana Sousa</td>
                  <td className="py-3 text-gray-500">Ontem</td>
                  <td className="py-3 text-right font-bold text-gray-900">50,00 €</td>
                  <td className="py-3 text-right pr-2">
                    <button className="text-garabandal-gold hover:text-garabandal-dark font-medium text-xs uppercase tracking-wide">
                      Ver Detalhe
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
