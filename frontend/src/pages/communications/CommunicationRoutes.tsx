import { Routes, Route, Navigate } from 'react-router-dom'

export function CommunicationRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Communications</div>} />
      <Route path="new" element={<div className="text-muted-foreground">Nouveau message</div>} />
      <Route path=":id" element={<div className="text-muted-foreground">Détail message</div>} />
      <Route path="*" element={<Navigate to="/communications" replace />} />
    </Routes>
  )
}