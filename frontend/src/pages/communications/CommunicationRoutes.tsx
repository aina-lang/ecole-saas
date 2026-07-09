import { Routes, Route, Navigate } from 'react-router-dom'
import { InboxPage } from './InboxPage'
import { ComposeMessagePage } from './ComposeMessagePage'
import { MessageDetailPage } from './MessageDetailPage'

export function CommunicationRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/communications/inbox" replace />} />
      <Route path="inbox" element={<InboxPage />} />
      <Route path="sent" element={<InboxPage />} />
      <Route path="drafts" element={<InboxPage />} />
      <Route path="archived" element={<InboxPage />} />
      <Route path="compose" element={<ComposeMessagePage />} />
      <Route path=":id" element={<MessageDetailPage />} />
      <Route path="*" element={<Navigate to="/communications/inbox" replace />} />
    </Routes>
  )
}
