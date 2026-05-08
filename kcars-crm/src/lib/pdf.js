import jsPDF from 'jspdf'
import 'jspdf-autotable'

const GARAGE = {
  name: import.meta.env.VITE_GARAGE_NAME || 'K-Cars Garage',
  address: import.meta.env.VITE_GARAGE_ADDRESS || 'Singapore',
  phone: import.meta.env.VITE_GARAGE_PHONE || '',
  gst: import.meta.env.VITE_GARAGE_GST || 'No',
}

const statusLabel = {
  draft:     { en: 'DRAFT',     zh: '草稿' },
  confirmed: { en: 'CONFIRMED', zh: '已确认' },
  paid:      { en: 'PAID',      zh: '已付款' },
}

export function generateInvoicePDF(invoice, customer, items, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16
  let y = M

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(17, 17, 17)
  doc.rect(0, 0, W, 36, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18).setFont('helvetica', 'bold')
  doc.text(GARAGE.name, M, 14)

  doc.setFontSize(8).setFont('helvetica', 'normal')
  doc.text(GARAGE.address, M, 20)
  if (GARAGE.phone) doc.text(`Tel: ${GARAGE.phone}`, M, 25)
  if (GARAGE.gst && GARAGE.gst !== 'No') doc.text(`GST Reg: ${GARAGE.gst}`, M, 30)

  // Invoice / 发票 label
  doc.setFontSize(22).setFont('helvetica', 'bold')
  doc.setTextColor(216, 90, 48)
  doc.text('INVOICE', W - M, 14, { align: 'right' })
  doc.setFontSize(10).setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.text('发票', W - M, 21, { align: 'right' })

  y = 44

  // ── Invoice meta box ────────────────────────────────
  doc.setDrawColor(230, 230, 230)
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(M, y, W - M * 2, 28, 2, 2, 'FD')

  doc.setTextColor(100, 100, 100)
  doc.setFontSize(8).setFont('helvetica', 'normal')

  const col1 = M + 4, col2 = W / 2 + 4

  // Left col
  doc.text('Invoice No. / 发票号码', col1, y + 6)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30, 30, 30)
  doc.text(invoice.invoice_no || '—', col1, y + 12)

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100)
  doc.text('Date / 日期', col1, y + 18)
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30)
  doc.text(invoice.date || '—', col1, y + 24)

  // Right col
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100)
  doc.text('Technician / 技师', col2, y + 6)
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30)
  doc.text(invoice.technician || '—', col2, y + 12)

  const st = statusLabel[invoice.status] || statusLabel.draft
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100)
  doc.text('Status / 状态', col2, y + 18)
  const stColor = invoice.status === 'paid' ? [26, 127, 55] : invoice.status === 'confirmed' ? [24, 95, 165] : [150, 50, 50]
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...stColor)
  doc.text(`${st.en} ${st.zh}`, col2, y + 24)

  y += 34

  // ── Customer box ─────────────────────────────────────
  doc.setFillColor(240, 240, 240)
  doc.roundedRect(M, y, W - M * 2, 22, 2, 2, 'F')

  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(120)
  doc.text('Customer / 客户', col1, y + 6)
  doc.setFontSize(12).setTextColor(20)
  doc.text(customer.name || '—', col1, y + 13)

  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120)
  doc.text(`Car Plate 车牌: `, col1, y + 19)
  doc.setFont('helvetica', 'bold').setTextColor(216, 90, 48)
  doc.text(customer.car_plate || '—', col1 + 24, y + 19)

  doc.setFont('helvetica', 'normal').setTextColor(120)
  doc.text(`${customer.car_make || ''} ${customer.car_model || ''}`.trim(), col2, y + 13)
  if (customer.phone) doc.text(`Tel: ${customer.phone}`, col2, y + 19)

  y += 28

  // ── Items table ──────────────────────────────────────
  const tableItems = (items || []).map((it, i) => [
    i + 1,
    it.description,
    it.category || '',
    parseFloat(it.qty || 1).toFixed(0),
    `$${parseFloat(it.unit_price || 0).toFixed(2)}`,
    `$${parseFloat(it.amount || 0).toFixed(2)}`,
  ])

  doc.autoTable({
    startY: y,
    head: [[
      '#', 'Description / 描述', 'Category / 类别',
      'Qty\n数量', 'Unit Price\n单价', 'Amount\n金额'
    ]],
    body: tableItems,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 30, 30], textColor: 255,
      fontStyle: 'bold', fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 35 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── Totals ───────────────────────────────────────────
  const subtotal = parseFloat(invoice.subtotal || 0)
  const discount = parseFloat(invoice.discount || 0)
  const total = parseFloat(invoice.total || 0)

  const totX = W - M - 70, valX = W - M

  doc.setDrawColor(230)
  doc.line(totX, y, W - M, y)
  y += 5

  const row = (label, val, bold = false, color = [30, 30, 30]) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setTextColor(120)
    doc.text(label, totX, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setTextColor(...color)
    doc.text(val, valX, y, { align: 'right' })
    y += 6
  }

  row('Subtotal / 小计', `$${subtotal.toFixed(2)}`)
  if (discount > 0) row('Discount / 折扣', `-$${discount.toFixed(2)}`, false, [220, 50, 50])

  doc.setDrawColor(180)
  doc.line(totX, y - 1, W - M, y - 1)
  doc.setFillColor(17, 17, 17)
  doc.rect(totX - 2, y, W - M - totX + 2, 10, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255)
  doc.text('TOTAL / 总计', totX, y + 7)
  doc.setTextColor(216, 90, 48)
  doc.text(`SGD $${total.toFixed(2)}`, valX, y + 7, { align: 'right' })
  y += 16

  // ── Notes ────────────────────────────────────────────
  if (invoice.notes) {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120)
    doc.text('Notes / 备注:', M, y)
    doc.setTextColor(50)
    doc.text(invoice.notes, M, y + 5, { maxWidth: W - M * 2 })
    y += 14
  }

  // ── Footer ───────────────────────────────────────────
  doc.setFillColor(245, 245, 245)
  doc.rect(0, 280, W, 17, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150)
  doc.text('Thank you for your business! 感谢您的惠顾！', W / 2, 287, { align: 'center' })
  doc.text(`Generated by ${GARAGE.name} CRM`, W / 2, 292, { align: 'center' })

  return doc
}

export function printInvoice(invoice, customer, items) {
  const doc = generateInvoicePDF(invoice, customer, items)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

export function downloadInvoice(invoice, customer, items) {
  const doc = generateInvoicePDF(invoice, customer, items)
  doc.save(`${invoice.invoice_no || 'invoice'}.pdf`)
}
