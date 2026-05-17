import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, createInvoice, generateInvoiceNo, searchVehiclesAndCustomers, upsertCustomer, addVehicle, getVehicleMakes, getVehicleModels } from '../lib/supabase'
import { Clock, Wrench, Package, CheckCircle2, CircleDollarSign, Columns3, RefreshCw, Plus } from 'lucide-react'

const COLUMNS = [
  { key: 'waiting',   label: 'Waiting',   long: 'Waiting 等待检查',    Icon: Clock,            color: '#6B7280', bg: '#F9FAFB' },
  { key: 'repairing', label: 'Repairing', long: 'Repairing 维修中',    Icon: Wrench,           color: '#2563EB', bg: '#EFF6FF' },
  { key: 'parts',     label: 'Parts',     long: 'Parts Pending 等零件', Icon: Package,          color: '#D97706', bg: '#FFFBEB' },
  { key: 'completed', label: 'Completed', long: 'Completed 已完成',    Icon: CheckCircle2,     color: '#16A34A', bg: '#F0FDF4' },
  { key: 'paid',      label: 'Paid',      long: 'Paid 已收款',          Icon: CircleDollarSign, color: '#D85A30', bg: '#FFF3EF' },
]

const ADVISORS  = ['JON', 'JIMMY', 'MENG', 'IVY', 'NORMAN', 'XIN', 'ZHU', 'TAO', 'XIONG']
const MECHANICS = ['NORMAN', 'XIN', 'ZHU', 'TAO', 'XIONG', 'MENG']

const toTitleCase = (s) => s.replace(/\b\w/g, c => c.toUpperCase())

// ── Helpers ──────────────────────────────────────────────────────────────────
function mergeSearchResults({ vehicles, customers }) {
  const seenIds = new Set()
  const items = []
  for (const v of vehicles) {
    if (seenIds.has(v.id)) continue
    seenIds.add(v.id)
    items.push({
      type: 'vehicle', vehicleId: v.id,
      customerId: v.customers?.id ?? null,
      car_plate: v.car_plate ?? '',
      customer_name: v.customers?.name ?? '',
      car_make: v.car_make ?? '', car_model: v.car_model ?? '',
    })
  }
  for (const c of customers) {
    const cvs = (c.vehicles || []).filter(v => v.car_plate && !seenIds.has(v.id))
    if (!cvs.length) continue
    if (cvs.length > 1) items.push({ type: 'group', customer_name: c.name })
    for (const v of cvs) {
      seenIds.add(v.id)
      items.push({
        type: 'vehicle', vehicleId: v.id, customerId: c.id,
        car_plate: v.car_plate ?? '', customer_name: c.name,
        car_make: v.car_make ?? '', car_model: v.car_model ?? '',
      })
    }
  }
  return items
}

// ── ComboBox ─────────────────────────────────────────────────────────────────
function ComboBox({ value, onChange, suggestions, placeholder, transform, disabled }) {
  const [input, setInput]   = useState(value)
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef(null)

  // Sync when parent resets value
  useEffect(() => { setInput(value) }, [value])

  useEffect(() => {
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()))

  const commit = (val) => {
    const out = transform ? transform(val) : val
    setInput(out)
    onChange(out)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      <input
        value={input}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => { setInput(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (transform && input) { const out = transform(input); setInput(out); onChange(out) } }}
        style={{ width:'100%', boxSizing:'border-box' }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position:'absolute', top:'calc(100% + 2px)', left:0, right:0, zIndex:300,
          background:'#fff', borderRadius:8, border:'1px solid #e3e8ee',
          boxShadow:'rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px',
          maxHeight:200, overflowY:'auto',
        }}>
          {filtered.map(s => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); commit(s) }}
              style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', color:'#0d253d' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f6f9fc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{s}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vehicle Search Box ────────────────────────────────────────────────────────
