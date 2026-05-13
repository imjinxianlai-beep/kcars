import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { FileText, DollarSign, UserPlus, Users, AlertCircle, Calendar, TrendingUp, Trophy, Clock, Zap, RefreshCw, Bell, BarChart2, Columns3 } from 'lucide-react'

const fmt  = (n) => `$${parseFloat(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`
const fmtK = (n) => {
  const v = parseFloat(n || 0)
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
}

export default function Dashboard({ onNavigate }) {
  const [today, setToday]     = useState(null)
  const [chart, setChart]     = useState([])
  const [techs, setTechs]     = useState([])
  const [recent, setRecent]   = useState([])
  const [loading, setLoading] = useState(true)

  const todayStr  = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const monthStr  = todayStr.slice(0, 7)
  const monthStart = `${monthStr}-01`
  const monthEnd   = (() => { const d = new Date(`${monthStr}-01`); d.setMonth(d.getMonth()+1); d.setDate(0); return d.toISOString().split('T')[0] })()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const [todayRes, monthRes, recentRes, unpaidRes, newCustRes] = await Promise.all([
      // Today invoices
      supabase.from('invoices').select('id, total, status, customer_id')
        .eq('date', todayStr),
      // This month all invoices for chart + tech rankings
      supabase.from('invoices').select('id, date, total, status, technician, advisor, customers(name, car_plate)')
        .gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: true }),
      // Recent 10 invoices
      supabase.from('invoices').select('id, invoice_no, date, total, status, customers(name, car_plate)')
        .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(10),
      // Unpaid total
      supabase.from('invoices').select('total').neq('status', 'paid'),
      // New customers this month
      supabase.from('customers').select('id', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00`),
    ])

    const todayInv = todayRes.data || []
    const monthInv = monthRes.data || []

    // Today KPIs
    setToday({
      invoices:   todayInv.length,
      revenue:    todayInv.reduce((a, i) => a + parseFloat(i.total || 0), 0),
      newCustomers: newCustRes.count || 0,
      unpaid:     (unpaidRes.data || []).reduce((a, i) => a + parseFloat(i.total || 0), 0),
    })

    // Build daily revenue chart for this month
    const daysInMonth = new Date(monthEnd).getDate()
    const dayMap = {}
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${monthStr}-${String(d).padStart(2, '0')}`
      dayMap[key] = 0
    }
    for (const inv of monthInv) {
      if (dayMap[inv.date] !== undefined) dayMap[inv.date] += parseFloat(inv.total || 0)
    }
    setChart(Object.entries(dayMap).map(([date, revenue]) => ({ date, revenue, day: parseInt(date.split('-')[2]) })))

    // Technician rankings (by mechanic field)
    const techMap = {}
    for (const inv of monthInv) {
      const t = (inv.technician || '').split(',').map(s => s.trim()).filter(Boolean)
      for (const name of t) {
        if (!techMap[name]) techMap[name] = { name, jobs: 0, revenue: 0 }
        techMap[name].jobs++
        techMap[name].revenue += parseFloat(inv.total || 0)
      }
    }
    setTechs(Object.values(techMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5))

    setRecent(recentRes.data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="spinner" />
    </div>
  )

  const monthRevenue = chart.reduce((a, c) => a + c.revenue, 0)
  const monthInvoices = recent.length // approximation

  return (
    <div style={{ height:'100%', overflow:'auto' }}>
      <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-.3px', fontFamily:"'Syne', sans-serif" }}>
            Dashboard 总览
          </div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
            {new Date().toLocaleDateString('en-SG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>

        {/* ── Today KPIs ── */}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:10 }}>
          <Calendar size={11} /> Today 今日概览
        </div>
        <motion.div className="dash-grid" style={{ marginBottom:24 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09 } } }}
          initial="hidden"
          animate="visible">
          {[
            { label: "Today's Invoices 今日发票",    value: today?.invoices ?? 0,     Icon: FileText,    color: '#2563EB' },
            { label: "Today's Revenue 今日营业额",   value: fmt(today?.revenue),       Icon: DollarSign,  color: '#D85A30', big: true },
            { label: 'New Customers 本月新客户',     value: today?.newCustomers ?? 0, Icon: UserPlus,    color: '#16A34A', sub: 'This month' },
            { label: 'Unpaid Total 未收款',          value: fmt(today?.unpaid),        Icon: AlertCircle, color: '#DC2626', big: true, warn: today?.unpaid > 0 },
          ].map((props, i) => (
            <motion.div key={i}
              variants={{ hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { duration: 0.25 } } }}>
              <KpiCard {...props} />
            </motion.div>
          ))}
        </motion.div>

        {/* ── Revenue Chart ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16, marginBottom:20, alignItems:'start' }}>
          <div className="card" style={{ marginBottom:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:6 }}><TrendingUp size={14} /> Monthly Revenue 本月营业额</div>
                <div style={{ fontSize:12, color:'var(--text3)' }}>{monthStr} · Total: <span style={{ color:'var(--orange)', fontWeight:700 }}>{fmt(monthRevenue)}</span></div>
              </div>
              <button className="btn" style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }} onClick={load}><RefreshCw size={12} /></button>
            </div>
            <RevenueChart data={chart} />
          </div>

          {/* Technician Rankings */}
          <div className="card" style={{ marginBottom:0 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:6 }}><Trophy size={14} /> Technician Rankings 技师排行</div>
            {techs.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', padding:'20px 0' }}>No data this month</div>
            ) : techs.map((t, i) => (
              <TechRow key={t.name} tech={t} rank={i+1} maxRev={techs[0].revenue} />
            ))}
          </div>
        </div>

        {/* ── Recent Invoices ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div className="card" style={{ marginBottom:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:6 }}><Clock size={14} /> Recent Invoices 最近发票</div>
              <button className="btn btn-primary" style={{ fontSize:11 }}
                onClick={() => onNavigate?.('crm')}>
                View All →
              </button>
            </div>
            {recent.map(inv => (
              <div key={inv.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'8px 0', borderBottom:'1px solid var(--border2)', gap:8
              }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {inv.customers?.name || '—'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>
                    <span style={{ fontFamily:'monospace', color:'var(--orange)', fontWeight:700 }}>{inv.customers?.car_plate}</span>
                    {' · '}{inv.invoice_no}{' · '}{inv.date}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:700, color:'var(--orange)', fontSize:13 }}>{fmt(inv.total)}</div>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ marginBottom:0 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:6 }}><Zap size={14} /> Quick Actions 快捷操作</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <QuickAction Icon={Users} label="New Customer 新建客户" sub="Add a customer and vehicle" color="#2563EB" onClick={() => onNavigate?.('crm')} />
              <QuickAction Icon={FileText} label="Today's Invoices 今日工单" sub="View all invoices from today" color="#D85A30" onClick={() => onNavigate?.('reports')} />
              <QuickAction Icon={Bell} label="Service Reminders 保养提醒" sub="Check overdue & upcoming services" color="#16A34A" onClick={() => onNavigate?.('reminders')} />
              <QuickAction Icon={BarChart2} label="Reports 报表分析" sub="Revenue, vehicles, date queries" color="#6B7280" onClick={() => onNavigate?.('reports')} />
              <QuickAction Icon={Columns3} label="Work Board 今日工单看板" sub="View & manage active jobs" color="#D85A30" onClick={() => onNavigate?.('kanban')} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, color, big, warn, sub }) {
  const c = warn ? '#DC2626' : color
  return (
    <div className="dash-kpi" style={{ borderLeft: `3px solid ${c}` }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div className="dash-kpi-label">{label}</div>
        <div style={{ width:32, height:32, borderRadius:9, background:`${c}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={15} color={c} />
        </div>
      </div>
      <div className="dash-kpi-val" style={{ color: c, fontSize: big ? 22 : 26 }}>
        {value}
      </div>
      {sub && <div className="dash-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── Revenue Line Chart (pure SVG) ─────────────────────────────────────────────
function RevenueChart({ data }) {
  if (!data.length) return <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>No data</div>

  const W = 500, H = 140, PL = 50, PR = 10, PT = 10, PB = 30
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const maxVal = Math.max(...data.map(d => d.revenue), 1)
  const today  = new Date().getDate()

  const points = data.map((d, i) => ({
    x: PL + (i / (data.length - 1 || 1)) * chartW,
    y: PT + chartH - (d.revenue / maxVal) * chartH,
    ...d
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${points[points.length-1].x.toFixed(1)} ${(PT+chartH).toFixed(1)} L ${PL} ${(PT+chartH).toFixed(1)} Z`

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PT + chartH - f * chartH,
    label: fmtK(f * maxVal)
  }))

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1={PL} y1={l.y} x2={W-PR} y2={l.y} stroke="var(--border2)" strokeWidth="1" />
            <text x={PL-4} y={l.y+4} textAnchor="end" fontSize="9" fill="var(--text3)">{l.label}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Today marker */}
        {points.filter(p => p.day === today).map(p => (
          <circle key="today" cx={p.x} cy={p.y} r="4" fill="var(--orange)" stroke="#fff" strokeWidth="2" />
        ))}

        {/* X axis day labels (every 5 days) */}
        {points.filter(p => p.day % 5 === 1 || p.day === 1).map(p => (
          <text key={p.day} x={p.x} y={H-4} textAnchor="middle" fontSize="9" fill="var(--text3)">{p.day}</text>
        ))}
      </svg>
    </div>
  )
}

