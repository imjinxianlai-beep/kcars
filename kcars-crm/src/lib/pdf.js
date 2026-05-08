import jsPDF from 'jspdf'
import 'jspdf-autotable'
import QRCode from 'qrcode'

const CO = {
  kc: {
    name:    'K-CARS AUTO CENTRE PTE LTD',
    addr:    '1 Kaki Bukit Road 1,#04-31 Enterprise One, Singapore 415934',
    tel:     'Tel: 6289 1111                    Fax: 6281 5008',
    reg:     'Co. Reg No. : 201104963M',
    bank:    'OCBC A/C 687-699-181-001',
    paynow:  '201104963MP01',
    hasLogo: true,
    totalLabel: 'Total',
    notes: [
      'Notes :',
      '1. Goods sold are not Refundable / Returnable.',
      '2. Price Inclusive of Trade In.',
      '3. Payment Mode :',
      '   A:- Cheque.:  K-CARS AUTO CENTRE PTE LTD',
      '   B:- Bank Tranfer.:  OCBC A/C 687-699-181-001',
      '   C:- PayNow.:  UEN 201104963MP01',
      '   *Please send the Payment Advice via Whatsapp to',
      '    +65-8787 5151 after tranfer done.',
    ],
  },
  onew: {
    name:    '1 WORLD AUTO EXPORT PTE LTD',
    addr:    '1 Kaki Bukit Road 1,#04-31 Enterprise One, Singapore 415934',
    tel:     'Tel: 6482 1855 (Sales) 6289 1111 (General) Fax: 6281 5008',
    reg:     'Co. Reg No.: 201106739D',
    bank:    'OCBC A/C 601-350481-001',
    paynow:  '201106739D',
    hasLogo: false,
    totalLabel: 'Sub Total',
    notes: [
      '1 WORLD AUTO EXPORT PTE LTD',
      'Notes :',
      '1. Goods sold are not Refundable / Returnable.',
      '2. Payment Mode :',
      '   A:- Cheque.: ',
      '   B:- Bank Tranfer.:  OCBC A/C 601-350481-001',
      '   C:- PayNow.:  UEN 201106739D',
      '   *Please send the Payment Advice via Whatsapp to',
      '    +65-8787 5151 after tranfer done.',
    ],
  },
}

const GEARBOX_WARRANTY = `Gearbox warranty:
1)All of gearboxes comes with 6 months warranty or 20,000km , whichever comes first.
2)Compulsory 1 month after repair complimentary check.
3)Price Inclusive of Trade in.

Warranty does not cover:
1) Damage caused by misuse, negligence, or accident including.
2) Loss of time and/or earnings from loss of use, rental, commercial loss, towing charges, person injuries, or any other incidental or consequential damages.
3) Other mechanical parts failure causing transmission failure.
4) Any ECU/TCM related parts.
5) 4WD or Differential.`

export function detectInvoiceType(items = []) {
  const descs = items.map(i => (i.description || i.desc || '').toLowerCase())
  const isGearbox = descs.some(d =>
    d.includes('gearbox') || d.includes('transmission') || d.includes('gear box') || d.includes('auto transmission')
  )
  const isEngine = descs.some(d => d.includes('engine overhaul') || d.includes('engine rebuild'))
  if (isGearbox) return 'kc_gearbox'
  if (isEngine)  return 'kc_engine'
  return 'onew'
}

function toWords(n) {
  const ones = ['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN']
  const tens = ['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY']
  function b1000(n) {
    if (n===0) return ''
    if (n<20) return ones[n]+' '
    if (n<100) return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'')+ ' '
    return ones[Math.floor(n/100)]+' HUNDRED '+b1000(n%100)
  }
  const d = Math.floor(Math.abs(n))
  const c = Math.round((Math.abs(n)-d)*100)
  if (d===0&&c===0) return 'SINGAPORE DOLLAR ZERO ONLY'
  let r = d>=1000 ? b1000(Math.floor(d/1000))+'THOUSAND ' : ''
  r += b1000(d%1000)
  r = r.trim()
  if (c>0) r += ' AND CENTS '+b1000(c).trim()
  return 'SINGAPORE DOLLAR '+r.trim()+' ONLY'
}

function getTech(invoice) {
  // Support both old format (technician field) and new format (advisor + mechanic)
  const adv = invoice.advisor  || (invoice.technician||'').split(',')[0]?.trim() || ''
  const mec = invoice.mechanic || (invoice.technician||'').split(',').slice(1).join(',').trim() || ''
  return { adv, mec }
}

