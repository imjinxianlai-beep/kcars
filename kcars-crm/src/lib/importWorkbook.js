import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const MAX_ROWS = 10000
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, processEntities: true, trimValues: false })
const list = x => x == null ? [] : Array.isArray(x) ? x : [x]
const text = x => String(x?.['#text'] ?? x ?? '').trim()
const rich = x => x?.r ? list(x.r).map(r => text(r.t)).join('') : text(x?.t)
const tidy = x => text(x).replace(/\s+/g, ' ')
export const normalizePlate = x => tidy(x).replace(/[^a-z0-9]/gi, '').toUpperCase()
const staff = x => ({ TA0: 'TAO', CO2: 'C02', XI: 'XIN' })[tidy(x).toUpperCase()] || tidy(x).toUpperCase()
function number(x) {
  const s = tidy(x).replace(/[$,]/g, '')
  if (!s) return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`无法识别数值：${s.slice(0, 40)}`)
  const v = Number(s)
  if (!Number.isFinite(v) || Math.abs(v) > 100000000) throw new Error('数值超过允许范围')
  return v
}
function date(x, date1904) {
  const s = tidy(x)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n < 1 || n > 100000) throw new Error('日期无效')
    return new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.floor(n) * 86400000).toISOString().slice(0, 10)
  }
  let parts = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(s)
  if (!parts) {
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (dmy) parts = ['', dmy[3], dmy[2].padStart(2, '0'), dmy[1].padStart(2, '0')]
  }
  if (!parts) throw new Error(`无法识别日期：${s}`)
  const iso = `${parts[1]}-${parts[2]}-${parts[3]}`
  if (new Date(iso).toISOString().slice(0, 10) !== iso) throw new Error('日期无效')
  return iso
}

// Every sheet is parsed. Workbook text is data only; no formulas or macros run.
export function parseWorkbook(buffer, source, filename) {
  if (!['kcars', 'oneworld'].includes(source)) throw new Error('请选择正确的数据来源')
  if (!/\.xlsx$/i.test(filename)) throw new Error('只支持 .xlsx 文件，请从 AutoCount 导出 Excel 工作簿')
  if (buffer.byteLength > MAX_FILE_SIZE) throw new Error('每份文件不能超过 5 MB')
  let expanded = 0, entries = 0
  const files = unzipSync(new Uint8Array(buffer), { filter: f => {
    entries++
    expanded += f.originalSize
    if (expanded > 30 * 1024 * 1024 || entries > 2000) throw new Error('工作簿展开后过大，请只导出需要更新的数据')
    return f.name.endsWith('.xml') || f.name.endsWith('.rels')
  } })
  const read = path => {
    if (!files[path]) throw new Error(`工作簿缺少 ${path}`)
    const content = strFromU8(files[path])
    if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error('不支持含外部实体的工作簿')
    return xml.parse(content)
  }
  const book = read('xl/workbook.xml').workbook
  const relations = list(read('xl/_rels/workbook.xml.rels').Relationships.Relationship)
  const strings = files['xl/sharedStrings.xml'] ? list(read('xl/sharedStrings.xml').sst?.si).map(rich) : []
  const rows = [], excluded = []
  let visited = 0
  for (const sheet of list(book.sheets.sheet)) {
    const rel = relations.find(r => r['@Id'] === sheet['@r:id'])
    if (!rel || rel['@TargetMode'] === 'External') throw new Error('工作表关联无效')
    const target = rel['@Target'].replace(/^\//, '')
    if (target.includes('..')) throw new Error('工作表路径无效')
    const path = target.startsWith('xl/') ? target : `xl/${target}`
    const data = list(read(path).worksheet?.sheetData?.row)
    if (!data.length) continue
    let headers
    for (const r of data) {
      if (++visited > MAX_ROWS + 100) throw new Error(`每份工作簿最多 ${MAX_ROWS} 行，请按月份导出`)
      const cells = {}
      for (const c of list(r.c)) {
        const col = String(c['@r'] || '').replace(/\d/g, '')
        const type = c['@t']
        if (type === 'e') throw new Error(`${sheet['@name']} 第 ${r['@r']} 行存在 Excel 错误`)
        cells[col] = type === 's' ? strings[Number(text(c.v))] : type === 'inlineStr' ? rich(c.is) : text(c.v)
      }
      if (!Object.values(cells).some(v => tidy(v))) continue
      if (!headers) {
        headers = Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, tidy(v)]))
        const required = ['Doc No','Doc Date','Debtor Name','Remark 1','Detail Description','Qty','Unit Price','Total (Ex)','Phone 1','Fax 1', ...(source === 'kcars' ? ['Make','Model'] : ['Remark 2'])]
        const missing = required.filter(k => !Object.values(headers).includes(k))
        if (missing.length) throw new Error(`${sheet['@name']} 缺少列：${missing.join('、')}。请检查是否选错文件。`)
        continue
      }
      const d = Object.fromEntries(Object.entries(cells).map(([k, v]) => [headers[k], v]))
      const invoice_no = tidy(d['Doc No']), description = tidy(d['Detail Description'])
      const loc = { file: filename, sheet: sheet['@name'], row: Number(r['@r']) }
      if (!invoice_no && !description && !tidy(d['Debtor Name'])) { excluded.push(loc); continue }
      if (!invoice_no || !description) throw new Error(`${loc.sheet} 第 ${loc.row} 行缺少发票号或项目说明，未上传任何数据`)
      let make, model
      if (source === 'kcars') { make = tidy(d.Make); model = tidy(d.Model).toUpperCase() }
      else {
        const vehicle = tidy(d['Remark 2']).toUpperCase(), parts = vehicle.split(' ')
        make = parts.length > 1 && /^[A-Z]{2,}$/.test(parts[0]) ? parts.shift() : ''
        model = make ? parts.join(' ') : vehicle
      }
      make = make.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      const qty = number(d.Qty), amount = number(d['Total (Ex)'])
      let unit_price = number(d['Unit Price'])
      if (unit_price === null && amount === 0 && /f\.?o\.?c/i.test(description)) unit_price = 0
      rows.push({ ...loc, source, invoice_no, date: date(d['Doc Date'], ['1','true'].includes(book.workbookPr?.['@date1904'])),
        customer: tidy(d['Debtor Name']), plate: normalizePlate(d['Remark 1']), make, model,
        advisor: staff(d['Phone 1']), mechanic: staff(d['Fax 1']), description, qty, unit_price, amount })
    }
  }
  if (!rows.length) throw new Error('工作簿中没有可处理的发票明细')
  return { rows, excluded }
}