// ── Technician Row ────────────────────────────────────────────────────────────
function TechRow({ tech, rank, maxRev }) {
  const rankColors = ['#F59E0B', '#94A3B8', '#92400E']
  const rc = rank <= 3 ? rankColors[rank - 1] : undefined
  const pct = maxRev > 0 ? (tech.revenue / maxRev) * 100 : 0
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <div style={{
          width:22, height:22, borderRadius:'50%', flexShrink:0,
          background: rc ? `${rc}22` : 'var(--bg2)',
          color: rc || 'var(--text3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, fontWeight:800,
          border: rc ? `1.5px solid ${rc}60` : '1.5px solid var(--border)',
        }}>{rank}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:13 }}>{tech.name}</div>
          <div style={{ fontSize:11, color:'var(--text3)' }}>{tech.jobs} jobs · {fmt(tech.revenue)}</div>
        </div>
      </div>
      <div style={{ marginLeft:30, height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:'var(--orange)', borderRadius:3, transition:'width .4s ease' }} />
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    paid:      { bg:'var(--green-light)', color:'var(--green)', label:'Paid 已付' },
    confirmed: { bg:'var(--blue-light)',  color:'var(--blue)',  label:'Confirmed 已确认' },
    draft:     { bg:'#F3F4F6',           color:'#6B7280',      label:'Draft 草稿' },
  }
  const s = map[status] || map.draft
  return (
    <span style={{ fontSize:10, fontWeight:700, background:s.bg, color:s.color, padding:'2px 7px', borderRadius:20 }}>
      {s.label}
    </span>
  )
}

// ── Quick Action ──────────────────────────────────────────────────────────────
function QuickAction({ Icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} className="quick-action" style={{ '--action-color': color }}>
      <div style={{ width:34, height:34, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ flex:1, textAlign:'left' }}>
        <div style={{ fontWeight:600, fontSize:13 }}>{label}</div>
        <div style={{ fontSize:11, color:'var(--text3)' }}>{sub}</div>
      </div>
      <span style={{ color:'var(--text3)', fontSize:14 }}>›</span>
    </button>
  )
}
