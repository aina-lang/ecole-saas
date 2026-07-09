import { Routes, Route, Navigate } from 'react-router-dom'

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Administration</div>} />
      <Route
        path="users"
        element={<div className="text-muted-foreground">Gestion des utilisateurs</div>}
      />
      <Route path="settings" element={<div className="text-muted-foreground">Paramètres</div>} />
      <Route path="*" element={<Navigate to="/administration" replace />} />
    </Routes>
  )
}
