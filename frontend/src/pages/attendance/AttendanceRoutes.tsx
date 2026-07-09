import { Routes, Route, Navigate } from 'react-router-dom'

export function AttendanceRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Gestion des présences</div>} />
      <Route path="new" element={<div className="text-muted-foreground">Nouvel appel</div>} />
      <Route path=":id" element={<div className="text-muted-foreground">Détail présence</div>} />
      <Route path="*" element={<Navigate to="/attendance" replace />} />
    </Routes>
  )
}