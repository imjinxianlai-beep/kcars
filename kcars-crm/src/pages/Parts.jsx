import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, addPart, updatePart } from '../lib/supabase'

// ── Design tokens ─────────────────────────────────────────────────────────────
const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
const C = {
  bg:       '#f6f5f4',
  canvas:   '#ffffff',
  line:     '#e5e3df',
  lineSoft: '#ede9e4',
  ink:      '#1a1a1a',
  charcoal: '#37352f',
  slate:    '#5d5b54',
  steel:    '#787671',
  muted:    '#bbb8b1',
  primary:  '#5645d4',
  error:    '#e03131',
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND_SHORTCUTS = ['Honda', 'Toyota', 'Nissan', 'Mitsubishi', 'Hyundai', 'Kia', 'BMW', 'Mercedes', 'Audi']

const CATEGORY_OPTIONS = [
  { value: 'transmission',  label: 'Transmission'  },
  { value: 'engine',        label: 'Engine'        },
  { value: 'aircon',        label: 'Air Con'       },
  { value: 'suspension',    label: 'Suspension'    },
  { value: 'brakes',        label: 'Brakes'        },
  { value: 'steering',      label: 'Steering'      },
  { value: 'cooling',       label: 'Cooling'       },
  { value: 'electrical',    label: 'Electrical'    },
  { value: 'clutch',        label: 'Clutch'        },
  { value: 'drivetrain',    label: 'Drivetrain'    },
  { value: 'hybrid',        label: 'Hybrid'        },
  { value: 'ignition',      label: 'Ignition'      },
  { value: 'mounting',      label: 'Mounting'      },
  { value: 'others',        label: 'Others'        },
  { value: 'service',       label: 'Service'       },
  { value: 'tyre',          label: 'Tyre'          },
  { value: 'wheel_bearing', label: 'Wheel Bearing' },
]

const CATEGORY_ORDER = ['transmission','engine','aircon','suspension','brakes','steering','cooling','electrical','clutch','others']

const RECENT_KEY = 'kcars_parts_recent'

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCategoryLabel(value) {
  return CATEGORY_OPTIONS.find(c => c.value === value)?.label || value
}

function normCat(raw) {
  if (!raw) return null
  const byVal = CATEGORY_OPTIONS.find(c => c.value === raw)
  if (byVal) return byVal.value
  const byLbl = CATEGORY_OPTIONS.find(c => c.label.toLowerCase() === raw.toLowerCase())
  if (byLbl) return byLbl.value
  return raw
}

function dedupe(rows, key) {
  const seen = new Set()
  return (rows || []).reduce((acc, row) => {
    const v = row[key]
    if (v && !seen.has(v)) { seen.add(v); acc.push(v) }
    return acc
  }, [])
}

function parsePriceOptions(part) {
  if (part?.selling_price_text) {
    const text = part.selling_price_text.trim()
    const hasMultiple = text.includes('/') || text.includes('·')
    if (hasMultiple) {
      const sep = text.includes('/') ? '/' : '·'
      return text.split(sep).map(s => {
        const clean = s.trim()
        const m = clean.match(/^(.*?)\s*(\$[\d,]+(?:\.\d+)?)(.*)$/)
        if (m) return { label: m[1].trim(), amount: (m[2] + m[3]).trim() }
        return { label: '', amount: clean }
      }).filter(p => p.amount)
    }
    return [{ label: '', amount: text }]
  }
  if (part?.selling_price != null && part.selling_price !== '') {
    return [{ label: '', amount: `$${Math.round(part.selling_price).toLocaleString()}` }]
  }
  return null
}

function parseWarranty(notes) {
  if (!notes) return null
  if (/12\s*(个月|months?)/i.test(notes)) return 'Warranty 12 months'
  if (/6\s*(个月|months?)/i.test(notes))  return 'Warranty 6 months'
  if (/3\s*(个月|months?)/i.test(notes))  return 'Warranty 3 months'
  return null
}

function stripWarranty(notes = '') {
  return notes
    .replace(/质保\s*\d+\s*个月/gi, '')
    .replace(/warranty\s*\d+\s*months?/gi, '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n')
}

function buildQuote(vehicle, part) {
  const opts = parsePriceOptions(part)
  const priceStr = opts ? opts.map(p => p.label ? `${p.label} ${p.amount}` : p.amount).join(' / ') : 'TBC'
  const warranty = parseWarranty(part.notes)
  return `${vehicle} ${part.part_name}: ${priceStr}${warranty ? `, ${warranty}` : ''}`
}

function isGeneral(part) {
  const make = (part.vehicle_make || '').toLowerCase()
  const text = (part.vehicle_text || '').toLowerCase()
  return make === 'general' || text.includes('general') || text.includes('通用')
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function saveRecent(entry) {
  const list = getRecent().filter(r =>
    !(r.make === entry.make && r.vehicle === entry.vehicle && r.category === entry.category)
  )
  list.unshift({ ...entry, timestamp: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)))
}

function fmtMoney(value) {
  if (value == null || value === '') return 'TBC'
  return `$${Math.round(Number(value)).toLocaleString()}`
}

function fmtDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function sanitizeSearchQuery(value) {
  return String(value || '')
    .trim()
    .replace(/[%,()]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div className="spinner" />
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: C.steel, fontSize: 14, fontFamily: FONT }}>
      {message || 'No results found'}
    </div>
  )
}

