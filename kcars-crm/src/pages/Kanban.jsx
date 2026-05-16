import { useState, useEffect, useCallback } from 'react'
import { supabase, createInvoice, generateInvoiceNo, getCustomerByVehiclePlate, upsertCustomer, addVehicle } from '../lib/supabase'
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

// ── New Job Modal ────────────────────────────────────────────────────────────
function NewJobModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    car_plate:       '',
    customer_name:   '',
    car_make:        '',
    car_model:       '',
    advisor:         '',
    mechanic:        '',
    mileage:         '',
    job_description: '',
    initial_status:  'waiting',
  })
  const [lookup, setLookup]       = useState(null) // null | {found,vehicle,customer} | {found:false}
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving]       = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Debounced plate lookup
  useEffect(() => {
    const plate = form.car_plate.trim().toUpperCase()
    if (plate.length < 3) { setLookup(null); return }
    const t = setTimeout(async () => {
      setLookingUp(true)
      const { data } = await getCustomerByVehiclePlate(plate)
      if (data) {
        setLookup({ found: true, vehicle: data, customer: data.customers })
        setForm(f => ({
          ...f,
          customer_name: data.customers?.name || f.customer_name,
          car_make:      data.car_make        || f.car_make,
          car_model:     data.car_model       || f.car_model,
        }))
      } else {
        setLookup({ found: false })
      }
      setLookingUp(false)
    }, 400)
    return () => clearTimeout(t)
  }, [form.car_plate])

  const save = async () => {
    if (!form.car_plate.trim()) { alert('Car plate is required. 请输入车牌。'); return }
    setSaving(true)
    try {
      let customerId = lookup?.found ? lookup.customer?.id ?? null : null
      const plate = form.car_plate.trim().toUpperCase()

      if (!customerId && form.customer_name.trim()) {
        const { data: cust } = await upsertCustomer({
          name:      form.customer_name.trim(),
          car_plate: plate,
          car_make:  form.car_make.trim()  || null,
          car_model: form.car_model.trim() || null,
        })
        if (cust?.id) {
          await addVehicle({
            customer_id: cust.id,
            car_plate:   plate,
            car_make:    form.car_make.trim()  || null,
            car_model:   form.car_model.trim() || null,
            is_primary:  true,
          })
          customerId = cust.id
        }
      }

      const invNo  = await generateInvoiceNo()
      const today  = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })

      await createInvoice({
        customer_id:     customerId,
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

  const foundCustomer = lookup?.found && lookup.customer
  const isNew = lookup?.found === false

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

          {/* Car Plate + lookup */}
          <div className="form-row">
            <label>Car Plate 车牌 *</label>
            <input
              value={form.car_plate}
              onChange={set('car_plate')}
              placeholder="e.g. SKA1234A"
              style={{ textTransform:'uppercase', fontFamily:'monospace', fontWeight:700, fontSize:15, letterSpacing:'.5px' }}
              autoFocus
            />
          </div>

          {/* Lookup status chip */}
          {(lookingUp || lookup) && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12,
              background: lookingUp ? '#f6f9fc'
                : foundCustomer ? '#eaf3de'
                : '#fff8f0',
              color: lookingUp ? '#64748d'
                : foundCustomer ? '#1a7f37'
                : 'var(--orange)',
              border: `1px solid ${lookingUp ? '#e3e8ee' : foundCustomer ? '#b8e0c2' : '#ffe0c0'}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {lookingUp && <div style={{ width:12, height:12, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .6s linear infinite', flexShrink:0 }} />}
              {!lookingUp && foundCustomer && (
                <>
                  <CheckCircle2 size={13} />
                  <span><strong>{foundCustomer.name}</strong>
                    {(lookup.vehicle.car_make || lookup.vehicle.car_model) && ` · ${[lookup.vehicle.car_make, lookup.vehicle.car_model].filter(Boolean).join(' ')}`}
                    {lookup.vehicle.car_year && ` ${lookup.vehicle.car_year}`}
                  </span>
                </>
              )}
              {!lookingUp && isNew && (
                <>
                  <Plus size={13} />
                  <span>New customer — fill in details below 新客户，请填写信息</span>
                </>
              )}
              {lookingUp && <span>Looking up plate...</span>}
            </div>
          )}

          <div className="form-grid">
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Customer Name 客户名</label>
              <input
                value={form.customer_name}
                onChange={set('customer_name')}
                placeholder={foundCustomer ? foundCustomer.name : 'e.g. Tan Wei Ming'}
                readOnly={!!foundCustomer}
                style={{ background: foundCustomer ? '#f6f9fc' : undefined, color: foundCustomer ? '#64748d' : undefined }}
              />
            </div>
            <div className="form-row">
              <label>Make 品牌</label>
              <input value={form.car_make} onChange={set('car_make')} placeholder="e.g. Toyota"
                readOnly={!!foundCustomer && !!form.car_make}
                style={{ background: (foundCustomer && form.car_make) ? '#f6f9fc' : undefined, color: (foundCustomer && form.car_make) ? '#64748d' : undefined }} />
            </div>
            <div className="form-row">
              <label>Model 型号</label>
              <input value={form.car_model} onChange={set('car_model')} placeholder="e.g. Wish"
                readOnly={!!foundCustomer && !!form.car_model}
                style={{ background: (foundCustomer && form.car_model) ? '#f6f9fc' : undefined, color: (foundCustomer && form.car_model) ? '#64748d' : undefined }} />
            </div>
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
