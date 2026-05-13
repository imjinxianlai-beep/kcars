import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Car, Wrench, Phone, RefreshCw, ChevronDown, Search } from 'lucide-react'

export default function Reports() {
  const [tab, setTab] = useState('date') // date | vehicles
  const [loading, setLoading] = useState(false)

  return (
    <div style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
      {/* Tab switcher */}
      <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)', padding:'0 20px', display:'flex', gap:4 }}>
        {[
          { key:'date',     label:'Date Query 日期查询',       Icon: Calendar },
          { key:'vehicles', label:'Vehicle Analysis 车型分析',  Icon: Car },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'12px 16px', border:'none', background:'none',
              fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              borderBottom: tab===t.key ? '2px solid var(--orange)' : '2px solid transparent',
              color: tab===t.key ? 'var(--orange)' : 'var(--text2)',
              transition:'color .15s, border-color .15s'
            }}>
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'date'     && <DateQuery />}
      {tab === 'vehicles' && <VehicleAnalysis />}
    </div>
  )
}

// ── DATE QUERY ──────────────────────────────────────────────────────────
function DateQuery() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const [mode, setMode] = useState('day') // day | range | month
  const [date, setDate] = useState(today)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [month, setMonth] = useState(today.slice(0,7))
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const quickSelect = async (type) => {
    const now = new Date()
    let from, to, newMode = 'day', newDate = today, newFrom = today, newTo = today, newMonth = today.slice(0,7)

    if (type === 'today') {
      from = today; to = today; newMode='day'; newDate=today
    } else if (type === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate()-1)
      newDate = y.toISOString().split('T')[0]
      from = newDate; to = newDate; newMode='day'
    } else if (type === 'week') {
      const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1)
      newFrom = mon.toISOString().split('T')[0]; newTo = today
      from = newFrom; to = newTo; newMode='range'
    } else if (type === 'month') {
      newMode='month'
      const d = new Date(today.slice(0,7)+'-01')
      d.setMonth(d.getMonth()+1); d.setDate(0)
      from = today.slice(0,7)+'-01'; to = d.toISOString().split('T')[0]
    }

    setMode(newMode); setDate(newDate); setDateFrom(newFrom); setDateTo(newTo); setMonth(newMonth)
    
    // Auto search
    setLoading(true); setResults(null)
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(name, car_plate, car_make, car_model, phone), invoice_items(*)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
    setLoading(false)
    setResults({ invoices: data || [], from, to })
  }

  const search = async () => {
    setLoading(true); setResults(null)
    let from, to
    if (mode === 'day') { from = date; to = date }
    else if (mode === 'range') { from = dateFrom; to = dateTo }
    else {
      from = month+'-01'
      const d = new Date(month+'-01')
      d.setMonth(d.getMonth()+1); d.setDate(0)
      to = d.toISOString().split('T')[0]
    }

    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(name, car_plate, car_make, car_model, phone), invoice_items(*)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })

    setLoading(false)
    if (error) { console.error(error); return }
    setResults({ invoices: data || [], from, to })
  }

  const fmt = (n) => `$${parseFloat(n||0).toLocaleString('en-SG', {minimumFractionDigits:2})}`

  return (
    <div style={{ padding:'16px 20px', maxWidth:900, margin:'0 auto' }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:16, display:'flex', alignItems:'center', gap:8, fontFamily:"'Syne',sans-serif" }}><Calendar size={18} /> Date Query 日期查询</div>

      {/* Quick selects */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { key:'today',     label:'Today 今天' },
          { key:'yesterday', label:'Yesterday 昨天' },
          { key:'week',      label:'This Week 本周' },
          { key:'month',     label:'This Month 本月' },
        ].map(q => (
          <button key={q.key} onClick={() => quickSelect(q.key)}
            className="btn" style={{ fontSize:12 }}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Mode + inputs */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          {[
            { key:'day',   label:'Single Day 单天' },
            { key:'range', label:'Date Range 日期范围' },
            { key:'month', label:'Month 月份' },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`btn ${mode===m.key?'btn-primary':''}`}
              style={{ fontSize:12 }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {mode === 'day' && (
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, outline:'none' }} />
          )}
          {mode === 'range' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, outline:'none' }} />
              <span style={{ color:'var(--text2)' }}>to 至</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, outline:'none' }} />
            </>
          )}
          {mode === 'month' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, outline:'none' }} />
          )}
          <button className="btn btn-primary" onClick={search} disabled={loading}
            style={{ fontSize:13 }}>
            {loading ? 'Searching...' : 'Search 查询'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Summary stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
            {[
              { label:'Invoices 发票', val: results.invoices.length },
              { label:'Cars Serviced 台车', val: new Set(results.invoices.map(i=>i.customer_id)).size },
              { label:'Total Revenue 营业额', val: fmt(results.invoices.reduce((a,i)=>a+parseFloat(i.total||0),0)) },
              { label:'Avg per Car 平均', val: results.invoices.length > 0
                  ? fmt(results.invoices.reduce((a,i)=>a+parseFloat(i.total||0),0) / new Set(results.invoices.map(i=>i.customer_id)).size)
                  : '$0' },
            ].map((s,i) => (
              <div key={i} className="card" style={{ textAlign:'center', padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.3px' }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color: i===2?'var(--orange)':'var(--text)', marginTop:4 }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Invoice list */}
          {results.invoices.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'var(--text3)' }}>
              <div style={{ fontSize:36 }}>📭</div>
              <div style={{ fontSize:14, marginTop:8 }}>No invoices found for this period</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {results.invoices.map(inv => <InvoiceRow key={inv.id} inv={inv} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ── INVOICE ROW (expandable) ────────────────────────────────────────────
function InvoiceRow({ inv }) {
  const [open, setOpen] = useState(false)
  const items = (inv.invoice_items || []).sort((a,b) => a.sort_order - b.sort_order)
  const c = inv.customers || {}

  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      {/* Header row */}
      <div onClick={() => setOpen(!open)}
        style={{ padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{c.name || '—'}</span>
            <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700 }}>{c.car_plate}</span>
            <span style={{ fontSize:11, color:'var(--text3)' }}>{c.car_make} {c.car_model}</span>
            {c.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:'#25D366', fontWeight:600 }}><Phone size={10} /> {c.phone}</span>}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>
            {inv.invoice_no} · {inv.date}
            {inv.technician && <span style={{ display:'inline-flex', alignItems:'center', gap:3, color:'var(--text2)', marginLeft:6 }}><Wrench size={10} /> {inv.technician}</span>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{
            fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
            background: inv.status==='paid'?'#eaf3de': inv.status==='confirmed'?'#e6f1fb':'#f5f5f5',
            color: inv.status==='paid'?'#1a7f37': inv.status==='confirmed'?'#185fa5':'#888'
          }}>
            {(inv.status||'').toUpperCase()}
          </span>
          <span style={{ fontSize:16, fontWeight:700, color:'var(--orange)' }}>
            ${parseFloat(inv.total||0).toFixed(2)}
          </span>
          <ChevronDown size={14} style={{ color:'var(--text3)', transition:'transform .2s', transform: open?'rotate(180deg)':'none' }} />
        </div>
      </div>

      {/* Expandable items */}
      {open && (
        <div style={{ borderTop:'1px solid var(--border2)' }}>
          {items.length === 0
            ? <div style={{ padding:'10px 16px', fontSize:12, color:'var(--text3)' }}>No line items</div>
            : items.map(it => (
              <div key={it.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 16px', borderBottom:'1px solid var(--border2)', fontSize:13 }}>
                <span style={{ flex:1, color:'var(--text)' }}>{it.description}</span>
                <span style={{ fontWeight:600, color: parseFloat(it.amount)<0?'var(--red)':'var(--text2)', whiteSpace:'nowrap', marginLeft:12 }}>
                  {parseFloat(it.amount)<0?'−':'+'}${Math.abs(parseFloat(it.amount||0)).toFixed(2)}
                </span>
              </div>
            ))
          }
          <div style={{ display:'flex', justifyContent:'flex-end', padding:'8px 16px', background:'var(--bg-dark)', color:'#fff', fontSize:13, fontWeight:700 }}>
            <span>TOTAL: <span style={{ color:'var(--orange)' }}>${parseFloat(inv.total||0).toFixed(2)}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── VEHICLE ANALYSIS ────────────────────────────────────────────────────
function VehicleAnalysis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [search, setSearch] = useState('')
  const [drilldown, setDrilldown] = useState(null) // {make, model}
  const [drillData, setDrillData] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: custs } = await supabase
      .from('customers')
      .select('car_make, car_model')
      .not('car_make', 'is', null)
      .neq('car_make', '')

    const grouped = {}
    for (const c of custs || []) {
      const make = (c.car_make || '').trim().toUpperCase() || 'UNKNOWN'
      const model = (c.car_model || '').trim().toUpperCase() || 'UNKNOWN'
      if (!grouped[make]) grouped[make] = {}
      if (!grouped[make][model]) grouped[make][model] = 0
      grouped[make][model]++
    }

    const sorted = Object.entries(grouped)
      .map(([make, models]) => ({
        make,
        total: Object.values(models).reduce((a,b)=>a+b,0),
        models: Object.entries(models).sort((a,b)=>b[1]-a[1])
      }))
      .sort((a,b) => b.total - a.total)

    setData(sorted)
    setLoading(false)
  }

  const openDrilldown = async (make, model) => {
    setDrilldown({ make, model })
    setDrillLoading(true)
    setDrillData(null)

    // Get all customers with this make+model + their invoices
    const { data: custs } = await supabase
      .from('customers')
      .select('*, invoices(id, date, total, invoice_no, technician, status)')
      .ilike('car_make', make)
      .ilike('car_model', model)
      .order('name')

    // Add visit count and total spend, sort by visits desc
    const enriched = (custs || []).map(c => ({
      ...c,
      visitCount: (c.invoices || []).length,
      totalSpend: (c.invoices || []).reduce((a,i) => a + parseFloat(i.total||0), 0),
      lastVisit: (c.invoices || []).sort((a,b) => b.date.localeCompare(a.date))[0]?.date || ''
    })).sort((a,b) => b.visitCount - a.visitCount)

    setDrillData(enriched)
    setDrillLoading(false)
  }

  const toggle = (make) => setExpanded(e => ({ ...e, [make]: !e[make] }))
  const filtered = data?.filter(d =>
    !search || d.make.includes(search.toUpperCase()) ||
    d.models.some(([m]) => m.includes(search.toUpperCase()))
  ) || []
  const totalCustomers = data?.reduce((a,d)=>a+d.total,0) || 0

  // ── Drilldown view ──
  if (drilldown) return (
    <div style={{ padding:'16px 20px', maxWidth:900, margin:'0 auto' }}>
      <button className="btn" onClick={() => { setDrilldown(null); setDrillData(null) }}
        style={{ marginBottom:16, fontSize:12 }}>
        ← Back to Vehicle Analysis
      </button>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
        <Car size={18} />{drilldown.make} {drilldown.model}
      </div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
        {drillData ? `${drillData.length} customers · Sorted by most visits` : 'Loading...'}
      </div>

      {drillLoading ? <div className="spinner" /> : (
        <>
          {/* Summary */}
          {drillData && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { label:'Total Customers', val: drillData.length },
                { label:'Total Visits', val: drillData.reduce((a,c)=>a+c.visitCount,0).toLocaleString() },
                { label:'Total Revenue', val: '$'+drillData.reduce((a,c)=>a+c.totalSpend,0).toLocaleString('en-SG',{minimumFractionDigits:0}) },
              ].map((s,i) => (
                <div key={i} className="card" style={{ textAlign:'center', padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:i===2?'var(--orange)':'var(--text)', marginTop:4 }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Customer list */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(drillData || []).map((c, idx) => (
              <DrillCustomer key={c.id} c={c} rank={idx+1} />
            ))}
          </div>
        </>
      )}
    </div>
  )

  // ── Main view ──
  return (
    <div style={{ padding:'16px 20px', maxWidth:900, margin:'0 auto' }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}><Car size={18} />Vehicle Analysis 车型分析</div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
        {totalCustomers.toLocaleString()} customers · {data?.length || 0} brands
        <span style={{ marginLeft:8, color:'var(--orange)' }}>· Click any model to see all customers</span>
      </div>

      <div style={{ marginBottom:14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search brand or model... e.g. Toyota, Estima"
          style={{ width:'100%', padding:'9px 14px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, outline:'none', background:'var(--card)' }} />
      </div>

      {loading ? <div className="spinner" /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(({ make, total, models }) => (
            <div key={make} className="card" style={{ padding:0, overflow:'hidden' }}>
              <div onClick={() => toggle(make)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 16px', cursor:'pointer', userSelect:'none',
                  background: expanded[make] ? 'var(--orange-light)' : 'var(--card)',
                  borderLeft: expanded[make] ? '3px solid var(--orange)' : '3px solid transparent',
                  transition:'.15s'
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Car size={16} />
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{make}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{models.length} models · {total} customers</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:80, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'var(--orange)', borderRadius:3, width:(total/totalCustomers*100)+'%' }} />
                  </div>
                  <span style={{ fontSize:16, fontWeight:700, color:'var(--orange)', minWidth:40, textAlign:'right' }}>{total}</span>
                  <span style={{ fontSize:10, color:'var(--text3)', transform:expanded[make]?'rotate(180deg)':'none', transition:'.2s' }}>▼</span>
                </div>
              </div>

              {expanded[make] && (
                <div style={{ borderTop:'1px solid var(--border)' }}>
                  {models.map(([model, count]) => (
                    <div key={model}
                      onClick={() => openDrilldown(make, model)}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'9px 16px 9px 36px', borderBottom:'1px solid var(--border2)',
                        cursor:'pointer', transition:'.1s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--orange-light)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{model}</span>
                        <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, maxWidth:200, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'#D85A3060', borderRadius:2, width:(count/total*100)+'%' }} />
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'var(--text2)', minWidth:30, textAlign:'right' }}>{count}</span>
                        <span style={{ fontSize:11, color:'var(--orange)' }}>View →</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding:'8px 16px', fontSize:11, color:'var(--text3)', textAlign:'right' }}>
                    Total: {total} customers ({(total/totalCustomers*100).toFixed(1)}%)
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Drill Customer Row ──────────────────────────────────────────────────
function DrillCustomer({ c, rank }) {
  const [open, setOpen] = useState(false)
  const [invOpen, setInvOpen] = useState({})
  const [invItems, setInvItems] = useState({})
  const invoices = (c.invoices || []).sort((a,b) => b.date.localeCompare(a.date))
  const rankBg = rank===1?'#FEF3C7':rank===2?'#F3F4F6':rank===3?'#FFF3EF':'var(--bg2)'
  const rankColor = rank===1?'#D97706':rank===2?'#6B7280':rank===3?'#D85A30':'var(--text3)'

  const toggleInv = async (inv) => {
    const isOpen = invOpen[inv.id]
    setInvOpen(s => ({ ...s, [inv.id]: !isOpen }))
    // Load items if not loaded yet
    if (!isOpen && !invItems[inv.id]) {
      const { data } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', inv.id)
        .order('sort_order')
      setInvItems(s => ({ ...s, [inv.id]: data || [] }))
    }
  }

  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      {/* Customer header */}
      <div onClick={() => setOpen(!open)}
        style={{ padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:rankBg, color:rankColor, fontWeight:700, fontSize:13 }}>
          {rank}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{c.name}</span>
            <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700 }}>{c.car_plate}</span>
            {c.phone && <span style={{ fontSize:11, color:'var(--text3)', display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10} />{c.phone}</span>}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
            Last visit: {c.lastVisit || '—'} · Total spent: ${c.totalSpend.toLocaleString('en-SG',{minimumFractionDigits:2})}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--orange)' }}>{c.visitCount}</div>
          <div style={{ fontSize:10, color:'var(--text3)' }}>visits</div>
        </div>
        <span style={{ fontSize:10, color:'var(--text3)', transition:'.2s', transform:open?'rotate(180deg)':'none' }}>▼</span>
      </div>

      {/* Invoice list */}
      {open && (
        <div style={{ borderTop:'1px solid var(--border2)', background:'var(--bg2)' }}>
          {invoices.map(inv => (
            <div key={inv.id} style={{ borderBottom:'1px solid var(--border2)' }}>
              {/* Invoice row */}
              <div onClick={() => toggleInv(inv)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'9px 16px 9px 52px', cursor:'pointer', transition:'.1s',
                  background: invOpen[inv.id] ? 'var(--orange-light)' : 'transparent' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{inv.invoice_no}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>
                    {inv.date}{inv.technician ? <> · <Wrench size={9} style={{margin:'0 2px 0 4px'}} />{inv.technician}</> : ''}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'var(--orange)', fontSize:14 }}>${parseFloat(inv.total||0).toFixed(2)}</div>
                    <div style={{ fontSize:10, fontWeight:700,
                      color: inv.status==='paid'?'var(--green)':inv.status==='confirmed'?'var(--blue)':'var(--text3)'
                    }}>{(inv.status||'').toUpperCase()}</div>
                  </div>
                  <span style={{ fontSize:10, color:'var(--text3)', transition:'.2s', transform:invOpen[inv.id]?'rotate(180deg)':'none' }}>▼</span>
                </div>
              </div>

              {/* Invoice items */}
              {invOpen[inv.id] && (
                <div style={{ background:'var(--card)', borderTop:'1px solid var(--border2)' }}>
                  {!invItems[inv.id]
                    ? <div style={{ padding:'8px 16px 8px 68px', fontSize:12, color:'var(--text3)' }}>Loading...</div>
                    : invItems[inv.id].length === 0
                    ? <div style={{ padding:'8px 16px 8px 68px', fontSize:12, color:'var(--text3)' }}>No items</div>
                    : invItems[inv.id].map(it => (
                      <div key={it.id} style={{ display:'flex', justifyContent:'space-between',
                        padding:'7px 16px 7px 68px', borderBottom:'1px solid var(--border2)', fontSize:13 }}>
                        <span style={{ flex:1, color:'var(--text)' }}>{it.description}</span>
                        <span style={{ fontWeight:600, whiteSpace:'nowrap', marginLeft:12,
                          color: parseFloat(it.amount)<0 ? 'var(--red)' : 'var(--text2)' }}>
                          {parseFloat(it.amount)<0?'−':'+'}${Math.abs(parseFloat(it.amount||0)).toFixed(2)}
                        </span>
                      </div>
                    ))
                  }
                  <div style={{ display:'flex', justifyContent:'flex-end',
                    padding:'8px 16px', background:'#111', color:'#fff', fontSize:13, fontWeight:700 }}>
                    TOTAL: <span style={{ color:'var(--orange)', marginLeft:8 }}>${parseFloat(inv.total||0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
