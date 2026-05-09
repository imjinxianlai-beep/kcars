import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Reports() {
  const [tab, setTab] = useState('date') // date | vehicles
  const [loading, setLoading] = useState(false)

  return (
    <div style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
      {/* Tab switcher */}
      <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)', padding:'0 20px', display:'flex', gap:4 }}>
        {[
          { key:'date',     label:'📅 Date Query 日期查询' },
          { key:'vehicles', label:'🚗 Vehicle Analysis 车型分析' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding:'12px 16px', border:'none', background:'none',
              fontSize:13, fontWeight:600, cursor:'pointer',
              borderBottom: tab===t.key ? '2px solid var(--orange)' : '2px solid transparent',
              color: tab===t.key ? 'var(--orange)' : 'var(--text2)',
              transition:'.15s'
            }}>
            {t.label}
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
  const today = new Date().toISOString().split('T')[0]
  const [mode, setMode] = useState('day') // day | range | month
  const [date, setDate] = useState(today)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [month, setMonth] = useState(today.slice(0,7))
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const quickSelect = (type) => {
    const now = new Date()
    if (type === 'today') {
      setMode('day'); setDate(today)
    } else if (type === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate()-1)
      setMode('day'); setDate(y.toISOString().split('T')[0])
    } else if (type === 'week') {
      const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1)
      setMode('range')
      setDateFrom(mon.toISOString().split('T')[0])
      setDateTo(today)
    } else if (type === 'month') {
      setMode('month'); setMonth(today.slice(0,7))
    }
  }

  const search = async () => {
    setLoading(true); setResults(null)
    let from, to
    if (mode === 'day') { from = date; to = date }
    else if (mode === 'range') { from = dateFrom; to = dateTo }
    else { from = month+'-01'; to = month+'-31' }

    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(name, car_plate, car_make, car_model, phone)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })

    setLoading(false)
    if (error) { console.error(error); return }
    setResults({ invoices: data || [], from, to })
  }

  const fmt = (n) => `$${parseFloat(n||0).toLocaleString('en-SG', {minimumFractionDigits:2})}`

  return (
    <div style={{ padding:'16px 20px', maxWidth:900, margin:'0 auto' }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>📅 Date Query 日期查询</div>

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
              className="form-row" style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:14, outline:'none' }} />
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
            {loading ? 'Searching...' : '🔍 Search 查询'}
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
              {results.invoices.map(inv => (
                <div key={inv.id} className="card" style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontWeight:700, fontSize:14 }}>{inv.customers?.name || '—'}</span>
                        <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700 }}>
                          {inv.customers?.car_plate}
                        </span>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>
                          {inv.customers?.car_make} {inv.customers?.car_model}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                        {inv.invoice_no} · {inv.date}
                        {inv.technician && ` · 🔧 ${inv.technician}`}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        background: inv.status==='paid'?'#eaf3de': inv.status==='confirmed'?'#e6f1fb':'#f5f5f5',
                        color: inv.status==='paid'?'#1a7f37': inv.status==='confirmed'?'#185fa5':'#888'
                      }}>
                        {inv.status?.toUpperCase()}
                      </span>
                      <span style={{ fontSize:16, fontWeight:700, color:'var(--orange)' }}>
                        ${parseFloat(inv.total||0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: custs } = await supabase
      .from('customers')
      .select('car_make, car_model')
      .not('car_make', 'is', null)
      .neq('car_make', '')

    // Group by make → model
    const grouped = {}
    for (const c of custs || []) {
      const make = (c.car_make || '').trim().toUpperCase() || 'UNKNOWN'
      const model = (c.car_model || '').trim().toUpperCase() || 'UNKNOWN'
      if (!grouped[make]) grouped[make] = {}
      if (!grouped[make][model]) grouped[make][model] = 0
      grouped[make][model]++
    }

    // Sort by count
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

  const toggle = (make) => setExpanded(e => ({ ...e, [make]: !e[make] }))

  const filtered = data?.filter(d =>
    !search || d.make.includes(search.toUpperCase()) ||
    d.models.some(([m]) => m.includes(search.toUpperCase()))
  ) || []

  const totalCustomers = data?.reduce((a,d)=>a+d.total,0) || 0

  return (
    <div style={{ padding:'16px 20px', maxWidth:900, margin:'0 auto' }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>🚗 Vehicle Analysis 车型分析</div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
        {totalCustomers.toLocaleString()} customers · {data?.length || 0} brands
      </div>

      {/* Search */}
      <div style={{ marginBottom:14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search brand or model... e.g. Toyota, Estima"
          style={{ width:'100%', padding:'9px 14px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, outline:'none', background:'var(--card)' }} />
      </div>

      {loading ? <div className="spinner" /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(({ make, total, models }) => (
            <div key={make} className="card" style={{ padding:0, overflow:'hidden' }}>
              {/* Brand header */}
              <div onClick={() => toggle(make)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 16px', cursor:'pointer', userSelect:'none',
                  background: expanded[make] ? 'var(--orange-light)' : 'var(--card)',
                  borderLeft: expanded[make] ? '3px solid var(--orange)' : '3px solid transparent',
                  transition:'.15s'
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:16 }}>🚗</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{make}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{models.length} model{models.length!==1?'s':''}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {/* Mini bar */}
                  <div style={{ width:80, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'var(--orange)', borderRadius:3, width: (total/totalCustomers*100)+'%' }} />
                  </div>
                  <span style={{ fontSize:16, fontWeight:700, color:'var(--orange)', minWidth:40, textAlign:'right' }}>{total}</span>
                  <span style={{ fontSize:10, color:'var(--text3)', transform: expanded[make]?'rotate(180deg)':'none', transition:'.2s' }}>▼</span>
                </div>
              </div>

              {/* Models breakdown */}
              {expanded[make] && (
                <div style={{ borderTop:'1px solid var(--border)' }}>
                  {models.map(([model, count]) => (
                    <div key={model}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'9px 16px 9px 36px', borderBottom:'1px solid var(--border2)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                        <span style={{ fontSize:12, color:'var(--text2)' }}>{model}</span>
                        <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, maxWidth:200, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'#D85A3060', borderRadius:2, width:(count/total*100)+'%' }} />
                        </div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text2)', minWidth:30, textAlign:'right' }}>{count}</span>
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
