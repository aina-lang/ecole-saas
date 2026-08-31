import { printPdf } from '@/lib/print-pdf'
import { fetchAsDataUrl } from '@/lib/school-settings'
import { getSchoolSettings } from '@/lib/school-settings'
import { formatDate } from '@/lib/utils'

interface ReceiptParams {
  payment: {
    receiptNumber?: string | null
    id: string
    feeStructureId?: string | null
    amount: number
    paidAmount: number
    paidAt?: string | null
    dueDate?: string | null
  }
  studentName: string
  className: string
  registrationNumber: string | undefined
  studentPhotoUrl: string | null | undefined
  feeLabel: string | undefined
}

export async function generateReceipt(params: ReceiptParams): Promise<void> {
  const school = await getSchoolSettings()
  const feeLabel = params.feeLabel || 'Frais de scolarité'

  const logoHtml = school.logoDataUrl
    ? `<img src="${school.logoDataUrl}" alt="Logo" style="height:50px;width:50px;object-fit:contain;display:block;margin:0 auto 8px;border-radius:8px" />`
    : ''

  const studentPhotoDataUrl = params.studentPhotoUrl ? await fetchAsDataUrl(params.studentPhotoUrl) : ''
  const studentPhotoHtml = studentPhotoDataUrl
    ? `<img src="${studentPhotoDataUrl}" alt="Photo" style="height:80px;width:80px;object-fit:cover;border-radius:50%;float:right;margin-left:16px;box-shadow:0 2px 8px rgba(0,0,0,0.15)" />`
    : ''

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Reçu de paiement</title>
 <style>
   body{font-family:Arial,sans-serif;margin:40px;color:#333}
   .school-header{ text-align:center; margin-bottom:24px; }
   .school-header h1{ margin:0; font-size:22px; color:#1a365d; }
   .header{text-align:center;margin-bottom:20px}
   .header h2{margin:0;font-size:20px}
   .info{margin-bottom:20px}
   .info table{width:100%;border-collapse:collapse}
   .info td{padding:4px 8px}
   .info td:first-child{font-weight:bold;width:160px}
   .divider{border-top:2px solid #333;margin:20px 0}
   .details{width:100%;border-collapse:collapse;margin-bottom:20px}
   .details th,.details td{border:1px solid #ddd;padding:10px;text-align:left}
   .details th{background:#f5f5f5}
   .total{text-align:right;font-size:18px;font-weight:bold;margin-top:16px}
   .footer{text-align:center;margin-top:40px;color:#999;font-size:12px}
 </style></head><body>
   <div class="school-header">${logoHtml}<h1>${school.schoolName}</h1></div>
   <div class="header">
     <h2>REÇU DE PAIEMENT</h2>
     <p>Année académique ${new Date().getFullYear()}-${new Date().getFullYear() + 1}</p>
   </div>
   ${studentPhotoHtml}
   <div class="divider"></div>
   <div class="info">
     <table>
       <tr><td>Numéro de reçu</td><td>${params.payment.receiptNumber || params.payment.id.slice(0, 8)}</td></tr>
       <tr><td>Date de paiement</td><td>${formatDate(params.payment.paidAt || params.payment.dueDate)}</td></tr>
       <tr><td>Élève</td><td>${params.studentName}</td></tr>
       <tr><td>Classe</td><td>${params.className}</td></tr>
       <tr><td>Matricule</td><td>${params.registrationNumber || 'N/A'}</td></tr>
     </table>
   </div>
   <div class="divider"></div>
   <table class="details">
    <thead><tr><th>Libellé</th><th>Montant</th></tr></thead>
    <tbody><tr><td>${feeLabel}</td><td>${params.payment.amount.toLocaleString()} Ar</td></tr></tbody>
  </table>
  <div class="total">Total payé : ${params.payment.paidAmount.toLocaleString()} Ar</div>
  <div class="footer">
    <p>Reçu généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    <p>${school.schoolName} — Merci de votre confiance</p>
  </div>
</body></html>`

  await printPdf(html, `Reçu ${params.payment.receiptNumber || params.payment.id.slice(0, 8)}.pdf`)
}