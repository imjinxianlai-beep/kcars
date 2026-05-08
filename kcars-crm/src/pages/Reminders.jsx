import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERVICE_INTERVAL_DAYS = 180  // 6 months
const REMIND_BEFORE_DAYS    = 7    // 1 week before due

// Message template - bilingual
const buildMessage = (name, plate, dueDate) =>
  `Hi ${name}! 您好 😊\n\nYour vehicle ${plate} is due for servicing on ${dueDate}.\n您的车牌 ${plate} 将于 ${dueDate} 到期保养。\n\nBook your appointment now and keep your car in top condition! 💪🔧\n请尽快预约，保持爱车最佳状态！\n\nK-Cars Auto Singapore\n📞 +6593215151`

export default function Reminders() {
  const [groups, setGroups] = useState({ upcoming: [], overdue: [], recent: [] })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [tab, setTab] = useState('upcoming') // upcoming | overdue | recent
  const [msgTemplate, setMsgTemplate] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { loadReminders() }, [])

  async function loadReminders() {
    setLoading(true)

    // Get latest invoice date per customer using a direct join query
    const { data, error } = await supabase
      .from('invoices')
      .select(`date, customer_id, customers(id, name, phone, car_plate, car_make, car_model)`)
      .not('date', 'is', null)
      .order('date', { ascending: false })
      .limit(20000)

    if (error) { console.error(error); setLoading(false); return }

    // Group by customer, keep only latest invoice per customer
    const custMap = {}
    for (const row of data) {
      if (!row.customers) continue
      const cid = row.customer_id
      if (!custMap[cid]) {
        custMap[cid] = { ...row.customers, lastDate: row.date }
      }
    }

    const today = new Date()
    today.setHours(0,0,0,0)

    const upcoming = [], overdue = [], recent = []

    for (const c of Object.values(custMap)) {
      const lastDate = new Date(c.lastDate)
      const dueDate  = new Date(lastDate)
      dueDate.setDate(dueDate.getDate() + SERVICE_INTERVAL_DAYS)

      const daysUntilDue = Math.ceil((dueDate - today) / 86400000)
      const daysSinceLast = Math.ceil((today - lastDate) / 86400000)

      const entry = {
        ...c,
        lastDate: c.lastDate,
        dueDate: dueDate.toISOString().split('T')[0],
        daysUntilDue,
        daysSinceLast,
        invoices: undefined
      }

      if (daysUntilDue < 0) {
        overdue.push(entry)           // already overdue
      } else if (daysUntilDue <= REMIND_BEFORE_DAYS) {
        upcoming.push(entry)          // due within 1 week
      } else if (daysSinceLast <= 30) {
        recent.push(entry)            // came within 30 days — no action needed
      }
    }

    overdue.sort((a,b) => a.daysUntilDue - b.daysUntilDue)
    upcoming.sort((a,b) => a.daysUntilDue - b.daysUntilDue)
    recent.sort((a,b) => b.lastDate.localeCompare(a.lastDate))

    setGroups({ upcoming, overdue, recent })
    setLoading(false)
  }

  const currentList = groups[tab] || []

  const toggleSelect = (id) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const toggleAll = () => {
    if (selected.size === currentList.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(currentList.map(c => c.id)))
    }
  }

  const openWA = (c) => {
    const msg = encodeURIComponent(buildMessage(c.name, c.car_plate, c.dueDate))
    const phone = (c.phone || '').replace(/\D/g,'')
    const url = phone
      ? `https://wa.me/65${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
  }

  const bulkSend = async () => {
    const toSend = currentList.filter(c => selected.has(c.id))
    if (!toSend.length) { alert('Please select customers first.'); return }
    setSending(true)
    for (const c of toSend) {
      openWA(c)
      await new Promise(r => setTimeout(r, 800)) // small delay between opens
    }
    setSending(false)
  }

  const tabLabel = {
    upcoming: `Due Soon 即将到期 (${groups.upcoming.length})`,
    overdue:  `Overdue 已过期 (${groups.overdue.length})`,
    recent:   `Recent 最近保养 (${groups.recent.length})`,
  }

  const dueBadge = (c) => {
    if (c.daysUntilDue < 0)
      return <span style={badge('#e74c3c')}>逾期 {Math.abs(c.daysUntilDue)} 天</span>
    if (c.daysUntilDue === 0)
      return <span style={badge('#D85A30')}>今天到期</span>
    return <span style={badge('#185fa5')}>还有 {c.daysUntilDue} 天</span>
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>🔔 Service Reminders 保养提醒</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
            Cycle: 3 months · Remind: 1 week before due · Based on last invoice date
          </div>
        </div>
        <button className="btn" onClick={loadReminders} style={{ fontSize:12 }}>🔄 Refresh</button>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
        {[
          { key:'overdue',  label:'Overdue 已过期',       color:'#e74c3c', icon:'⚠️' },
          { key:'upcoming', label:'Due Soon 即将到期',    color:'#D85A30', icon:'🔔' },
          { key:'recent',   label:'Recently Serviced 已保养', color:'#1a7f37', icon:'✅' },
        ].map(t => (
          <div key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab===t.key ? t.color : '#fff',
              color: tab===t.key ? '#fff' : '#111',
              border: `2px solid ${t.color}`,
              borderRadius:10, padding:'12px 16px', cursor:'pointer',
              transition:'.15s'
            }}>
            <div style={{ fontSize:22, fontWeight:700 }}>{t.icon} {groups[t.key]?.length || 0}</div>
            <div style={{ fontSize:12, marginTop:2, opacity:.85 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {(tab === 'upcoming' || tab === 'overdue') && currentList.length > 0 && (
        <div style={{
          background:'#fff', border:'1px solid var(--border)', borderRadius:10,
          padding:'10px 14px', marginBottom:12,
          display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'
        }}>
          <input type="checkbox"
            checked={selected.size === currentList.length && currentList.length > 0}
            onChange={toggleAll}
            style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer' }}
          />
          <span style={{ fontSize:13, flex:1 }}>
            {selected.size > 0 ? `${selected.size} selected 已选` : 'Select all 全选'}
          </span>
          {selected.size > 0 && (
            <>
              <button className="btn btn-wa" onClick={bulkSend} disabled={sending}
                style={{ fontSize:12 }}>
                📱 Send WhatsApp to {selected.size} customers
              </button>
              <button className="btn" onClick={() => setSelected(new Set())}
                style={{ fontSize:11, color:'var(--text3)' }}>Clear 清除</button>
            </>
          )}
        </div>
      )}

      {/* Customer list */}
      {loading ? <div className="spinner" /> : (
        currentList.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>
            <div style={{ fontSize:36 }}>
              {tab==='recent' ? '✅' : '🎉'}
            </div>
            <div style={{ fontSize:14, marginTop:8 }}>
              {tab==='upcoming' ? 'No customers due this week!' :
               tab==='overdue'  ? 'No overdue customers! Great!' :
               'No recent services to show.'}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {currentList.map(c => (
              <div key={c.id} style={{
                background:'#fff', border:'1px solid var(--border)',
                borderRadius:10, padding:'12px 14px',
                display:'flex', alignItems:'center', gap:12,
                borderLeft: selected.has(c.id) ? '3px solid var(--orange)' : '1px solid var(--border)',
                boxShadow:'var(--shadow)'
              }}>
                {(tab==='upcoming'||tab==='overdue') && (
                  <input type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer', flexShrink:0 }}
                  />
                )}

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{c.name}</span>
                    <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700 }}>
                      {c.car_plate}
                    </span>
                    {dueBadge(c)}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                    {c.car_make} {c.car_model} &nbsp;·&nbsp;
                    Last service: {c.lastDate} &nbsp;·&nbsp;
                    Due: {c.dueDate}
                    {c.phone && <span> &nbsp;·&nbsp; 📱 {c.phone}</span>}
                  </div>
                </div>

                <button className="btn btn-wa" onClick={() => openWA(c)}
                  style={{ fontSize:12, flexShrink:0 }}>
                  📱 WhatsApp
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function badge(color) {
  return {
    fontSize:10, fontWeight:700, padding:'2px 8px',
    borderRadius:20, background: color + '20',
    color, border:`1px solid ${color}40`
  }
}
