import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, Wrench, Package, CheckCircle2, CircleDollarSign, Columns3, RefreshCw } from 'lucide-react'

const COLUMNS = [
  { key: 'waiting',   label: 'Waiting 等待检查',     Icon: Clock,            color: '#6B7280', bg: '#F9FAFB' },
  { key: 'repairing', label: 'Repairing 维修中',     Icon: Wrench,           color: '#2563EB', bg: '#EFF6FF' },
  { key: 'parts',     label: 'Parts Pending 等零件',  Icon: Package,          color: '#D97706', bg: '#FFFBEB' },
  { key: 'completed', label: 'Completed 已完成',     Icon: CheckCircle2,     color: '#16A34A', bg: '#F0FDF4' },
  { key: 'paid',      label: 'Paid 已收款',          Icon: CircleDollarSign, color: '#D85A30', bg: '#FFF3EF' },
]

const COL_MAP = Object.fromEntries(COLUMNS.map(c => [c.key, c]))

const statusLabels = {
  draft:     'Draft',
  confirmed: 'Confirmed',
  paid:      'Paid',
}

export default function Kanban() {
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId]   = useState(null)
  const [dragOver, setDragOver] = useState(null)

  // Use Singapore timezone (UTC+8) for today's date
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_no, date, total, status, work_status, technician, advisor, invoice_items(description), customers(name, car_plate, car_make, car_model)')
      .eq('date', todayStr)
      .order('created_at', { ascending: true })
    setCards(data || [])
    setLoading(false)
  }

  async function moveCard(cardId, newStatus) {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, work_status: newStatus } : c))
    await supabase.from('invoices').update({ work_status: newStatus }).eq('id', cardId)
  }

  // Drag handlers
  const onDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e, col) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(col)
  }
  const onDrop = (e, col) => {
    e.preventDefault()
    if (dragId) moveCard(dragId, col)
    setDragId(null); setDragOver(null)
  }
  const onDragEnd = () => { setDragId(null); setDragOver(null) }

  const grouped = Object.fromEntries(COLUMNS.map(c => [c.key, []]))
  for (const card of cards) {
    const col = card.work_status || 'waiting'
    if (grouped[col]) grouped[col].push(card)
    else grouped['waiting'].push(card)
  }

  const totalToday = cards.length
  const totalRev = cards.reduce((a, c) => a + parseFloat(c.total || 0), 0)

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 20px 10px', background:'var(--card)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, display:'flex', alignItems:'center', gap:8, fontFamily:"'Syne', sans-serif" }}><Columns3 size={18} /> Work Board 今日工单看板</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
              {new Date().toLocaleDateString('en-SG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              {' · '}<span style={{ color:'var(--orange)', fontWeight:600 }}>{totalToday} jobs</span>
              {' · '}Revenue: <span style={{ color:'var(--green)', fontWeight:600 }}>${totalRev.toFixed(2)}</span>
            </div>
          </div>
          <button className="btn" onClick={load} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12 }}><RefreshCw size={12} /> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colCards = grouped[col.key] || []
            const isDropTarget = dragOver === col.key
            return (
              <div key={col.key} className="kanban-col"
                onDragOver={e => onDragOver(e, col.key)}
                onDrop={e => onDrop(e, col.key)}
                onDragLeave={() => setDragOver(null)}
                style={{
                  outline: isDropTarget ? `2px dashed ${col.color}` : 'none',
                  transition: 'outline .1s',
                }}>
                <div className="kanban-col-header" style={{ color: col.color, borderBottom: `2px solid ${col.color}30` }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><col.Icon size={13} /> {col.label}</span>
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
        <span style={{ fontSize:11, color:'var(--text3)', fontWeight:600 }}>Tip: Drag cards between columns or use the arrow buttons 拖动或点击箭头移动工单</span>
        {COLUMNS.map(c => (
          <span key={c.key} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:c.bg, color:c.color }}>
            <c.Icon size={9} /> {grouped[c.key]?.length || 0}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ card, col, columns, dragging, onDragStart, onDragEnd, onMove }) {
  const [expanded, setExpanded] = useState(false)
  const items = card.invoice_items || []
  const c = card.customers || {}

  const colIdx = columns.findIndex(c => c.key === col.key)
  const prevCol = colIdx > 0 ? columns[colIdx - 1] : null
  const nextCol = colIdx < columns.length - 1 ? columns[colIdx + 1] : null

  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={e => onDragStart(e, card.id)}
      onDragEnd={onDragEnd}
      style={{
        opacity: dragging ? .4 : 1,
        borderLeft: `3px solid ${col.color}`,
        cursor: 'grab',
      }}>

      {/* Customer + Plate */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:6 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {c.name || '—'}
          </div>
          <div style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700, marginTop:1 }}>
            {c.car_plate}
          </div>
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--orange)', flexShrink:0 }}>
          ${parseFloat(card.total || 0).toFixed(0)}
        </div>
      </div>

      {/* Car model */}
      {(c.car_make || c.car_model) && (
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{c.car_make} {c.car_model}</div>
      )}

      {/* Technician */}
      {card.technician && (
        <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6, display:'flex', alignItems:'center', gap:3 }}><Wrench size={9} />{card.technician}</div>
      )}

      {/* Services preview */}
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

      {/* Invoice badge + status */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, gap:6 }}>
        <span style={{ fontSize:10, fontWeight:600, color:'var(--text3)' }}>{card.invoice_no}</span>
        <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20,
          background: card.status==='paid'?'var(--green-light)': card.status==='confirmed'?'var(--blue-light)':'#F3F4F6',
          color: card.status==='paid'?'var(--green)': card.status==='confirmed'?'var(--blue)':'#6B7280',
        }}>{statusLabels[card.status] || card.status}</span>
      </div>

      {/* Move buttons */}
      <div style={{ display:'flex', gap:4, marginTop:8 }}>
        {prevCol && (
          <button onClick={() => onMove(card.id, prevCol.key)}
            className="kanban-move-btn"
            style={{ '--btn-hover-bg': prevCol.bg }}
          >← {prevCol.icon}</button>
        )}
        {nextCol && (
          <button onClick={() => onMove(card.id, nextCol.key)} style={{
            flex:1, padding:'4px', fontSize:10, fontWeight:600,
            border:`1px solid ${nextCol.color}40`, borderRadius:6, background:nextCol.bg,
            cursor:'pointer', color:nextCol.color,
            transition:'filter .15s', fontFamily:'inherit',
          }}>{nextCol.icon} →</button>
        )}
      </div>
    </div>
  )
}
