"use client";

import AdminLayout from '../../../components/admin/AdminLayout';
import { Settings, CreditCard, Webhook, Shield, ChevronRight } from 'lucide-react';

export default function AdminConfiguracoesPage() {
  return (
    <AdminLayout title="Configurações do Sistema">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Payments Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Pagamentos</h3>
          <p className="text-sm text-gray-500 mb-4">Moeda EUR, métodos ativos (Stripe, Reduniq) e configurações de checkout.</p>
          <div className="flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
            Gerir Regras <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* Webhooks Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Webhook className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Webhooks</h3>
          <p className="text-sm text-gray-500 mb-4">Gerir endpoints para notificações em tempo real (3 ativos).</p>
          <div className="flex items-center text-sm font-medium text-purple-600 group-hover:text-purple-700">
            Ver Logs <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* Environment Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Ambientes</h3>
          <p className="text-sm text-gray-500 mb-4">Configuração de chaves de API para Produção e Sandbox.</p>
          <div className="flex items-center text-sm font-medium text-green-600 group-hover:text-green-700">
            Gerir Chaves <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
