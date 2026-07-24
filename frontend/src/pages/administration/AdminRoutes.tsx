import { Routes, Route, Navigate } from 'react-router-dom'
import { UserManagementPage } from './UserManagementPage'
import { UserFormPage } from './UserFormPage'
import { SettingsPage } from './SettingsPage'
import { AuditLogPage } from './AuditLogPage'
import { LevelsPage } from './LevelsPage'
import { BillingPage } from './BillingPage'
import { PromotionRoutes } from './PromotionRoutes'

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/administration/users" replace />} />
      <Route path="users" element={<UserManagementPage />} />
      <Route path="users/new" element={<UserFormPage />} />
      <Route path="users/:id/edit" element={<UserFormPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="levels" element={<LevelsPage />} />
      <Route path="billing" element={<BillingPage />} />
      {/* Configuration des notes déplacée dans /grades (onglet "Configuration") */}
      <Route path="audit" element={<AuditLogPage />} />
      <Route path="promotion/*" element={<PromotionRoutes />} />
      <Route path="*" element={<Navigate to="/administration/users" replace />} />
    </Routes>
  )
}