export async function generateInvoicePDF(invoice, customer, items, invoiceType) {
  const type = invoiceType || detectInvoiceType(items)
  const co   = type.startsWith('kc') ? CO.kc : CO.onew
  const showWarranty = type === 'kc_gearbox'

  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const W=210, M=14
  let y = 10

  // ── HEADER ─────────────────────────────────────────────────────────
  if (co.hasLogo) {
    try {
      const imgEl = document.querySelector('img[alt="K-Cars Auto Centre"]')
      if (imgEl) {
        const cv = document.createElement('canvas')
        cv.width = imgEl.naturalWidth; cv.height = imgEl.naturalHeight
        cv.getContext('2d').drawImage(imgEl, 0, 0)
        doc.addImage(cv.toDataURL('image/png'), 'PNG', M, y+1, 34, 17)
      }
    } catch(e) {}
    // Company name - bold italic large, right of logo
    doc.setFont('helvetica','bolditalic').setFontSize(17).setTextColor(20)
    doc.text(co.name, M+37, y+7)
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(50)
    doc.text(co.addr, M+37, y+12)
    doc.text(co.tel, M+37, y+17)
    doc.text(co.reg, M+37, y+22)
    y += 28
  } else {
    // 1 World: no logo, text centered
    doc.setFont('helvetica','bold').setFontSize(12).setTextColor(20)
    doc.text(co.name, W/2, y+5, {align:'center'})
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(50)
    doc.text(co.addr, W/2, y+10, {align:'center'})
    doc.text(co.tel, W/2, y+14, {align:'center'})
    doc.text(co.reg, W/2, y+18, {align:'center'})
    y += 24
  }

  // Divider
  doc.setDrawColor(100).setLineWidth(0.5)
  doc.line(M, y, W-M, y)
  y += 4

  // ── INVOICE title + No. ───────────────────────────────────────────
  doc.setFont('helvetica','bold').setFontSize(14).setTextColor(20)
  doc.text('INVOICE', W/2, y+5, {align:'center'})
  doc.setFontSize(9.5)
  doc.text('No.  :  '+(invoice.invoice_no||''), W-M, y+5, {align:'right'})
  y += 9

  // ── CUSTOMER (left) + VEHICLE INFO (right) ────────────────────────
  const boxW=85, lh=6.2
  const rightX = M+boxW+4, valX = rightX+25

  // 4 left boxes
  const { adv, mec } = getTech(invoice)
  const boxTexts = [customer.name||'', customer.phone||'', '', '']
  for (let i=0; i<4; i++) {
    doc.setDrawColor(130).setLineWidth(0.25)
    doc.rect(M, y+i*lh, boxW, lh)
    doc.setFont('helvetica', i===0?'bold':'normal')
    doc.setFontSize(i===0?9.5:8.5).setTextColor(20)
    if (boxTexts[i]) doc.text(boxTexts[i], M+2, y+i*lh+4.3)
  }
  // Advisor/Mechanic row
  doc.setFont('helvetica','bold').setFontSize(8.5).setTextColor(20)
  doc.text('Advisor  : '+adv,  M+2,  y+3*lh+4.3)
  doc.text('Mechanic  : '+mec, M+46, y+3*lh+4.3)

  // 7 right vehicle info rows
  const vRows = [
    ['Date',        invoice.date||''],
    ['Vehicle No.', customer.car_plate||''],
    ['Model',       ((customer.car_make||'')+' '+(customer.car_model||'')).trim()],
    ['Chassis No.', invoice.chassis_no||''],
    ['Engine No',   invoice.engine_no||''],
    ['Mileage',     invoice.mileage ? invoice.mileage+'KM' : ''],
    ['COE Expire',  invoice.coe_expire||''],
  ]
  vRows.forEach(([label,val],i) => {
    const ry = y + i*lh
    doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(60)
    doc.text(label, rightX, ry+4.3)
    doc.text(':', rightX+22, ry+4.3)
    doc.setFont('helvetica','bold').setTextColor(20)
    doc.text(String(val), valX, ry+4.3)
  })

  // Advance y by the TALLER of the two sections (vehicle info = 7 rows)
  y += Math.max(4*lh, 7*lh) + 2

  // ── ITEMS TABLE ───────────────────────────────────────────────────
  const tableBody = (items||[]).map((it,i) => [
    i+1,
    it.description||it.desc||'',
    String(parseFloat(it.qty||1)),
    it.remarks||'',
    parseFloat(it.unit_price??it.cost??0).toFixed(2),
    parseFloat(it.amount??it.cost??0).toFixed(2),
  ])

  doc.autoTable({
    startY: y,
    head: [['Item','Description','Qty','Remarks','U/ Price\nS$','Total\nS$']],
    body: tableBody,
    margin: {left:M, right:M},
    styles: {fontSize:8.5, cellPadding:{top:2.5,bottom:2.5,left:2,right:2}, textColor:[20,20,20], lineColor:[150,150,150], lineWidth:0.25},
    headStyles: {fillColor:[255,255,255], textColor:[20,20,20], fontStyle:'normal', fontSize:8.5, lineColor:[150,150,150], lineWidth:0.25},
    columnStyles: {
      0:{cellWidth:12, halign:'center'},
      1:{cellWidth:66},
      2:{cellWidth:10, halign:'center'},
      3:{cellWidth:44},
      4:{cellWidth:25, halign:'right'},
      5:{cellWidth:25, halign:'right'},
    },
    tableLineColor:[150,150,150], tableLineWidth:0.25,
  })

  y = doc.lastAutoTable.finalY + 5

  // ── WARRANTY / NOTES ──────────────────────────────────────────────
  const remarkParts = []
  if (showWarranty) remarkParts.push(GEARBOX_WARRANTY)
  if (invoice.notes) remarkParts.push(invoice.notes)
  if (remarkParts.length) {
    doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(50)
    const lines = doc.splitTextToSize(remarkParts.join('\n\n'), W-M*2)
    doc.text(lines, M, y)
    y += lines.length*3.5+5
  }

  // ── TOTAL ─────────────────────────────────────────────────────────
  const total = parseFloat(invoice.total||0)
  doc.setDrawColor(120).setLineWidth(0.3)
  doc.line(M, y, W-M, y)
  y += 4

  doc.setFont('helvetica','normal').setFontSize(8).setTextColor(30)
  doc.text(toWords(total), M, y+4)

  doc.setFont('helvetica','bold').setFontSize(9).setTextColor(20)
  doc.text(co.totalLabel, W-M-28, y+4)
  doc.setDrawColor(120).setLineWidth(0.3)
  doc.rect(W-M-20, y, 20, 7)
  doc.setFontSize(9.5)
  doc.text(total.toFixed(2), W-M-1, y+5.3, {align:'right'})
  y += 12

  // ── PAYMENT NOTES + QR CODE ───────────────────────────────────────
  doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(50)

  // Bold the company-specific parts in notes
  const notesY = y
  co.notes.forEach((line, i) => {
    const isBold = line.includes('K-CARS') || line.includes('1 WORLD') || 
                   line.includes('687-699') || line.includes('601-350') ||
                   line.includes('201104963MP01') || line.includes('201106739D')
    doc.setFont('helvetica', isBold ? 'bold' : 'normal').setFontSize(7.5).setTextColor(50)
    doc.text(line, M, y + i * 3.6)
  })
  y += co.notes.length * 3.6 + 3

  // QR Code (K-Cars only)
  if (co.hasLogo) {
    try {
      const qrData = `PAYNOW:UEN:${co.paynow}`
      const qrDataUrl = await QRCode.toDataURL(qrData, { width:120, margin:1, color:{dark:'#000',light:'#fff'} })
      const qrX = M + 90, qrY = notesY
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 28, 28)
    } catch(e) { console.log('QR error:', e) }
  }

  // ── FOOTER ────────────────────────────────────────────────────────
  doc.setFont('helvetica','bold').setFontSize(7.5).setTextColor(30)
  doc.text('This is a computer generated invoice. No signature is required', M, y+4)
  doc.setFontSize(8)
  doc.text("Receipient's Signature & Stamp", W-M, y+4, {align:'right'})
  doc.setDrawColor(120).setLineWidth(0.3)
  doc.line(W-M-60, y+10, W-M, y+10)

  return doc
}

export async function downloadInvoice(invoice, customer, items, type) {
  const doc = await generateInvoicePDF(invoice, customer, items, type)
  doc.save((invoice.invoice_no||'invoice')+'.pdf')
}

export async function printInvoice(invoice, customer, items, type) {
  const doc = await generateInvoicePDF(invoice, customer, items, type)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}
