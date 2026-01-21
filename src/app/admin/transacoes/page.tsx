"use client";

import AdminLayout from '../../../components/admin/AdminLayout';
import TransactionsUnifiedManager from '../../../components/admin/TransactionsUnifiedManager';

export default function AdminTransacoesPage() {
  return (
    <AdminLayout title="Gestão Financeira Unificada">
      <TransactionsUnifiedManager />
    </AdminLayout>
  );
}
