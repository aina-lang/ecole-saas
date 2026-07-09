import { Routes, Route, Navigate } from 'react-router-dom'

export function ClassRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Liste des classes</div>} />
      <Route path="new" element={<div className="text-muted-foreground">Nouvelle classe</div>} />
      <Route path=":id" element={<div className="text-muted-foreground">Détail classe</div>} />
      <Route path="*" element={<Navigate to="/classes" replace />} />
    </Routes>
  )
}