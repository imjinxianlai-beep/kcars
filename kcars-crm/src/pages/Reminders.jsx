import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERVICE_INTERVAL_DAYS = 180
const REMIND_BEFORE_DAYS    = 7

const buildMessage = (name, plate, dueDate, overdue=false) => {
  if (overdue) {
    return `Hi ${name}, this is K-Cars Auto Centre.\n\nYour vehicle ${plate} was due for servicing on ${dueDate}.\n\nPlease come in as soon as possible to avoid any issues with your vehicle.\n\nCall or WhatsApp us: +65 9321 5151\n\nThank you!\nK-Cars Auto Centre`
  }
  return `Hi ${name}, this is K-Cars Auto Centre.\n\nYour vehicle ${plate} is due for servicing on ${dueDate}.\n\nBook your appointment now to keep your car in top condition!\n\nCall or WhatsApp us: +65 9321 5151\n\nThank you!\nK-Cars Auto Centre`
}

function loadLocal(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) || def } catch { return def }
}
function saveLocal(key, val) {
  localStorage.setItem(key, JSON.stringify(val))
}

export default function Reminders() {
  const [allList, setAllList]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('overdue')
  const [statuses, setStatuses]   = useState(() => loadLocal('kcars_statuses', {}))
  const [notes, setNotes]         = useState(() => loadLocal('kcars_notes', {}))
  const [apptDates, setApptDates] = useState(() => loadLocal('kcars_appts', {}))
  const [noteOpen, setNoteOpen]   = useState(null)
  const [apptOpen, setApptOpen]   = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [fading, setFading]       = useState(new Set()) // ids currently fading out

  useEffect(() => { loadReminders() }, [])

  async function loadReminders() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('date, customer_id, customers(id, name, phone, car_plate, car_make, car_model)')
      .not('date', 'is', null)
      .order('date', { ascending: false })
      .limit(20000)

    const custMap = {}
    for (const row of data || []) {
      if (!row.customers) continue
      const cid = row.customer_id
      if (!custMap[cid]) custMap[cid] = { ...row.customers, lastDate: row.date }
    }

    const today = new Date(); today.setHours(0,0,0,0)
    const list = []
    for (const c of Object.values(custMap)) {
      const lastDate  = new Date(c.lastDate)
      const dueDate   = new Date(lastDate)
      dueDate.setDate(dueDate.getDate() + SERVICE_INTERVAL_DAYS)
      const daysUntilDue  = Math.ceil((dueDate - today) / 86400000)
      const daysSinceLast = Math.ceil((today - lastDate) / 86400000)
      list.push({ ...c, dueDate: dueDate.toISOString().split('T')[0], daysUntilDue, daysSinceLast })
    }
    setAllList(list)
    setLoading(false)
  }

  // Categorise
  const getType = (c) => {
    if (c.daysUntilDue < 0)                         return 'overdue'
    if (c.daysUntilDue <= REMIND_BEFORE_DAYS)        return 'upcoming'
    if (c.daysSinceLast <= 30)                       return 'recent'
    return null
  }

  const getStatus = (id) => statuses[id] || 'pending'

  // Groups
  const overdue  = allList.filter(c => getType(c)==='overdue'  && !['sold','skip'].includes(getStatus(c.id)))
  const upcoming = allList.filter(c => getType(c)==='upcoming' && !['sold','skip'].includes(getStatus(c.id)))
  const recent   = allList.filter(c => getType(c)==='recent')
  const followed = allList.filter(c =>
    (getType(c)==='overdue' || getType(c)==='upcoming') &&
    ['messaged','appointed','sold','skip'].includes(getStatus(c.id))
  )

  const currentList = tab==='overdue' ? overdue : tab==='upcoming' ? upcoming : tab==='recent' ? recent : followed

  const setStatus = (id, s) => {
    const updated = { ...statuses, [id]: s }
    // If moving to followed-up status: fade out first, then update state
    if (['messaged','appointed','sold','skip'].includes(s)) {
      setFading(f => new Set([...f, id]))
      setTimeout(() => {
        setStatuses(updated)
        saveLocal('kcars_statuses', updated)
        setFading(f => { const n=new Set(f); n.delete(id); return n })
      }, 500)
    } else {
      // Reverting to pending - show immediately
      setStatuses(updated)
      saveLocal('kcars_statuses', updated)
    }
  }
  const setNote = (id, n) => {
    const updated = { ...notes, [id]: n }
    setNotes(updated); saveLocal('kcars_notes', updated)
  }
  const setAppt = (id, d) => {
    const updated = { ...apptDates, [id]: d }
    setApptDates(updated); saveLocal('kcars_appts', updated)
    setStatus(id, 'appointed')
  }

  const openWA = (c) => {
    const msg = encodeURIComponent(buildMessage(c.name, c.car_plate, c.dueDate, c.daysUntilDue < 0))
    const phone = (c.phone||'').replace(/\D/g,'')
    window.open(phone ? `https://wa.me/65${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
    if (getStatus(c.id)==='pending') setStatus(c.id, 'messaged')
  }

  const toggleSelect = (id) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }
  const toggleAll = () => {
    if (selected.size === currentList.length) setSelected(new Set())
    else setSelected(new Set(currentList.map(c => c.id)))
  }
  const bulkSend = async () => {
    const toSend = currentList.filter(c => selected.has(c.id))
    if (!toSend.length) { alert('Please select customers first.'); return }
    for (const c of toSend) { openWA(c); await new Promise(r => setTimeout(r,800)) }
  }

  const TABS = [
    { key:'overdue',  icon:'⚠️', label:'Overdue 已过期',      count: overdue.length,  color:'#e74c3c' },
    { key:'upcoming', icon:'🔔', label:'Due Soon 即将到期',    count: upcoming.length, color:'var(--orange)' },
    { key:'followed', icon:'📋', label:'Followed Up 已跟进',   count: followed.length, color:'#185fa5' },
    { key:'recent',   icon:'✅', label:'Serviced 已保养',      count: recent.length,   color:'#1a7f37' },
  ]

  const statusBadge = (id) => {
    const s = getStatus(id)
    const map = {
      pending:   { label:'Not Contacted', color:'#888',    bg:'#f5f5f5' },
      messaged:  { label:'Msg Sent 📱',   color:'#185fa5', bg:'#e6f1fb' },
      appointed: { label:'Appointed 📅',  color:'#1a7f37', bg:'#eaf3de' },
      sold:      { label:'Car Sold 🚗',   color:'#D85A30', bg:'#fff3ef' },
      skip:      { label:'No Follow-up',  color:'#e74c3c', bg:'#fff0f0' },
    }
    const st = map[s] || map.pending
    return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:st.bg, color:st.color }}>{st.label}</span>
  }

  return (
    <div style={{ padding:'16px 20px', maxWidth:960, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>🔔 Service Reminders 保养提醒</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>Cycle: 6 months · Remind: 1 week before</div>
        </div>
        <button className="btn" onClick={loadReminders} style={{ fontSize:12 }}>🔄 Refresh</button>
      </div>

      {/* Tab cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
        {TABS.map(t => (
          <div key={t.key} onClick={() => { setTab(t.key); setSelected(new Set()) }}
            style={{
              background: tab===t.key ? t.color : '#fff',
              color: tab===t.key ? '#fff' : '#111',
              border: `2px solid ${t.color}`, borderRadius:10,
              padding:'10px 14px', cursor:'pointer', transition:'.15s'
            }}>
            <div style={{ fontSize:20, fontWeight:700 }}>{t.icon} {t.count}</div>
            <div style={{ fontSize:11, marginTop:2, opacity:.85 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {tab !== 'recent' && tab !== 'followed' && currentList.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <input type="checkbox"
            checked={selected.size === currentList.length && currentList.length > 0}
            onChange={toggleAll}
            style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer' }} />
          <span style={{ fontSize:13, flex:1 }}>{selected.size > 0 ? `${selected.size} selected` : 'Select all 全选'}</span>
          {selected.size > 0 && (
            <button className="btn btn-wa" onClick={bulkSend} style={{ fontSize:12 }}>
              📱 Send WhatsApp to {selected.size} customers
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? <div className="spinner" /> : currentList.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'var(--text3)' }}>
          <div style={{ fontSize:40 }}>{tab==='recent'?'✅':tab==='followed'?'📋':'🎉'}</div>
          <div style={{ fontSize:14, marginTop:8 }}>No customers in this category</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {currentList.map(c => {
            const status  = getStatus(c.id)
            const note    = notes[c.id] || ''
            const appt    = apptDates[c.id] || ''
            const isSold  = status === 'sold'

            return (
              <div key={c.id} style={{
                background:'#fff', border:'1px solid var(--border)', borderRadius:10,
                padding:'12px 14px', opacity: isSold ? .55 : 1,
                borderLeft: selected.has(c.id) ? '3px solid var(--orange)' : '1px solid var(--border)',
                transition: 'opacity .3s, transform .3s',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  {/* Checkbox */}
                  {tab !== 'recent' && tab !== 'followed' && (
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer', marginTop:3, flexShrink:0 }} />
                  )}

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:14 }}>{c.name}</span>
                      <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700 }}>{c.car_plate}</span>
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        background: c.daysUntilDue < 0 ? '#ffeaea' : '#fff3ef',
                        color: c.daysUntilDue < 0 ? '#e74c3c' : 'var(--orange)'
                      }}>
                        {c.daysUntilDue < 0 ? `逾期 ${Math.abs(c.daysUntilDue)} 天` : `还有 ${c.daysUntilDue} 天`}
                      </span>
                      {statusBadge(c.id)}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                      {c.car_make} {c.car_model} · Last: {c.lastDate} · Due: {c.dueDate}
                      {c.phone && <span> · 📱 {c.phone}</span>}
                    </div>
                    {/* Appointment date */}
                    {appt && <div style={{ fontSize:12, color:'#1a7f37', marginTop:4, fontWeight:600 }}>📅 Appointment: {appt}</div>}
                    {/* Note */}
                    {note && noteOpen !== c.id && (
                      <div style={{ fontSize:11, color:'var(--text2)', marginTop:4, padding:'3px 8px', background:'#f9f9f9', borderRadius:6, display:'inline-block' }}>
                        📝 {note}
                      </div>
                    )}
                    {/* Note input */}
                    {noteOpen === c.id && (
                      <div style={{ marginTop:8, display:'flex', gap:6 }}>
                        <input autoFocus defaultValue={note}
                          placeholder="Add a note..."
                          style={{ flex:1, padding:'5px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:12, outline:'none' }}
                          onKeyDown={e => { if(e.key==='Enter'){setNote(c.id,e.target.value);setNoteOpen(null)} if(e.key==='Escape')setNoteOpen(null) }} />
                        <button className="btn btn-primary" style={{ fontSize:11, padding:'5px 10px' }}
                          onClick={e => { setNote(c.id,e.target.closest('div').querySelector('input').value);setNoteOpen(null) }}>Save</button>
                        <button className="btn" style={{ fontSize:11 }} onClick={() => setNoteOpen(null)}>✕</button>
                      </div>
                    )}
                    {/* Appointment date picker */}
                    {apptOpen === c.id && (
                      <div style={{ marginTop:8, display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:12, color:'var(--text3)' }}>Appointment date:</span>
                        <input type="date" defaultValue={appt}
                          style={{ padding:'4px 8px', border:'1px solid var(--border)', borderRadius:6, fontSize:12, outline:'none' }}
                          onChange={e => { if(e.target.value){ setAppt(c.id,e.target.value); setApptOpen(null) } }} />
                        <button className="btn" style={{ fontSize:11 }} onClick={() => setApptOpen(null)}>✕</button>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
                    {/* Status buttons */}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end' }}>
                      {[
                        { key:'messaged',  label:'📱 Msg Sent',   color:'#185fa5', bg:'#e6f1fb' },
                        { key:'appointed', label:'📅 Appointed',  color:'#1a7f37', bg:'#eaf3de' },
                        { key:'sold',      label:'🚗 Car Sold',   color:'#D85A30', bg:'#fff3ef' },
                        { key:'skip',      label:'❌ Skip',        color:'#e74c3c', bg:'#fff0f0' },
                      ].map(s => (
                        <button key={s.key}
                          onClick={() => {
                            setStatus(c.id, status===s.key ? 'pending' : s.key)
                            if (s.key==='appointed' && status!==s.key) setApptOpen(c.id)
                          }}
                          style={{
                            padding:'3px 10px', borderRadius:20, border:'none', fontSize:11,
                            fontWeight:600, cursor:'pointer', transition:'.15s',
                            background: status===s.key ? s.color : s.bg,
                            color: status===s.key ? '#fff' : s.color,
                          }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {/* Secondary buttons */}
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ padding:'5px 10px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', fontSize:11, cursor:'pointer', color:'var(--text2)' }}
                        onClick={() => setNoteOpen(noteOpen===c.id?null:c.id)}>
                        📝 {note?'Edit':'Note'}
                      </button>
                      {status==='appointed' && (
                        <button style={{ padding:'5px 10px', border:'1px solid #1a7f37', borderRadius:6, background:'#eaf3de', fontSize:11, cursor:'pointer', color:'#1a7f37' }}
                          onClick={() => setApptOpen(apptOpen===c.id?null:c.id)}>
                          📅 {appt||'Set date'}
                        </button>
                      )}
                      <button className="btn btn-wa" onClick={() => openWA(c)} style={{ fontSize:12, padding:'5px 12px' }}>
                        📱 WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
