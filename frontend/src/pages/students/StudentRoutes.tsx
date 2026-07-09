import { Routes, Route, Navigate } from 'react-router-dom'

export function StudentRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Liste des élèves</div>} />
      <Route path="new" element={<div className="text-muted-foreground">Nouvel élève</div>} />
      <Route path=":id" element={<div className="text-muted-foreground">Détail élève</div>} />
      <Route path="*" element={<Navigate to="/students" replace />} />
    </Routes>
  )
}