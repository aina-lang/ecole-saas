import { Routes, Route, Navigate } from 'react-router-dom'
import { PromotionsPage } from './PromotionsPage'

export function PromotionRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/administration/promotion/deliberation" replace />} />
      <Route path="deliberation" element={<PromotionsPage defaultTab="deliberation" />} />
      <Route path="rollover" element={<PromotionsPage defaultTab="rollover" />} />
      <Route path="reinscription" element={<PromotionsPage defaultTab="reinscription" />} />
      <Route path="dispatch" element={<PromotionsPage defaultTab="dispatch" />} />
      <Route path="*" element={<Navigate to="/administration/promotion/deliberation" replace />} />
    </Routes>
  )
}