// ── SectionCard ───────────────────────────────────────────────────────────────
function SectionCard({ children }) {
  return (
    <div style={{
      background: C.canvas,
      border: `1px solid ${C.line}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
function SectionLabel({ text }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
      color: C.steel, textTransform: 'uppercase',
      padding: '16px 4px 6px',
      fontFamily: FONT,
    }}>
      {text}
    </div>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────
function PageHeader({ title, backLabel, onBack, onAdd }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: C.canvas,
      borderBottom: `1px solid ${C.line}`,
      height: 52,
      padding: '0 16px',
      display: 'flex', alignItems: 'center',
      fontFamily: FONT,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {backLabel && onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 500, color: C.primary,
              padding: 0, fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span> {backLabel}
          </button>
        )}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 600, color: C.ink,
        textAlign: 'center', flex: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onAdd}
          style={{
            background: C.primary, color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 12px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: FONT, whiteSpace: 'nowrap',
          }}
        >
          + Add Part
        </button>
      </div>
    </div>
  )
}

// ── CountBadge ────────────────────────────────────────────────────────────────
function CountBadge({ count }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, color: C.steel,
      background: '#f0eeec', borderRadius: 9999,
      padding: '2px 8px', fontFamily: FONT,
    }}>
      {count}
    </span>
  )
}

// ── ListItem ──────────────────────────────────────────────────────────────────
function ListItem({ primary, secondary, right, onClick, last }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', minHeight: 52,
        background: hov && onClick ? '#f0eef8' : C.canvas,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
        borderBottom: last ? 'none' : `1px solid ${C.lineSoft}`,
        fontFamily: FONT,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, padding: '12px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 400, color: C.ink, lineHeight: 1.4 }}>{primary}</div>
        {secondary && (
          <div style={{ fontSize: 13, color: C.steel, marginTop: 2, lineHeight: 1.3 }}>{secondary}</div>
        )}
      </div>
      {right != null && (
        <div style={{ flexShrink: 0, marginLeft: 12 }}>{right}</div>
      )}
      {onClick && (
        <span style={{ color: C.muted, fontSize: 18, marginLeft: 8, flexShrink: 0 }}>›</span>
      )}
    </div>
  )
}

// ── PartCard ──────────────────────────────────────────────────────────────────
function PartCard({ part, vehicle, last, onEdit, latestPrice }) {
  const [open,          setOpen]          = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [historySummary, setHistorySummary] = useState(null)   // null=unfetched, false=no row, object=data
  const [recentPrices,   setRecentPrices]   = useState(null)   // null=unfetched, []=empty, array=data

  const priceOpts = parsePriceOptions(part)
  const warranty  = parseWarranty(part.notes)
  const hasMulti  = priceOpts && priceOpts.length > 1

  const toggle = () => {
    const opening = !open
    setOpen(opening)
    if (opening && historySummary === null && recentPrices === null) {
      Promise.all([
        supabase.from('part_price_history').select('*').eq('part_id', part.id).maybeSingle(),
        supabase.from('part_price_recent').select('*').eq('part_id', part.id)
          .lte('rn', 5).order('date', { ascending: false }).order('invoice_no', { ascending: false }),
      ]).then(([summaryRes, recentRes]) => {
        setHistorySummary(summaryRes.data || false)
        setRecentPrices(recentRes.data || [])
      })
    }
  }

  const copy = () => {
    const text = buildQuote(vehicle, part)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    }
  }

  const latestHistoryPrice =
    latestPrice?.amount ??
    (recentPrices && recentPrices.length > 0 ? recentPrices[0].amount : null)

  const priceDisplay = !priceOpts ? (
    latestHistoryPrice ? (
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--orange)', fontFeatureSettings: '"tnum"', fontFamily: FONT }}>
        Recent {fmtMoney(latestHistoryPrice)}
      </span>
    ) : (
      <span style={{ fontSize: 13, color: C.steel, fontFamily: FONT }}>TBC</span>
    )
  ) : hasMulti ? (
    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--orange)', fontFeatureSettings: '"tnum"', fontFamily: FONT }}>
      from {priceOpts[0].amount}
    </span>
  ) : (
    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--orange)', fontFeatureSettings: '"tnum"', fontFamily: FONT }}>
      {priceOpts[0].label ? `${priceOpts[0].label} ` : ''}{priceOpts[0].amount}
    </span>
  )

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${C.lineSoft}` }}>
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'flex-start',
          padding: '14px 16px', minHeight: 52,
          cursor: 'pointer',
          background: open ? C.bg : C.canvas,
          transition: 'background 0.1s',
          fontFamily: FONT,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.ink, lineHeight: 1.4 }}>
            {part.part_name}
          </div>
          {warranty && (
            <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>{warranty}</div>
          )}
        </div>
        <div style={{ flexShrink: 0, marginLeft: 12, textAlign: 'right' }}>
          {priceDisplay}
        </div>
      </div>

      {open && (
        <div style={{ background: C.bg, padding: '0 16px 14px', fontFamily: FONT }}>
          {hasMulti && (
            <div style={{
              background: C.canvas, borderRadius: 8, border: `1px solid ${C.line}`,
              padding: '10px 14px', marginBottom: 10,
            }}>
              {priceOpts.map((opt, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: i < priceOpts.length - 1 ? 8 : 0,
                  marginBottom: i < priceOpts.length - 1 ? 8 : 0,
                  borderBottom: i < priceOpts.length - 1 ? `1px solid ${C.lineSoft}` : 'none',
                }}>
                  <span style={{ fontSize: 14, color: C.charcoal }}>{opt.label || 'Price'}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--orange)', fontFeatureSettings: '"tnum"' }}>
                    {opt.amount}
                  </span>
                </div>
              ))}
            </div>
          )}

          {part.notes && (
            <div style={{ fontSize: 13, color: C.slate, marginBottom: 12, lineHeight: 1.5 }}>
              {part.notes}
            </div>
          )}

          {/* ── Price History ── */}
          {(historySummary || (recentPrices && recentPrices.length > 0)) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                color: C.steel, textTransform: 'uppercase', marginBottom: 6,
              }}>
                Price History
              </div>

              <div style={{
                background: C.canvas, borderRadius: 8, border: `1px solid ${C.line}`,
                padding: '10px 14px',
              }}>
                {recentPrices && recentPrices.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: C.steel, fontFeatureSettings: '"tnum"', marginBottom: 10 }}>
                      {historySummary?.history_count ? `${Number(historySummary.history_count).toLocaleString()} jobs · ` : ''}
                      Last: {fmtDate(recentPrices[0].date)} · {fmtMoney(recentPrices[0].amount)}
                    </div>

                    <div style={{
                      fontSize: 11, fontWeight: 600, color: C.steel,
                      textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
                    }}>
                      Recent Prices
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: historySummary ? 10 : 0 }}>
                      {recentPrices.slice(0, 5).map((row, i) => (
                        <div key={`${row.invoice_no || ''}-${row.date || ''}-${i}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ fontSize: 13, color: C.charcoal, fontFeatureSettings: '"tnum"' }}>
                              {fmtDate(row.date)}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', fontFeatureSettings: '"tnum"' }}>
                              {fmtMoney(row.amount)}
                            </span>
                          </div>
                          {(row.car_make || row.car_model || row.invoice_no) && (
                            <div style={{ fontSize: 11, color: C.steel, marginTop: 1 }}>
                              {[row.car_make, row.car_model].filter(Boolean).join(' ')}
                              {row.invoice_no ? ` · ${row.invoice_no}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {historySummary && historySummary.min_price != null && historySummary.max_price != null && (
                  <div style={{
                    borderTop: recentPrices && recentPrices.length > 0 ? `1px solid ${C.lineSoft}` : 'none',
                    paddingTop: recentPrices && recentPrices.length > 0 ? 10 : 0,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 12, color: C.steel }}>Range</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.charcoal, fontFeatureSettings: '"tnum"' }}>
                        {fmtMoney(historySummary.min_price)} — {fmtMoney(historySummary.max_price)}
                      </span>
                    </div>
                    {Number(historySummary.max_price) >= Number(historySummary.min_price) * 2 && (
                      <div style={{ fontSize: 11, color: C.error, marginTop: 6, lineHeight: 1.4 }}>
                        Price varies. Check recent jobs before quoting.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={copy}
              style={{
                background: copied ? '#f0eef8' : C.canvas,
                border: `1px solid ${copied ? C.primary : C.line}`,
                borderRadius: 8, padding: '7px 14px',
                fontSize: 13, fontWeight: 500,
                color: copied ? C.primary : C.ink,
                cursor: 'pointer', fontFamily: FONT,
                transition: 'all 0.15s',
              }}
            >
              {copied ? 'Copied' : 'Copy Quote'}
            </button>
            <button
              onClick={() => onEdit(part)}
              style={{
                background: 'transparent', border: `1px solid ${C.line}`,
                borderRadius: 8, padding: '7px 14px',
                fontSize: 13, fontWeight: 500, color: C.slate,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddPartModal ──────────────────────────────────────────────────────────────
function AddPartModal({ part, contextVehicle, contextMake, makes, onClose, onSave, saving }) {
  const isEdit = !!part

  const [scope, setScope] = useState(() => {
    if (part) return isGeneral(part) ? 'general' : 'vehicle'
    return contextVehicle ? 'vehicle' : 'general'
  })
  const [form, setForm] = useState({
    part_name:    part?.part_name    || '',
    vehicle_make: part?.vehicle_make || contextMake    || '',
    vehicle_text: part?.vehicle_text || contextVehicle || '',
    category:     normCat(part?.category) || '',
    notes:        stripWarranty(part?.notes || ''),
  })
  const [priceType, setPriceType] = useState(() => {
    if (!part) return 'tbc'
    if (part.selling_price_text) {
      const hasMultiple = part.selling_price_text.includes('/') || part.selling_price_text.includes('·')
      return hasMultiple ? 'multi' : 'text'
    }
    if (part.selling_price != null) return 'fixed'
    return 'tbc'
  })
  const [fixedPrice, setFixedPrice] = useState(part?.selling_price ?? '')
  const [priceText,  setPriceText]  = useState(part?.selling_price_text || '')
  const [warranty,   setWarranty]   = useState(() => {
    const w = parseWarranty(part?.notes || '')
    if (!w) return 'none'
    if (w.includes('12')) return '12'
    if (w.includes('6'))  return '6'
    if (w.includes('3'))  return '3'
    return 'none'
  })
  const [formError, setFormError] = useState('')

  const set = k => e => { setFormError(''); setForm(f => ({ ...f, [k]: e.target.value })) }

  const submit = () => {
    setFormError('')
    if (!form.part_name.trim()) { setFormError('Part name is required.'); return }
    if (!form.category)         { setFormError('Category is required.'); return }
    if (scope === 'vehicle' && (!form.vehicle_make || !form.vehicle_text?.trim())) {
      setFormError('Vehicle make and description are required for specific vehicle parts.')
      return
    }

    let notes = stripWarranty(form.notes)
    if (warranty !== 'none') {
      const tag = `Warranty ${warranty} months`
      notes = notes ? `${notes}\n${tag}` : tag
    }

    onSave({
      part_name:          form.part_name.trim(),
      vehicle_make:       scope === 'general' ? 'General' : form.vehicle_make,
      vehicle_text:       scope === 'general' ? 'General' : form.vehicle_text.trim(),
      category:           form.category,
      notes:              notes.trim(),
      selling_price:      priceType === 'fixed' && fixedPrice !== '' ? parseFloat(fixedPrice) : null,
      selling_price_text: (priceType === 'multi' || priceType === 'text') ? priceText.trim() : null,
    })
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', height: 44,
    border: `1px solid ${C.line}`, borderRadius: 8,
    fontSize: 15, color: C.ink, outline: 'none',
    background: C.canvas, fontFamily: FONT,
  }
  const lbl = {
    fontSize: 13, fontWeight: 500, color: C.charcoal,
    marginBottom: 5, display: 'block', fontFamily: FONT,
  }
  const seg = active => ({
    flex: 1, padding: '9px 8px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.1s',
    border: `1px solid ${active ? C.primary : C.line}`,
    background: active ? '#ede9fc' : C.canvas,
    color: active ? C.primary : C.slate,
  })

  const vehicleScopeLabel = contextVehicle ? 'Current Vehicle' : 'Specific Vehicle'

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.ink, fontFamily: FONT }}>
            {isEdit ? 'Edit Part' : 'Add Part'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <label style={lbl}>Vehicle Scope</label>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => { setScope('vehicle'); setFormError('') }}
                style={{ ...seg(scope === 'vehicle'), borderRadius: '8px 0 0 8px', borderRight: 'none' }}>
                {vehicleScopeLabel}
              </button>
              <button onClick={() => { setScope('general'); setFormError('') }}
                style={{ ...seg(scope === 'general'), borderRadius: '0 8px 8px 0' }}>
                General Part
              </button>
            </div>
          </div>

          {scope === 'vehicle' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Vehicle Make</label>
                <select value={form.vehicle_make} onChange={set('vehicle_make')} style={inp}>
                  <option value="">— select —</option>
                  {makes.sort().map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Vehicle Text</label>
                <input value={form.vehicle_text} onChange={set('vehicle_text')}
                  placeholder="e.g. Honda Vezel 2017" style={inp} />
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>Part Name *</label>
            <input value={form.part_name} onChange={set('part_name')}
              placeholder="e.g. CVT Gearbox Assembly" style={inp} autoFocus />
          </div>

          <div>
            <label style={lbl}>Category *</label>
            <select value={form.category} onChange={set('category')} style={inp}>
              <option value="">— select —</option>
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Price Type</label>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
              {[['fixed','Fixed'],['multi','Multiple'],['text','Text'],['tbc','TBC']].map(([v, l], i, arr) => (
                <button key={v} onClick={() => setPriceType(v)} style={{
                  ...seg(priceType === v),
                  borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : '0',
                  borderRight: i < arr.length - 1 ? 'none' : undefined,
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {priceType === 'fixed' && (
            <div>
              <label style={lbl}>Price (SGD)</label>
              <input type="number" value={fixedPrice} onChange={e => setFixedPrice(e.target.value)}
                placeholder="e.g. 1800" min="0" style={inp} />
            </div>
          )}
          {priceType === 'multi' && (
            <div>
              <label style={lbl}>Price Options</label>
              <input value={priceText} onChange={e => setPriceText(e.target.value)}
                placeholder="e.g. New $3,600 / Recon $2,800" style={inp} />
            </div>
          )}
          {priceType === 'text' && (
            <div>
              <label style={lbl}>Price Text</label>
              <input value={priceText} onChange={e => setPriceText(e.target.value)}
                placeholder="e.g. From $900, $1,800–$2,500" style={inp} />
            </div>
          )}

          <div>
            <label style={lbl}>Warranty</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['none','None'],['3','3 months'],['6','6 months'],['12','12 months']].map(([v, l]) => (
                <button key={v} onClick={() => setWarranty(v)} style={{
                  flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 500,
                  borderRadius: 8, border: `1px solid ${warranty === v ? C.primary : C.line}`,
                  background: warranty === v ? '#ede9fc' : C.canvas,
                  color: warranty === v ? C.primary : C.slate,
                  cursor: 'pointer', fontFamily: FONT,
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')}
              placeholder="Additional notes..." rows={2}
              style={{ ...inp, height: 'auto', resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          {formError && (
            <div style={{ fontSize: 13, color: C.error, fontFamily: FONT, marginTop: -8 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{
              background: C.primary, color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 18px',
              fontSize: 14, fontWeight: 500,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: FONT, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving...' : isEdit ? 'Save' : 'Add Part'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Parts() {
  const [view,             setView]             = useState('home')
  const [selectedMake,     setSelectedMake]     = useState(null)
  const [selectedVehicle,  setSelectedVehicle]  = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [drillOrigin,      setDrillOrigin]      = useState('home')

  const [brands,        setBrands]        = useState([])
  const [vehicles,      setVehicles]      = useState([])
  const [categories,    setCategories]    = useState([])
  const [exactParts,    setExactParts]    = useState([])
  const [generalParts,  setGeneralParts]  = useState([])
  const [searchResults, setSearchResults] = useState([])

  const [loading,         setLoading]         = useState(false)
  const [searchQ,         setSearchQ]         = useState('')
  const [searchError,     setSearchError]     = useState('')
  const [recent,          setRecent]          = useState(getRecent)
  const [modal,           setModal]           = useState(null)
  const [saving,          setSaving]          = useState(false)
  const [latestPriceMap,  setLatestPriceMap]  = useState({})

  const homeInputRef      = useRef(null)
  const searchInputRef    = useRef(null)
  const latestSearchTsRef = useRef(0)

  const loadLatestPrices = useCallback(async (partsList) => {
    const ids = [...new Set((partsList || []).map(p => p.id).filter(Boolean))]
    if (ids.length === 0) return
    const { data, error } = await supabase
      .from('part_price_recent')
      .select('part_id, amount, date, invoice_no, car_make, car_model')
      .in('part_id', ids)
      .eq('rn', 1)
    if (error) { console.warn('[Parts] Failed to load latest prices', error); return }
    const next = {}
    for (const row of data || []) next[row.part_id] = row
    setLatestPriceMap(prev => ({ ...prev, ...next }))
  }, [])

  // Fetch brand counts on mount
  useEffect(() => {
    supabase.from('parts_library').select('vehicle_make').then(({ data }) => {
      if (!data) return
      const counts = {}
      for (const row of data) {
        const m = row.vehicle_make
        if (m) counts[m] = (counts[m] || 0) + 1
      }
      setBrands(
        Object.entries(counts)
          .map(([make, count]) => ({ make, count }))
          .sort((a, b) => a.make.localeCompare(b.make))
      )
    })
  }, [])

  // Autofocus on view change
  useEffect(() => {
    if (view === 'home')   setTimeout(() => homeInputRef.current?.focus(),   50)
    if (view === 'search') setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [view])

  // Step 2: vehicles for make
  useEffect(() => {
    if (view !== 'step2' || !selectedMake) return
    setLoading(true)
    supabase.from('parts_library').select('vehicle_text')
      .eq('vehicle_make', selectedMake).order('vehicle_text')
      .then(({ data }) => { setVehicles(dedupe(data, 'vehicle_text')); setLoading(false) })
  }, [view, selectedMake])

  // Step 3: categories for vehicle (including general) — normalize to values
  useEffect(() => {
    if (view !== 'step3' || !selectedVehicle) return
    setLoading(true)
    Promise.all([
      supabase.from('parts_library').select('category').ilike('vehicle_text', `%${selectedVehicle}%`),
      supabase.from('parts_library').select('category')
        .or('vehicle_make.eq.General,vehicle_text.ilike.%general%,vehicle_text.ilike.%通用%'),
    ]).then(([vRes, gRes]) => {
      const counts = {}
      for (const row of [...(vRes.data || []), ...(gRes.data || [])]) {
        const val = normCat(row.category)
        if (val) counts[val] = (counts[val] || 0) + 1
      }
      const cats = Object.entries(counts).map(([name, count]) => ({ name, count }))
      cats.sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a.name)
        const ib = CATEGORY_ORDER.indexOf(b.name)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return getCategoryLabel(a.name).localeCompare(getCategoryLabel(b.name))
      })
      setCategories(cats)
      setLoading(false)
    })
  }, [view, selectedVehicle])

  // Results: exact + general parts — use ilike for category to match old label format and new value format
  useEffect(() => {
    if (view !== 'results' || !selectedVehicle || !selectedCategory) return
    setLoading(true)
    const catLabel = getCategoryLabel(selectedCategory)
    Promise.all([
      supabase.from('parts_library').select('*')
        .ilike('vehicle_text', `%${selectedVehicle}%`)
        .ilike('category', catLabel)
        .not('vehicle_make', 'eq', 'General')
        .order('part_name'),
      supabase.from('parts_library').select('*')
        .or('vehicle_make.eq.General,vehicle_text.ilike.%general%,vehicle_text.ilike.%通用%')
        .ilike('category', catLabel)
        .order('part_name'),
    ]).then(([eRes, gRes]) => {
      const exact   = eRes.data || []
      const general = gRes.data || []
      setExactParts(exact)
      setGeneralParts(general)
      loadLatestPrices([...exact, ...general])
      setLoading(false)
      if (selectedMake && selectedVehicle && selectedCategory) {
        saveRecent({ make: selectedMake, vehicle: selectedVehicle, category: selectedCategory })
        setRecent(getRecent())
      }
    })
  }, [view, selectedVehicle, selectedCategory, selectedMake])

  // Search with 300ms debounce
  useEffect(() => {
    const safeQ = sanitizeSearchQuery(searchQ)
    if (view !== 'search' || !safeQ) {
      setSearchResults([])
      setSearchError('')
      return
    }
    const timer = setTimeout(() => {
      const ts = Date.now()
      latestSearchTsRef.current = ts
      setLoading(true)
      setSearchError('')
      const orFilter = [
        `vehicle_text.ilike.%${safeQ}%`,
        `vehicle_make.ilike.%${safeQ}%`,
        `vehicle_model.ilike.%${safeQ}%`,
        `part_name.ilike.%${safeQ}%`,
      ].join(',')
      supabase.from('parts_library').select('*')
        .or(orFilter)
        .order('vehicle_text').order('part_name')
        .limit(200)
        .then(({ data, error }) => {
          if (latestSearchTsRef.current !== ts) return
          if (error) {
            setSearchError('Search failed, please try again')
            setSearchResults([])
            setLoading(false)
            return
          }
          const rows = data || []
          loadLatestPrices(rows)
          const grouped = {}
          for (const part of rows) {
            const key = part.vehicle_text || 'Unknown'
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(part)
          }
          setSearchResults(Object.entries(grouped).map(([vehicle, parts]) => ({ vehicle, parts })))
          setLoading(false)
        })
        .catch(() => {
          if (latestSearchTsRef.current !== ts) return
          setSearchError('Search failed, please try again')
          setSearchResults([])
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [view, searchQ, loadLatestPrices])

  // Navigation
  const goHome = useCallback(() => {
    setView('home')
    setSelectedMake(null)
    setSelectedVehicle(null)
    setSelectedCategory(null)
  }, [])

  const selectMake = (make, origin = 'step1') => {
    setSelectedMake(make)
    setSelectedVehicle(null)
    setSelectedCategory(null)
    setDrillOrigin(origin)
    setView('step2')
  }

  const selectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle)
    setSelectedCategory(null)
    setView('step3')
  }

  const selectCategory = (categoryValue) => {
    setSelectedCategory(categoryValue)
    setView('results')
  }

  const loadRecent = (entry) => {
    setSelectedMake(entry.make)
    setSelectedVehicle(entry.vehicle)
    setSelectedCategory(entry.category)
    setView('results')
  }

  const handleSave = async (formData) => {
    setSaving(true)
    if (modal.mode === 'add') {
      const { data, error } = await addPart(formData)
      if (error) { alert(error.message); setSaving(false); return }
      if (view === 'results' && data) {
        if (isGeneral(data)) setGeneralParts(ps => [...ps, data].sort((a, b) => a.part_name.localeCompare(b.part_name)))
        else                 setExactParts(ps => [...ps, data].sort((a, b) => a.part_name.localeCompare(b.part_name)))
      }
    } else {
      const { data, error } = await updatePart(modal.part.id, formData)
      if (error) { alert(error.message); setSaving(false); return }
      if (view === 'results' && data) {
        setExactParts(ps => ps.map(p => p.id === modal.part.id ? data : p))
        setGeneralParts(ps => ps.map(p => p.id === modal.part.id ? data : p))
      }
    }
    setSaving(false)
    setModal(null)
  }

  const catLabel = selectedCategory ? getCategoryLabel(selectedCategory) : ''

  const headerProps = (() => {
    if (view === 'home')    return { title: 'Parts Lookup', backLabel: null,            onBack: null }
    if (view === 'step1')   return { title: 'All Brands',   backLabel: 'Parts',         onBack: goHome }
    if (view === 'step2')   return { title: selectedMake,   backLabel: 'Parts',         onBack: drillOrigin === 'home' ? goHome : () => setView('step1') }
    if (view === 'step3')   return { title: selectedVehicle, backLabel: selectedMake,   onBack: () => setView('step2') }
    if (view === 'results') return { title: catLabel,        backLabel: selectedVehicle, onBack: () => setView('step3') }
    if (view === 'search')  return { title: 'Search Results', backLabel: 'Parts',       onBack: goHome }
    return { title: 'Parts', backLabel: null, onBack: null }
  })()

  const makesForModal = brands.map(b => b.make)

  return (
    <div style={{ background: C.bg, height: '100%', overflowY: 'auto', fontFamily: FONT }}>

      <PageHeader
        title={headerProps.title}
        backLabel={headerProps.backLabel}
        onBack={headerProps.onBack}
        onAdd={() => setModal({ mode: 'add', part: null })}
      />

      {/* ── HOME ─────────────────────────────────────────────────────────── */}
      {view === 'home' && (
        <div>
          <div style={{ padding: '16px 16px 8px' }}>
            <input
              ref={homeInputRef}
              type="search"
              value={searchQ}
              onChange={e => {
                const q = e.target.value
                setSearchQ(q)
                if (q.trim()) setView('search')
              }}
              placeholder='Search vehicle or part... e.g. "Vezel Gearbox"'
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                height: 48, padding: '0 16px',
                border: `1px solid ${C.line}`,
                borderRadius: 10, fontSize: 16,
                color: C.ink, background: C.canvas,
                outline: 'none', fontFamily: FONT,
              }}
            />
          </div>

          {/* Brand shortcuts */}
          <div style={{
            overflowX: 'auto', padding: '8px 16px 12px',
            display: 'flex', gap: 8, scrollbarWidth: 'none',
          }}>
            {BRAND_SHORTCUTS.map(brand => (
              <button
                key={brand}
                onClick={() => selectMake(brand, 'home')}
                style={{
                  flexShrink: 0, padding: '8px 14px',
                  background: C.canvas, border: `1px solid ${C.line}`,
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  color: C.charcoal, cursor: 'pointer', fontFamily: FONT,
                  whiteSpace: 'nowrap',
                }}
              >
                {brand}
              </button>
            ))}
            <button
              onClick={() => setView('step1')}
              style={{
                flexShrink: 0, padding: '8px 14px',
                background: C.bg, border: `1px solid ${C.line}`,
                borderRadius: 8, fontSize: 13, fontWeight: 500,
                color: C.slate, cursor: 'pointer', fontFamily: FONT,
                whiteSpace: 'nowrap',
              }}
            >
              All Brands
            </button>
          </div>

          {/* Recent queries */}
          {recent.length > 0 && (
            <div style={{ padding: '0 16px 24px' }}>
              <SectionLabel text="Recent" />
              <SectionCard>
                {recent.map((entry, i) => (
                  <ListItem
                    key={entry.timestamp}
                    primary={`${entry.vehicle} · ${getCategoryLabel(entry.category)}`}
                    secondary={entry.make}
                    last={i === recent.length - 1}
                    onClick={() => loadRecent(entry)}
                  />
                ))}
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {/* ── ALL BRANDS ───────────────────────────────────────────────────── */}
      {view === 'step1' && (
        <div style={{ padding: '16px' }}>
          {loading ? <Spinner /> : brands.length === 0 ? <EmptyState message="No brands found" /> : (
            <SectionCard>
              {brands.map((b, i) => (
                <ListItem
                  key={b.make}
                  primary={b.make}
                  right={<CountBadge count={b.count} />}
                  last={i === brands.length - 1}
                  onClick={() => selectMake(b.make, 'step1')}
                />
              ))}
            </SectionCard>
          )}
        </div>
      )}

      {/* ── VEHICLES ─────────────────────────────────────────────────────── */}
      {view === 'step2' && (
        <div style={{ padding: '16px' }}>
          {loading ? <Spinner /> : vehicles.length === 0 ? <EmptyState message="No vehicles found" /> : (
            <SectionCard>
              {vehicles.map((v, i) => (
                <ListItem
                  key={v}
                  primary={v}
                  last={i === vehicles.length - 1}
                  onClick={() => selectVehicle(v)}
                />
              ))}
            </SectionCard>
          )}
        </div>
      )}

      {/* ── CATEGORIES ───────────────────────────────────────────────────── */}
      {view === 'step3' && (
        <div style={{ padding: '16px' }}>
          {loading ? <Spinner /> : categories.length === 0 ? <EmptyState message="No categories found" /> : (
            <SectionCard>
              {categories.map((cat, i) => (
                <ListItem
                  key={cat.name}
                  primary={getCategoryLabel(cat.name)}
                  right={<CountBadge count={cat.count} />}
                  last={i === categories.length - 1}
                  onClick={() => selectCategory(cat.name)}
                />
              ))}
            </SectionCard>
          )}
        </div>
      )}

      {/* ── RESULTS ──────────────────────────────────────────────────────── */}
      {view === 'results' && (
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: 13, color: C.steel, marginBottom: 16, fontFamily: FONT }}>
            {selectedMake} · {selectedVehicle} · {catLabel}
          </div>

          {loading ? <Spinner /> : (exactParts.length === 0 && generalParts.length === 0) ? (
            <EmptyState message="No parts found for this combination" />
          ) : (
            <>
              {exactParts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <SectionLabel text={`${selectedVehicle} — ${exactParts.length} part${exactParts.length !== 1 ? 's' : ''}`} />
                  <SectionCard>
                    {exactParts.map((part, i) => (
                      <PartCard
                        key={part.id}
                        part={part}
                        vehicle={selectedVehicle}
                        last={i === exactParts.length - 1}
                        onEdit={p => setModal({ mode: 'edit', part: p })}
                        latestPrice={latestPriceMap[part.id]}
                      />
                    ))}
                  </SectionCard>
                </div>
              )}
              {generalParts.length > 0 && (
                <div>
                  <SectionLabel text={`General Parts — ${generalParts.length} part${generalParts.length !== 1 ? 's' : ''}`} />
                  <SectionCard>
                    {generalParts.map((part, i) => (
                      <PartCard
                        key={part.id}
                        part={part}
                        vehicle="General"
                        last={i === generalParts.length - 1}
                        onEdit={p => setModal({ mode: 'edit', part: p })}
                        latestPrice={latestPriceMap[part.id]}
                      />
                    ))}
                  </SectionCard>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SEARCH RESULTS ───────────────────────────────────────────────── */}
      {view === 'search' && (
        <div>
          <div style={{
            padding: '12px 16px',
            background: C.canvas,
            borderBottom: `1px solid ${C.line}`,
          }}>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQ}
              onChange={e => {
                const q = e.target.value
                setSearchQ(q)
                if (!q.trim()) goHome()
              }}
              placeholder='Search vehicle or part...'
              style={{
                width: '100%', boxSizing: 'border-box',
                height: 44, padding: '0 14px',
                border: `1px solid ${C.line}`,
                borderRadius: 8, fontSize: 15,
                color: C.ink, background: C.bg,
                outline: 'none', fontFamily: FONT,
              }}
            />
          </div>

          <div style={{ padding: '16px' }}>
            {loading ? <Spinner /> : searchError ? (
              <div style={{ fontSize: 13, color: C.error, padding: '24px 4px', fontFamily: FONT }}>
                {searchError}
              </div>
            ) : searchResults.length === 0 ? (
              searchQ.trim() ? <EmptyState message={`No parts found for "${searchQ}"`} /> : null
            ) : (
              searchResults.map(({ vehicle, parts }) => (
                <div key={vehicle} style={{ marginBottom: 16 }}>
                  <SectionLabel text={vehicle} />
                  <SectionCard>
                    {parts.map((part, i) => (
                      <PartCard
                        key={part.id}
                        part={part}
                        vehicle={vehicle}
                        last={i === parts.length - 1}
                        onEdit={p => setModal({ mode: 'edit', part: p })}
                        latestPrice={latestPriceMap[part.id]}
                      />
                    ))}
                  </SectionCard>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {modal && (
        <AddPartModal
          part={modal.part}
          contextVehicle={selectedVehicle}
          contextMake={selectedMake}
          makes={makesForModal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

    </div>
  )
}
