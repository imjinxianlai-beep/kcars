import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERVICE_INTERVAL_DAYS = 180  // 6 months
const REMIND_BEFORE_DAYS    = 7    // 1 week before due

const STATUSES = {
  pending:    { label: 'Not Contacted', emoji: '⬜', color: '#888',    bg: '#f5f5f5' },
  messaged:   { label: 'Msg Sent',      emoji: '📱', color: '#185fa5', bg: '#e6f1fb' },
  appointed:  { label: 'Appointed',     emoji: '📅', color: '#1a7f37', bg: '#eaf3de' },
  sold:       { label: 'Car Sold',      emoji: '🚗', color: '#D85A30', bg: '#fff3ef' },
  skip:       { label: 'No Follow-up',  emoji: '❌', color: '#e74c3c', bg: '#fff0f0' },
}

const buildMessage = (name, plate, dueDate, overdue=false) => {
  if (overdue) {
    return `Hi ${name}, this is K-Cars Auto Centre.\n\nYour vehicle ${plate} was due for servicing on ${dueDate}.\n\nPlease come in as soon as possible to avoid any issues with your vehicle.\n\nCall or WhatsApp us: +65 9321 5151\n\nThank you!\nK-Cars Auto Centre`
  }
  return `Hi ${name}, this is K-Cars Auto Centre.\n\nYour vehicle ${plate} is due for servicing on ${dueDate}.\n\nBook your appointment now to keep your car in top condition!\n\nCall or WhatsApp us: +65 9321 5151\n\nThank you!\nK-Cars Auto Centre`
}

