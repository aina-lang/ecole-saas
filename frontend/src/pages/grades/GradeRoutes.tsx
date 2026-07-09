import { Routes, Route, Navigate } from 'react-router-dom'

export function GradeRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Gestion des notes</div>} />
      <Route path="new" element={<div className="text-muted-foreground">Nouvelle note</div>} />
      <Route path=":id" element={<div className="text-muted-foreground">Détail note</div>} />
      <Route path="*" element={<Navigate to="/grades" replace />} />
    </Routes>
  )
}