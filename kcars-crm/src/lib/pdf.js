import jsPDF from 'jspdf'
import 'jspdf-autotable'

const CO = {
  kc: {
    name:    'K-CARS AUTO CENTRE PTE LTD',
    addr:    '1 Kaki Bukit Road 1,#04-31 Enterprise One, Singapore 415934',
    telFax:  'Tel: 6289 1111                    Fax: 6281 5008',
    reg:     'Co. Reg No. : 201104963M',
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
    tel:     'Tel: 6482 1855 (Sales)     6289 1111 (General)     Fax: 6281 5008',
    reg:     'Co. Reg No.: 201106739D',
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

const QR_B64 = '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'

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
  const isGearbox = descs.some(d => d.includes('gearbox') || d.includes('transmission') || d.includes('gear box') || d.includes('auto transmission'))
  const isEngine  = descs.some(d => d.includes('engine overhaul') || d.includes('engine rebuild'))
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
  const d = Math.floor(Math.abs(n)), c = Math.round((Math.abs(n)-d)*100)
  if (d===0&&c===0) return 'SINGAPORE DOLLAR ZERO ONLY'
  let r = d>=1000 ? b1000(Math.floor(d/1000))+'THOUSAND ' : ''
  r += b1000(d%1000); r = r.trim()
  if (c>0) r += ' AND CENTS '+b1000(c).trim()
  return 'SINGAPORE DOLLAR '+r.trim()+' ONLY'
}

function getTech(invoice) {
  if (invoice.advisor || invoice.mechanic) {
    return { adv: invoice.advisor||'', mec: invoice.mechanic||'' }
  }
  return { adv: '', mec: (invoice.technician||'').trim() }
}

export function generateInvoicePDF(invoice, customer, items, invoiceType) {
  const type = invoiceType || detectInvoiceType(items)
  const co   = type.startsWith('kc') ? CO.kc : CO.onew
  const showWarranty = type === 'kc_gearbox'

  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const W=210, M=14
  let y = 8

  // ── HEADER ─────────────────────────────────────────────────────────
  if (co.hasLogo) {
    // K-Cars: logo on left (big, no distortion), company name+info on right
    try {
      const imgEl = document.querySelector('img[alt="K-Cars Auto Centre"]')
      if (imgEl) {
        const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight
        const targetH = 28  // fixed height in mm
        const targetW = targetH * (nw / nh)  // width based on real ratio
        const cv = document.createElement('canvas')
        cv.width = nw; cv.height = nh
        cv.getContext('2d').drawImage(imgEl, 0, 0)
        doc.addImage(cv.toDataURL('image/png'), 'PNG', M, y, targetW, targetH)
      }
    } catch(e) {}

    // Company name: large bold italic, right-aligned
    doc.setFont('helvetica','bolditalic').setFontSize(20).setTextColor(20)
    doc.text(co.name, W-M, y+9, {align:'right'})
    doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(50)
    doc.text(co.addr,    W-M, y+15, {align:'right'})
    doc.text(co.telFax,  W-M, y+20, {align:'right'})
    doc.text(co.reg,     W-M, y+25, {align:'right'})
    y += 32

  } else {
    // 1 World: NO logo. Big bold italic company name centered, info below
    doc.setFont('helvetica','bolditalic').setFontSize(22).setTextColor(20)
    doc.text(co.name, W/2, y+10, {align:'center'})
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(50)
    doc.text(co.addr, W/2, y+17, {align:'center'})
    doc.text(co.tel,  W/2, y+22, {align:'center'})
    doc.text(co.reg,  W/2, y+27, {align:'center'})
    y += 33
  }

  // Divider
  doc.setDrawColor(60).setLineWidth(0.6)
  doc.line(M, y, W-M, y)
  y += 6

  // ── INVOICE title + No. ───────────────────────────────────────────
  doc.setFont('helvetica','bold').setFontSize(15).setTextColor(20)
  doc.text('INVOICE', W/2, y+5, {align:'center'})
  doc.setFontSize(10)
  doc.text('No.  :  '+(invoice.invoice_no||''), W-M, y+5, {align:'right'})
  y += 11

  // ── CUSTOMER (left) + VEHICLE (right) ─────────────────────────────
  const boxW=85, lh=7
  const rightX=M+boxW+4, valX=rightX+26
  const { adv, mec } = getTech(invoice)

  // Plain text - no boxes
  const textLh = 7
  // Name
  doc.setFont('helvetica','normal').setFontSize(9).setTextColor(50)
  doc.text('Name :', M, y+4)
  doc.setFont('helvetica','bold').setFontSize(9).setTextColor(20)
  doc.text(customer.name||'', M+18, y+4)

  // Number
  doc.setFont('helvetica','normal').setFontSize(9).setTextColor(50)
  doc.text('Number :', M, y+textLh+4)
  doc.setFont('helvetica','normal').setFontSize(9).setTextColor(20)
  doc.text(customer.phone||'', M+20, y+textLh+4)

  // Advisor + Mechanic (same row, with box line only for this row)
  doc.setDrawColor(120).setLineWidth(0.25)
  doc.rect(M, y+2*textLh, boxW, 7)
  doc.setFont('helvetica','bold').setFontSize(8.5).setTextColor(20)
  doc.text('Advisor  : '+adv,  M+2,  y+2*textLh+4.8)
  doc.text('Mechanic  : '+mec, M+44, y+2*textLh+4.8)

  // Right side: 7 vehicle info rows
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
    doc.text(label, rightX, ry+5)
    doc.text(':', rightX+24, ry+5)
    doc.setFont('helvetica','bold').setTextColor(20)
    doc.text(String(val), valX, ry+5)
  })

  // Advance past tallest section
  y += Math.max(3*textLh+10, 7*lh) + 3

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
    styles: {fontSize:8.5, cellPadding:{top:2.5,bottom:2.5,left:2,right:2}, textColor:[20,20,20], lineColor:[130,130,130], lineWidth:0.25},
    headStyles: {fillColor:[255,255,255], textColor:[20,20,20], fontStyle:'normal', fontSize:8.5, lineColor:[130,130,130], lineWidth:0.25},
    columnStyles: {
      0:{cellWidth:12, halign:'center'},
      1:{cellWidth:66},
      2:{cellWidth:10, halign:'center'},
      3:{cellWidth:44},
      4:{cellWidth:25, halign:'right'},
      5:{cellWidth:25, halign:'right'},
    },
    tableLineColor:[130,130,130], tableLineWidth:0.25,
  })

  y = doc.lastAutoTable.finalY + 5

  // ── WARRANTY / REMARKS ────────────────────────────────────────────
  const remarkParts = []
  if (showWarranty) remarkParts.push(GEARBOX_WARRANTY)
  if (invoice.notes) remarkParts.push(invoice.notes)
  if (remarkParts.length) {
    doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(50)
    const lines = doc.splitTextToSize(remarkParts.join('\n\n'), W-M*2)
    doc.text(lines, M, y)
    y += lines.length*3.5+5
  }

  // ── TOTAL LINE ────────────────────────────────────────────────────
  const total = parseFloat(invoice.total||0)
  doc.setDrawColor(120).setLineWidth(0.3)
  doc.line(M, y, W-M, y)
  y += 5

  // Total in words (left)
  doc.setFont('helvetica','normal').setFontSize(8).setTextColor(30)
  doc.text(toWords(total), M, y+4)

  // Total label + box (right) — label outside box, number inside box
  doc.setFont('helvetica','bold').setFontSize(9.5).setTextColor(20)
  doc.text(co.totalLabel, W-M-30, y+5)
  doc.setDrawColor(120).setLineWidth(0.4)
  doc.rect(W-M-20, y+0.5, 20, 7)
  doc.setFont('helvetica','bold').setFontSize(10)
  doc.text(total.toFixed(2), W-M-1, y+5.5, {align:'right'})
  y += 13

  // ── NOTES + QR ───────────────────────────────────────────────────
  const boldKeywords = ['K-CARS AUTO CENTRE PTE LTD','1 WORLD AUTO EXPORT PTE LTD',
    '687-699-181-001','601-350481-001','201104963MP01','201106739D']

  const notesStartY = y
  co.notes.forEach((line, i) => {
    const isBold = boldKeywords.some(k => line.includes(k))
    doc.setFont('helvetica', isBold?'bold':'normal').setFontSize(7.5).setTextColor(50)
    doc.text(line, M, y + i*3.6)
  })

  // QR code for K-Cars only
  if (co.hasLogo) {
    try {
      doc.addImage('data:image/png;base64,'+QR_B64, 'PNG', M+90, notesStartY, 26, 26)
    } catch(e) {}
  }

  y += co.notes.length * 3.6 + 6

  // ── FOOTER ────────────────────────────────────────────────────────
  doc.setFont('helvetica','bold').setFontSize(7.5).setTextColor(30)
  doc.text('This is a computer generated invoice. No signature is required', M, y)

  // Signature: line first, text below
  const sigLineX = W-M-62
  doc.setDrawColor(100).setLineWidth(0.3)
  doc.line(sigLineX, y, W-M, y)
  doc.setFont('helvetica','bold').setFontSize(8).setTextColor(20)
  doc.text("Receipient's Signature & Stamp", W-M, y+5, {align:'right'})

  return doc
}

export function downloadInvoice(invoice, customer, items, type) {
  const doc = generateInvoicePDF(invoice, customer, items, type)
  doc.save((invoice.invoice_no||'invoice')+'.pdf')
}

export function printInvoice(invoice, customer, items, type) {
  const doc = generateInvoicePDF(invoice, customer, items, type)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}