export default function Reminders() {
  const [groups, setGroups]     = useState({ upcoming: [], overdue: [], recent: [] })
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [tab, setTab]           = useState('overdue')
  const [statuses, setStatuses] = useState({})   // custId → status key
  const [notes, setNotes]       = useState({})   // custId → note string
  const [noteOpen, setNoteOpen] = useState(null) // custId with open note input
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    loadReminders()
    loadStatuses()
  }, [])

  async function loadStatuses() {
    // Store follow-up statuses in supabase customers.notes field
    // We use localStorage as a lightweight store for this session
    const saved = localStorage.getItem('kcars_reminder_statuses')
    if (saved) setStatuses(JSON.parse(saved))
    const savedNotes = localStorage.getItem('kcars_reminder_notes')
    if (savedNotes) setNotes(JSON.parse(savedNotes))
  }

  function saveStatus(custId, status) {
    const updated = { ...statuses, [custId]: status }
    setStatuses(updated)
    localStorage.setItem('kcars_reminder_statuses', JSON.stringify(updated))
  }

  function saveNote(custId, note) {
    const updated = { ...notes, [custId]: note }
    setNotes(updated)
    localStorage.setItem('kcars_reminder_notes', JSON.stringify(updated))
  }

  async function loadReminders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('date, customer_id, customers(id, name, phone, car_plate, car_make, car_model)')
      .not('date', 'is', null)
      .order('date', { ascending: false })
      .limit(20000)

    if (error) { console.error(error); setLoading(false); return }

    const custMap = {}
    for (const row of data) {
      if (!row.customers) continue
      const cid = row.customer_id
      if (!custMap[cid]) custMap[cid] = { ...row.customers, lastDate: row.date }
    }

    const today = new Date(); today.setHours(0,0,0,0)
    const upcoming = [], overdue = [], recent = []

    for (const c of Object.values(custMap)) {
      const lastDate  = new Date(c.lastDate)
      const dueDate   = new Date(lastDate)
      dueDate.setDate(dueDate.getDate() + SERVICE_INTERVAL_DAYS)
      const daysUntilDue  = Math.ceil((dueDate - today) / 86400000)
      const daysSinceLast = Math.ceil((today - lastDate) / 86400000)
      const entry = { ...c, lastDate: c.lastDate, dueDate: dueDate.toISOString().split('T')[0], daysUntilDue, daysSinceLast }

      if (daysUntilDue < 0)                          overdue.push(entry)
      else if (daysUntilDue <= REMIND_BEFORE_DAYS)   upcoming.push(entry)
      else if (daysSinceLast <= 30)                  recent.push(entry)
    }

    overdue.sort((a,b)  => a.daysUntilDue - b.daysUntilDue)
    upcoming.sort((a,b) => a.daysUntilDue - b.daysUntilDue)
    setGroups({ upcoming, overdue, recent })
    setLoading(false)
  }

  const currentList = (groups[tab] || []).filter(c => {
    if (filterStatus === 'all') return true
    const s = statuses[c.id] || 'pending'
    return s === filterStatus
  })

  const toggleSelect = (id) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const toggleAll = () => {
    if (selected.size === currentList.length) setSelected(new Set())
    else setSelected(new Set(currentList.map(c => c.id)))
  }

  const openWA = (c) => {
    const msg = encodeURIComponent(buildMessage(c.name, c.car_plate, c.dueDate, c.daysUntilDue < 0))
    const phone = (c.phone || '').replace(/\D/g,'')
    window.open(phone ? `https://wa.me/65${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
    // Auto-mark as messaged
    if ((statuses[c.id] || 'pending') === 'pending') saveStatus(c.id, 'messaged')
  }

  const bulkSend = async () => {
    const toSend = currentList.filter(c => selected.has(c.id))
    if (!toSend.length) { alert('Please select customers first.'); return }
    for (const c of toSend) {
      openWA(c)
      await new Promise(r => setTimeout(r, 800))
    }
  }

  const statusCounts = (groups[tab] || []).reduce((acc, c) => {
    const s = statuses[c.id] || 'pending'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ padding:'16px 20px', maxWidth:960, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>🔔 Service Reminders 保养提醒</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
            Cycle: 6 months · Remind: 1 week before · Based on last invoice date
          </div>
        </div>
        <button className="btn" onClick={loadReminders} style={{ fontSize:12 }}>🔄 Refresh</button>
      </div>

      {/* Tab cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {[
          { key:'overdue',  label:'Overdue 已过期',        color:'#e74c3c', icon:'⚠️' },
          { key:'upcoming', label:'Due Soon 即将到期',     color:'var(--orange)', icon:'🔔' },
          { key:'recent',   label:'Recently Serviced 已保养', color:'#1a7f37', icon:'✅' },
        ].map(t => (
          <div key={t.key} onClick={() => { setTab(t.key); setSelected(new Set()); setFilterStatus('all') }}
            style={{
              background: tab===t.key ? t.color : '#fff',
              color: tab===t.key ? '#fff' : '#111',
              border: `2px solid ${t.color}`, borderRadius:10,
              padding:'12px 16px', cursor:'pointer', transition:'.15s'
            }}>
            <div style={{ fontSize:22, fontWeight:700 }}>{t.icon} {groups[t.key]?.length || 0}</div>
            <div style={{ fontSize:12, marginTop:2, opacity:.85 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      {tab !== 'recent' && (
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
          <button onClick={() => setFilterStatus('all')}
            className={`btn ${filterStatus==='all'?'btn-primary':''}`}
            style={{ fontSize:11 }}>All ({(groups[tab]||[]).length})</button>
          {Object.entries(STATUSES).map(([key, s]) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              style={{
                padding:'5px 10px', borderRadius:20, border:'none', fontSize:11,
                fontWeight:600, cursor:'pointer',
                background: filterStatus===key ? s.color : s.bg,
                color: filterStatus===key ? '#fff' : s.color,
              }}>
              {s.emoji} {s.label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      {tab !== 'recent' && currentList.length > 0 && (
        <div style={{
          background:'#fff', border:'1px solid var(--border)', borderRadius:10,
          padding:'10px 14px', marginBottom:12,
          display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'
        }}>
          <input type="checkbox"
            checked={selected.size === currentList.length && currentList.length > 0}
            onChange={toggleAll}
            style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer' }} />
          <span style={{ fontSize:13, flex:1 }}>
            {selected.size > 0 ? `${selected.size} selected` : 'Select all 全选'}
          </span>
          {selected.size > 0 && (
            <button className="btn btn-wa" onClick={bulkSend} style={{ fontSize:12 }}>
              📱 Send WhatsApp to {selected.size} customers
            </button>
          )}
        </div>
      )}

      {/* Customer list */}
      {loading ? <div className="spinner" /> : currentList.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'var(--text3)' }}>
          <div style={{ fontSize:36 }}>{tab==='recent'?'✅':'🎉'}</div>
          <div style={{ fontSize:14, marginTop:8 }}>
            {filterStatus !== 'all' ? `No customers with "${STATUSES[filterStatus]?.label}" status` :
             tab==='upcoming' ? 'No customers due this week!' :
             tab==='overdue'  ? 'No overdue customers!' : 'No recent services.'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {currentList.map(c => {
            const status = statuses[c.id] || 'pending'
            const st = STATUSES[status]
            const note = notes[c.id] || ''
            const isSold = status === 'sold'

            return (
              <div key={c.id} style={{
                background:'#fff', border:'1px solid var(--border)', borderRadius:10,
                padding:'12px 14px', opacity: isSold ? .5 : 1,
                borderLeft: selected.has(c.id) ? '3px solid var(--orange)' : '1px solid var(--border)',
                boxShadow:'var(--shadow)'
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  {/* Checkbox */}
                  {tab !== 'recent' && (
                    <input type="checkbox" checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer', marginTop:3, flexShrink:0 }} />
                  )}

                  {/* Customer info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:14 }}>{c.name}</span>
                      <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--orange)', fontWeight:700 }}>{c.car_plate}</span>
                      {/* Due badge */}
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        background: c.daysUntilDue < 0 ? '#ffeaea' : '#fff3ef',
                        color: c.daysUntilDue < 0 ? '#e74c3c' : 'var(--orange)'
                      }}>
                        {c.daysUntilDue < 0 ? `逾期 ${Math.abs(c.daysUntilDue)} 天` : `还有 ${c.daysUntilDue} 天`}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
                      {c.car_make} {c.car_model}
                      &nbsp;·&nbsp; Last: {c.lastDate}
                      &nbsp;·&nbsp; Due: {c.dueDate}
                      {c.phone && <span> &nbsp;·&nbsp; 📱 {c.phone}</span>}
                    </div>
                    {/* Note */}
                    {note && noteOpen !== c.id && (
                      <div style={{ fontSize:11, color:'var(--text2)', marginTop:4, padding:'3px 8px', background:'#f9f9f9', borderRadius:6, display:'inline-block' }}>
                        📝 {note}
                      </div>
                    )}
                    {noteOpen === c.id && (
                      <div style={{ marginTop:8, display:'flex', gap:6 }}>
                        <input
                          autoFocus
                          defaultValue={note}
                          placeholder="Add a note... e.g. Car sold, Changed workshop"
                          style={{ flex:1, padding:'5px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:12, outline:'none' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { saveNote(c.id, e.target.value); setNoteOpen(null) }
                            if (e.key === 'Escape') setNoteOpen(null)
                          }}
                        />
                        <button className="btn btn-primary" style={{ fontSize:11, padding:'5px 10px' }}
                          onClick={e => {
                            const input = e.target.closest('div').querySelector('input')
                            saveNote(c.id, input.value); setNoteOpen(null)
                          }}>Save</button>
                        <button className="btn" style={{ fontSize:11, padding:'5px 8px' }}
                          onClick={() => setNoteOpen(null)}>✕</button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
                    {/* Status dropdown */}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end' }}>
                      {Object.entries(STATUSES).map(([key, s]) => (
                        <button key={key}
                          onClick={() => saveStatus(c.id, key)}
                          title={s.label}
                          style={{
                            padding:'3px 8px', borderRadius:20, border:'none',
                            fontSize:11, fontWeight:600, cursor:'pointer',
                            background: status===key ? s.color : s.bg,
                            color: status===key ? '#fff' : s.color,
                            opacity: status===key ? 1 : .7,
                            transition:'.15s'
                          }}>
                          {s.emoji} {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Buttons row */}
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={{ padding:'5px 10px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', fontSize:11, cursor:'pointer', color:'var(--text2)' }}
                        onClick={() => setNoteOpen(noteOpen===c.id ? null : c.id)}>
                        📝 {note ? 'Edit note' : 'Add note'}
                      </button>
                      {tab !== 'recent' && (
                        <button className="btn btn-wa" onClick={() => openWA(c)} style={{ fontSize:12, padding:'5px 12px' }}>
                          📱 WhatsApp
                        </button>
                      )}
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
