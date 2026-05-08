import jsPDF from 'jspdf'
import 'jspdf-autotable'

const COMPANIES = {
  kc: {
    name:   'K-CARS AUTO CENTRE PTE LTD',
    addr:   '1 Kaki Bukit Road 1, #04-31 Enterprise One, Singapore 415934',
    tel:    'Tel: 6289 1111',
    fax:    'Fax: 6281 5008',
    reg:    'Co. Reg No. : 201104963M',
    bank:   'OCBC A/C 687-699-181-001',
    paynow: '201104963MP01',
    prefix: 'KC',
  },
  onew: {
    name:   '1 WORLD AUTO EXPORT PTE LTD',
    addr:   '1 Kaki Bukit Road 1, #04-31 Enterprise One, Singapore 415934',
    tel:    'Tel: 6482 1855 (Sales)  6289 1111 (General)',
    fax:    'Fax: 6281 5008',
    reg:    'Co. Reg No.: 201106739D',
    bank:   'OCBC A/C 601-350481-001',
    paynow: '201106739D',
    prefix: 'KA',
  },
}

const GEARBOX_WARRANTY = `Gearbox warranty:
1) All gearboxes come with 6 months warranty or 20,000km, whichever comes first.
2) Compulsory 1 month after repair complimentary check.
3) Price Inclusive of Trade in.

Warranty does not cover:
1) Damage caused by misuse, negligence, or accident.
2) Loss of time/earnings from loss of use, rental, towing charges, personal injuries, or consequential damages.
3) Other mechanical parts failure causing transmission failure.
4) Any ECU/TCM related parts.
5) 4WD or Differential.`

export function detectInvoiceType(items = []) {
  const descs = items.map(i => (i.description || i.desc || '').toLowerCase())
  const isGearbox = descs.some(d =>
    d.includes('gearbox') || d.includes('transmission') || d.includes('gear box') || d.includes('auto transmission')
  )
  const isEngine = descs.some(d =>
    d.includes('engine overhaul') || d.includes('engine rebuild')
  )
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
  let r = ''
  if (d>=1000) r += b1000(Math.floor(d/1000))+'THOUSAND '
  r += b1000(d%1000)
  r = r.trim()
  if (c>0) r += ' AND CENTS '+b1000(c).trim()
  return 'SINGAPORE DOLLAR '+r.trim()+' ONLY'
}