function VehicleSearchBox({ selected, onSelect, onClear, onCreateNew }) {
  const [query, setQuery]           = useState('')
  const [rawResults, setRawResults] = useState(null)
  const [searching, setSearching]   = useState(false)
  const [open, setOpen]             = useState(false)
  const [focused, setFocused]       = useState(false)
  const containerRef                = useRef(null)

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setRawResults(null); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const res = await searchVehiclesAndCustomers(query.trim())
      setRawResults(res)
      setSearching(false)
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) { setOpen(false); setFocused(false) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = rawResults ? mergeSearchResults(rawResults) : []
  const noResults = rawResults && items.filter(i => i.type === 'vehicle').length === 0
  const showHint = focused && (!query.trim() || searching)

  if (selected) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:9, background:'#f6f9fc', border:'1px solid #e3e8ee' }}>
        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:14, color:'var(--orange)', letterSpacing:'.5px' }}>
          {selected.car_plate}
        </span>
        <span style={{ fontSize:12, color:'#0d253d', fontWeight:600 }}>· {selected.customer_name}</span>
        {(selected.car_make || selected.car_model) && (
          <span style={{ fontSize:11, color:'#64748d' }}>{selected.car_make} {selected.car_model}</span>
        )}
        <button
          type="button"
          onClick={onClear}
          style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#64748d', fontSize:16, lineHeight:1, padding:'0 2px' }}
        >×</button>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position:'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search 搜索车牌 / 客户名…"
        autoFocus
        style={{ width:'100%', boxSizing:'border-box' }}
      />
      {searching && (
        <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)' }}>
          <div style={{ width:12, height:12, border:'2px solid var(--orange)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .6s linear infinite' }} />
        </div>
      )}
      {showHint && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
          background:'#fff', borderRadius:10, border:'1px solid #e3e8ee',
          boxShadow:'rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px',
          padding:'10px 14px',
        }}>
          <div style={{ fontSize:11, color:'#94a3b8', lineHeight:1.6 }}>
            搜索车牌号、客户名，或两者结合缩小范围<br />
            <span style={{ color:'#b0bec5' }}>e.g. "matin 3799" · "toyota wish" · "SKA123"</span>
          </div>
        </div>
      )}
      {open && query.trim() && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
          background:'#fff', borderRadius:10, border:'1px solid #e3e8ee',
          boxShadow:'rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px',
          maxHeight:320, overflowY:'auto',
        }}>
          {items.map((item, i) => {
            if (item.type === 'group') {
              return (
                <div key={`g-${i}`} style={{ padding:'6px 12px 2px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'#64748d', background:'#f6f9fc' }}>
                  {item.customer_name}
                </div>
              )
            }
            return (
              <div
                key={item.vehicleId}
                onMouseDown={e => { e.preventDefault(); onSelect(item); setOpen(false); setQuery('') }}
                style={{ padding:'9px 14px', cursor:'pointer', borderTop: i > 0 && items[i-1].type !== 'group' ? '1px solid #f0f2f5' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f6f9fc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:13, color:'var(--orange)', letterSpacing:'.5px' }}>{item.car_plate}</span>
                  <span style={{ fontSize:13, color:'#0d253d', fontWeight:600 }}>{item.customer_name}</span>
                </div>
                {(item.car_make || item.car_model) && (
                  <div style={{ fontSize:11, color:'#64748d', marginTop:1 }}>{item.car_make} {item.car_model}</div>
                )}
              </div>
            )
          })}
          {noResults && (
            <div style={{ padding:'10px 14px' }}>
              <div style={{ fontSize:12, color:'#64748d', marginBottom:8 }}>No results found 没有找到</div>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); onCreateNew(query.trim()); setOpen(false) }}
                style={{ fontSize:12, fontWeight:600, color:'var(--orange)', background:'none', border:'1px solid var(--orange)', borderRadius:9999, padding:'4px 12px', cursor:'pointer' }}
              >+ Create new 新建客户</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── New Job Modal ────────────────────────────────────────────────────────────
function NewJobModal({ onClose, onSave }) {
  const [selected, setSelected] = useState(null)
  const [isNew, setIsNew]       = useState(false)
  const [newPlate, setNewPlate] = useState('')
  const [newName, setNewName]   = useState('')
  const [newMake, setNewMake]   = useState('')
  const [newModel, setNewModel] = useState('')
  const [makeSugs, setMakeSugs] = useState([])
  const [modelSugs, setModelSugs] = useState([])
  const [form, setForm] = useState({
    advisor:         '',
    mechanic:        '',
    mileage:         '',
    job_description: '',
    initial_status:  'waiting',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Load makes once when new-customer panel opens
  useEffect(() => {
    if (!isNew) return
    getVehicleMakes().then(({ data }) => {
      if (data) setMakeSugs([...new Set(data.map(r => r.car_make).filter(Boolean))].sort())
    })
  }, [isNew])

  // Reload models when make changes
  useEffect(() => {
    if (!newMake.trim()) { setModelSugs([]); return }
    const t = setTimeout(() => {
      getVehicleModels(newMake.trim()).then(({ data }) => {
        if (data) setModelSugs([...new Set(data.map(r => r.car_model).filter(Boolean))].sort())
      })
    }, 300)
    return () => clearTimeout(t)
  }, [newMake])

  const handleCreateNew = (q) => {
    setIsNew(true)
    // Pre-fill plate if query looks like a plate (alphanumeric, no spaces)
    if (/^[A-Za-z0-9]+$/.test(q)) setNewPlate(q.toUpperCase())
    else setNewName(q)
  }

  const save = async () => {
    const plate = (selected?.car_plate || newPlate).trim().toUpperCase()
    if (!plate) { alert('Car plate is required. 请输入车牌。'); return }
    setSaving(true)
    try {
      let customerId = selected?.customerId ?? null
      let vehicleId  = selected?.vehicleId  ?? null

      if (isNew) {
        const { data: cust } = await upsertCustomer({
          name:      newName.trim() || null,
          car_plate: plate,
          car_make:  newMake.trim()  || null,
          car_model: newModel.trim() || null,
        })
        if (cust?.id) {
          customerId = cust.id
          const { data: veh } = await addVehicle({
            customer_id: cust.id,
            car_plate:   plate,
            car_make:    newMake.trim()  || null,
            car_model:   newModel.trim() || null,
            is_primary:  true,
          })
          vehicleId = veh?.id ?? null
        }
      }

      const invNo = await generateInvoiceNo()
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })

      await createInvoice({
        customer_id:     customerId,
        vehicle_id:      vehicleId,
        invoice_no:      invNo,
        date:            today,
        advisor:         form.advisor         || null,
        mechanic:        form.mechanic        || null,
        mileage:         form.mileage         || null,
        notes:           form.job_description.trim() || null,
        work_order_only: true,
        work_status:     form.initial_status,
        status:          'draft',
        total:           0,
      }, [])

      onSave()
    } catch (err) {
      alert('Error saving job: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h3 style={{ display:'flex', alignItems:'center', gap:7 }}>
            <Plus size={14} /> New Job 新工单
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          {/* Unified vehicle search */}
          <div className="form-row">
            <label>Search 搜索车牌 / 客户名 *</label>
            <VehicleSearchBox
              selected={selected}
              onSelect={v => { setSelected(v); setIsNew(false) }}
              onClear={() => { setSelected(null); setIsNew(false) }}
              onCreateNew={handleCreateNew}
            />
          </div>

          {/* New customer fields */}
          {isNew && (
            <div style={{ background:'#fff8f0', border:'1px solid #ffe0c0', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--orange)', marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
                <Plus size={11} /> New customer 新客户
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Car Plate 车牌 *</label>
                  <input value={newPlate} onChange={e => setNewPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. SKA1234A"
                    style={{ fontFamily:'monospace', fontWeight:700, letterSpacing:'.5px' }} />
                </div>
                <div className="form-row">
                  <label>Customer Name 客户名</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Tan Wei Ming" />
                </div>
                <div className="form-row">
                  <label>Make 品牌</label>
                  <ComboBox
                    value={newMake}
                    onChange={v => { setNewMake(v); setNewModel('') }}
                    suggestions={makeSugs}
                    placeholder="e.g. Toyota"
                    transform={toTitleCase}
                  />
                </div>
                <div className="form-row">
                  <label>Model 型号</label>
                  <ComboBox
                    value={newModel}
                    onChange={setNewModel}
                    suggestions={modelSugs}
                    placeholder="e.g. WISH"
                    transform={s => s.toUpperCase()}
                    disabled={!newMake.trim()}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-row">
              <label>Advisor 顾问</label>
              <select value={form.advisor} onChange={set('advisor')}>
                <option value="">— select —</option>
                {ADVISORS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Mechanic 技师</label>
              <select value={form.mechanic} onChange={set('mechanic')}>
                <option value="">— select —</option>
                {MECHANICS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Mileage 里程</label>
              <input value={form.mileage} onChange={set('mileage')} placeholder="e.g. 85000" type="number" min="0" />
            </div>
            <div className="form-row">
              <label>Initial Status 初始状态</label>
              <select value={form.initial_status} onChange={set('initial_status')}>
                {COLUMNS.filter(c => c.key !== 'paid').map(c => (
                  <option key={c.key} value={c.key}>{c.long}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <label>Job Description 工作描述</label>
            <textarea
              value={form.job_description}
              onChange={set('job_description')}
              placeholder="Describe what needs to be done today... 描述今天的工作内容"
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel 取消</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Creating...' : '+ Create Job 创建工单'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ card, col, columns, dragging, onDragStart, onDragEnd, onMove, onSelectCustomer }) {
  const [expanded, setExpanded] = useState(false)
  const items = card.invoice_items || []
  const c     = card.customers   || {}

  const colIdx = columns.findIndex(x => x.key === col.key)
  const prevCol = colIdx > 0                  ? columns[colIdx - 1] : null
  const nextCol = colIdx < columns.length - 1 ? columns[colIdx + 1] : null

  const isWorkOrder = !!card.work_order_only

  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={e => onDragStart(e, card.id)}
      onDragEnd={onDragEnd}
      style={{ opacity: dragging ? .4 : 1, borderLeft: `3px solid ${col.color}`, cursor: 'grab' }}>

      {/* WORK ORDER badge */}
      {isWorkOrder && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
            background: '#fff0e6', color: 'var(--orange)', padding: '2px 8px', borderRadius: 9999,
          }}>WORK ORDER</span>
        </div>
      )}

      {/* Customer + Plate */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:4 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {c.name || '—'}
          </div>
          <div style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700, marginTop:1 }}>
            {c.car_plate || '—'}
          </div>
        </div>
        {!isWorkOrder && (
          <div style={{ fontSize:11, fontWeight:700, color:'var(--orange)', flexShrink:0 }}>
            ${parseFloat(card.total || 0).toFixed(0)}
          </div>
        )}
      </div>

      {/* Car model */}
      {(c.car_make || c.car_model) && (
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{c.car_make} {c.car_model}</div>
      )}

      {/* Work order: job description */}
      {isWorkOrder && card.notes && (
        <div style={{
          fontSize:11, color:'var(--text2)', marginBottom:6,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
        }}>
          {card.notes}
        </div>
      )}

      {/* Regular invoice: services preview */}
      {!isWorkOrder && (
        <>
          {items.slice(0, 2).map((it, i) => (
            <div key={i} style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              · {it.description}
            </div>
          ))}
          {items.length > 2 && !expanded && (
            <div style={{ fontSize:11, color:'var(--orange)', cursor:'pointer', marginTop:2 }}
              onClick={() => setExpanded(true)}>+{items.length - 2} more...</div>
          )}
          {expanded && items.slice(2).map((it, i) => (
            <div key={i} style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              · {it.description}
            </div>
          ))}
        </>
      )}

      {/* Advisor / Mechanic */}
      {(card.advisor || card.mechanic) && (
        <div style={{ fontSize:11, color:'var(--text2)', marginTop:4, marginBottom:2 }}>
          {card.advisor  && <div style={{ display:'flex', alignItems:'center', gap:3 }}><Wrench size={9} /> Advisor: {card.advisor}</div>}
          {card.mechanic && <div style={{ display:'flex', alignItems:'center', gap:3 }}><Wrench size={9} /> Mechanic: {card.mechanic}</div>}
        </div>
      )}

      {/* Footer: invoice no + status / convert button */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, gap:6 }}>
        <span style={{ fontSize:10, fontWeight:600, color:'var(--text3)' }}>{card.invoice_no}</span>
        {isWorkOrder ? (
          <button
            onClick={() => card.customer_id && onSelectCustomer?.(card.customer_id)}
            disabled={!card.customer_id}
            style={{
              fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:9999,
              border:'1px solid var(--orange)', color:'var(--orange)', background:'transparent',
              cursor: card.customer_id ? 'pointer' : 'not-allowed',
              opacity: card.customer_id ? 1 : 0.4,
              display:'flex', alignItems:'center', gap:3,
            }}>
            Convert ›
          </button>
        ) : (
          <span style={{
            fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20,
            background: card.status==='paid'?'var(--green-light)': card.status==='confirmed'?'var(--blue-light)':'#F3F4F6',
            color:      card.status==='paid'?'var(--green)':      card.status==='confirmed'?'var(--blue)':      '#6B7280',
          }}>{card.status === 'paid' ? 'Paid' : card.status === 'confirmed' ? 'Confirmed' : 'Draft'}</span>
        )}
      </div>

      {/* Move buttons */}
      <div style={{ display:'flex', gap:4, marginTop:8 }}>
        {prevCol && (
          <button onClick={() => onMove(card.id, prevCol.key)} style={{
            flex:1, padding:'4px', fontSize:10, fontWeight:600,
            border:`1px solid ${prevCol.color}40`, borderRadius:6, background:prevCol.bg,
            cursor:'pointer', color:prevCol.color, transition:'filter .15s', fontFamily:'inherit',
          }}>← {prevCol.label}</button>
        )}
        {nextCol && (
          <button onClick={() => onMove(card.id, nextCol.key)} style={{
            flex:1, padding:'4px', fontSize:10, fontWeight:600,
            border:`1px solid ${nextCol.color}40`, borderRadius:6, background:nextCol.bg,
            cursor:'pointer', color:nextCol.color, transition:'filter .15s', fontFamily:'inherit',
          }}>{nextCol.label} →</button>
        )}
      </div>
    </div>
  )
}

// ── Main Kanban ──────────────────────────────────────────────────────────────
export default function Kanban({ onSelectCustomer }) {
  const [cards, setCards]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [dragId, setDragId]     = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [showNewJob, setShowNewJob] = useState(false)
  const [dateFilter, setDateFilter] = useState('today')

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('invoices')
      .select('id, invoice_no, date, total, status, work_status, work_order_only, notes, advisor, mechanic, mileage, customer_id, invoice_items(description), customers(id, name, car_plate, car_make, car_model)')
      .order('created_at', { ascending: true })
    q = dateFilter === 'today'
      ? q.eq('date', todayStr)
      : q.or('work_status.neq.paid,work_status.is.null')
    const { data } = await q
    setCards(data || [])
    setLoading(false)
  }, [dateFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const moveCard = async (cardId, newStatus) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, work_status: newStatus } : c))
    await supabase.from('invoices').update({ work_status: newStatus }).eq('id', cardId)
  }

  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move' }
  const onDragOver  = (e, col) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(col) }
  const onDrop      = (e, col) => { e.preventDefault(); if (dragId) moveCard(dragId, col); setDragId(null); setDragOver(null) }
  const onDragEnd   = () => { setDragId(null); setDragOver(null) }

  // Derive grouped during render — no useEffect needed
  const grouped = Object.fromEntries(COLUMNS.map(c => [c.key, []]))
  for (const card of cards) {
    const col = card.work_status || 'waiting'
    if (grouped[col]) grouped[col].push(card)
    else grouped['waiting'].push(card)
  }

  const totalJobs = cards.length
  const totalRev  = cards.filter(c => !c.work_order_only).reduce((a, c) => a + parseFloat(c.total || 0), 0)

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'14px 20px 10px', background:'var(--card)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, display:'flex', alignItems:'center', gap:8, fontFamily:"'Syne', sans-serif" }}>
              <Columns3 size={18} /> Work Board 今日工单看板
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
              {new Date().toLocaleDateString('en-SG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              {' · '}<span style={{ color:'var(--orange)', fontWeight:600 }}>{totalJobs} jobs</span>
              {totalRev > 0 && <>{' · '}Revenue: <span style={{ color:'var(--green)', fontWeight:600 }}>${totalRev.toFixed(2)}</span></>}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Date filter segmented control */}
            <div style={{
              display:'inline-flex', padding:3, borderRadius:9999,
              background:'#f6f9fc', border:'1px solid #e3e8ee',
            }}>
              {[['today', 'Today 今天'], ['active', 'All Active 所有未完成']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setDateFilter(val)} style={{
                  padding:'4px 14px', borderRadius:9999, border:'none',
                  background: dateFilter === val ? 'var(--orange)' : 'transparent',
                  color:      dateFilter === val ? '#fff'          : '#64748d',
                  fontSize:11, fontWeight:600, cursor:'pointer', transition:'.15s', whiteSpace:'nowrap',
                }}>{label}</button>
              ))}
            </div>

            <button className="btn" onClick={load} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <RefreshCw size={12} /> Refresh
            </button>

            <button className="btn btn-primary" onClick={() => setShowNewJob(true)}
              style={{ display:'flex', alignItems:'center', gap:5, fontSize:13 }}>
              <Plus size={13} /> New Job 新工单
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colCards   = grouped[col.key] || []
            const isDropTarget = dragOver === col.key
            return (
              <div key={col.key} className="kanban-col"
                onDragOver={e => onDragOver(e, col.key)}
                onDrop={e => onDrop(e, col.key)}
                onDragLeave={() => setDragOver(null)}
                style={{ outline: isDropTarget ? `2px dashed ${col.color}` : 'none', transition:'outline .1s' }}>

                <div className="kanban-col-header" style={{ color:col.color, borderBottom:`2px solid ${col.color}30` }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <col.Icon size={13} /> {col.long}
                  </span>
                  <span className="kanban-col-count">{colCards.length}</span>
                </div>

                <div className="kanban-cards">
                  {colCards.length === 0 && (
                    <div style={{ textAlign:'center', padding:'24px 8px', color:'var(--text3)', fontSize:12, border:'2px dashed var(--border)', borderRadius:'var(--radius)', margin:4 }}>
                      Drop cards here
                    </div>
                  )}
                  {colCards.map(card => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      col={col}
                      columns={COLUMNS}
                      dragging={dragId === card.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onMove={moveCard}
                      onSelectCustomer={onSelectCustomer}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ padding:'8px 20px', background:'var(--card)', borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'var(--text3)', fontWeight:600 }}>
          Drag cards between columns or use the arrow buttons 拖动或点击箭头移动工单
        </span>
        {COLUMNS.map(c => (
          <span key={c.key} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:c.bg, color:c.color }}>
            <c.Icon size={9} /> {grouped[c.key]?.length || 0}
          </span>
        ))}
      </div>

      {showNewJob && (
        <NewJobModal
          onClose={() => setShowNewJob(false)}
          onSave={() => { setShowNewJob(false); load() }}
        />
      )}
    </div>
  )
}
