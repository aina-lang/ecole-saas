import { Routes, Route, Navigate } from 'react-router-dom'

export function FinanceRoutes() {
  return (
    <Routes>
      <Route index element={<div className="text-muted-foreground">Gestion financière</div>} />
      <Route path="new" element={<div className="text-muted-foreground">Nouveau paiement</div>} />
      <Route path=":id" element={<div className="text-muted-foreground">Détail transaction</div>} />
      <Route path="*" element={<Navigate to="/finances" replace />} />
    </Routes>
  )
}