export function generateInvoicePDF(invoice, customer, items, invoiceType) {
  const type = invoiceType || detectInvoiceType(items)
  const co   = type.startsWith('kc') ? COMPANIES.kc : COMPANIES.onew
  const showWarranty = type === 'kc_gearbox'

  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const W=210, M=14
  let y=10

  // ── Header ──────────────────────────────────────────────────────────
  // Try logo
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = document.querySelector('img[alt="K-Cars Auto Centre"]')
    if (img) {
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      doc.addImage(dataUrl, 'PNG', M, y, 34, 16)
    }
  } catch(e) {}

  doc.setFont('helvetica','bold').setFontSize(15).setTextColor(20)
  doc.text(co.name, M+37, y+6)
  doc.setFont('helvetica','normal').setFontSize(8).setTextColor(60)
  doc.text(co.addr, M+37, y+11)
  doc.text(co.tel+'     '+co.fax, M+37, y+15)
  doc.text(co.reg, M+37, y+19)

  y += 24
  doc.setDrawColor(160).setLineWidth(0.4)
  doc.line(M, y, W-M, y)
  y += 4

  // ── Invoice No & title ───────────────────────────────────────────────
  doc.setFont('helvetica','bold').setFontSize(15).setTextColor(20)
  doc.text('INVOICE', W/2, y+6, {align:'center'})
  doc.setFontSize(9)
  doc.text('No.  :  '+(invoice.invoice_no||'—'), W-M, y+6, {align:'right'})
  y += 12

  // ── Customer box (left) + Vehicle info (right) ───────────────────────
  const boxW=82, lh=6.2
  const rows = [customer.name||'—', customer.phone||'', '', '']
  rows.forEach((txt,i) => {
    doc.setDrawColor(150).setLineWidth(0.25)
    doc.rect(M, y+i*lh, boxW, lh)
    doc.setFont('helvetica', i===0?'bold':'normal').setFontSize(i===0?9.5:8.5).setTextColor(20)
    if (txt) doc.text(txt, M+2, y+i*lh+4.2)
  })
  // Advisor/mechanic in last box
  const adv = invoice.advisor  || (invoice.technician||'').split(',')[0]?.trim()||''
  const mec = invoice.mechanic || (invoice.technician||'').split(',')[1]?.trim()||''
  doc.setFont('helvetica','bold').setFontSize(8)
  doc.text('Advisor  : '+adv, M+2, y+3*lh+4.2)
  doc.text('Mechanic  : '+mec, M+44, y+3*lh+4.2)

  // Right: vehicle info
  const infoX=M+boxW+4, valX=infoX+25
  const vehicleRows = [
    ['Date',        invoice.date||'—'],
    ['Vehicle No.', customer.car_plate||'—'],
    ['Model',       ((customer.car_make||'')+' '+(customer.car_model||'')).trim()||'—'],
    ['Chassis No.', invoice.chassis_no||''],
    ['Engine No',   invoice.engine_no||''],
    ['Mileage',     invoice.mileage?(invoice.mileage+'KM'):''],
    ['COE Expire',  invoice.coe_expire||''],
  ]
  vehicleRows.forEach(([label,val],i) => {
    doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(70)
    doc.text(label, infoX, y+i*lh+4)
    doc.text(':', infoX+22, y+i*lh+4)
    doc.setFont('helvetica','bold').setTextColor(20)
    doc.text(String(val), valX, y+i*lh+4)
  })

  y += 4*lh + 4

  // ── Items table ──────────────────────────────────────────────────────
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
    styles: {fontSize:8.5, cellPadding:2.5, textColor:[20,20,20]},
    headStyles: {fillColor:[235,235,235], textColor:[20,20,20], fontStyle:'bold', fontSize:8.5, lineColor:[170,170,170], lineWidth:0.3},
    columnStyles: {
      0:{cellWidth:10, halign:'center'},
      1:{cellWidth:68},
      2:{cellWidth:10, halign:'center'},
      3:{cellWidth:44},
      4:{cellWidth:24, halign:'right'},
      5:{cellWidth:24, halign:'right', fontStyle:'bold'},
    },
    tableLineColor:[180,180,180], tableLineWidth:0.3,
  })

  y = doc.lastAutoTable.finalY + 4

  // ── Warranty / Notes ─────────────────────────────────────────────────
  const remarkParts = []
  if (showWarranty) remarkParts.push(GEARBOX_WARRANTY)
  if (invoice.notes) remarkParts.push(invoice.notes)
  if (remarkParts.length) {
    doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(55)
    const lines = doc.splitTextToSize(remarkParts.join('\n\n'), W-M*2)
    doc.text(lines, M, y+3)
    y += lines.length*3.5+5
  }

  // ── Total in words ───────────────────────────────────────────────────
  const total = parseFloat(invoice.total||0)
  doc.setDrawColor(160).setLineWidth(0.3)
  doc.line(M, y, W-M, y)
  y += 4

  doc.setFont('helvetica','normal').setFontSize(8).setTextColor(30)
  doc.text(toWords(total), M, y+4)

  doc.setFont('helvetica','bold').setFontSize(9)
  doc.text('Total', W-M-30, y+4)
  doc.rect(W-M-22, y, 22, 7)
  doc.setFontSize(10).setTextColor(20)
  doc.text(total.toFixed(2), W-M-1, y+5.2, {align:'right'})
  y += 12

  // ── Payment notes ────────────────────────────────────────────────────
  doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(50)
  const noteLines = [
    'Notes :',
    '1. Goods sold are not Refundable / Returnable.',
    ...(type.startsWith('kc')?['2. Price Inclusive of Trade In.']:[] ),
    (type.startsWith('kc')?'3.':'2.')+' Payment Mode :',
    '   A:- Cheque.:  '+co.name,
    '   B:- Bank Transfer.:  '+co.bank,
    '   C:- PayNow.:  UEN '+co.paynow,
    '   *Please send the Payment Advice via Whatsapp to +65-8787 5151 after transfer done.',
  ]
  doc.text(noteLines, M, y)
  y += noteLines.length*3.8+3

  // ── Footer ───────────────────────────────────────────────────────────
  doc.setFont('helvetica','bold').setFontSize(7.5).setTextColor(30)
  doc.text('This is a computer generated invoice. No signature is required', M, y+4)
  doc.setFontSize(8)
  doc.text("Receipient's Signature & Stamp", W-M, y+4, {align:'right'})
  doc.setLineWidth(0.3)
  doc.line(W-M-58, y+10, W-M, y+10)

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
