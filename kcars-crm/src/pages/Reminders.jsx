import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Bell, MessageCircle, Calendar, Car, XCircle, CheckCircle2, RefreshCw, Phone } from 'lucide-react'

const SERVICE_INTERVAL_DAYS = 180
const REMIND_BEFORE_DAYS    = 7

const buildMessage = (name, plate, dueDate, overdue=false) => {
  if (overdue) return `Hi ${name}, this is K-Cars Auto Centre.\n\nYour vehicle ${plate} was due for servicing on ${dueDate}.\n\nPlease come in as soon as possible to avoid any issues with your vehicle.\n\nCall or WhatsApp us: +65 9321 5151\n\nThank you!\nK-Cars Auto Centre`
  return `Hi ${name}, this is K-Cars Auto Centre.\n\nYour vehicle ${plate} is due for servicing on ${dueDate}.\n\nBook your appointment now to keep your car in top condition!\n\nCall or WhatsApp us: +65 9321 5151\n\nThank you!\nK-Cars Auto Centre`
}

const load = (key, def) => { try { return JSON.parse(localStorage.getItem(key)) || def } catch { return def } }
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))

export default function Reminders() {
  const [allList, setAllList]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('overdue')
  const [statuses, setStatuses]   = useState(() => load('kcars_statuses', {}))
  const [notes, setNotes]         = useState(() => load('kcars_notes', {}))
  const [apptDates, setApptDates] = useState(() => load('kcars_appts', {}))
  const [noteOpen, setNoteOpen]   = useState(null)
  const [apptOpen, setApptOpen]   = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [fading, setFading]       = useState(new Set())

  useEffect(() => { loadReminders() }, [])

  async function loadReminders() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('date, customer_id, customers(id, name, phone, car_plate, car_make, car_model)')
      .not('date', 'is', null).order('date', { ascending: false }).limit(20000)

    const custMap = {}
    for (const row of data || []) {
      if (!row.customers) continue
      if (!custMap[row.customer_id]) custMap[row.customer_id] = { ...row.customers, lastDate: row.date }
    }

    const today = new Date(); today.setHours(0,0,0,0)
    const list = Object.values(custMap).map(c => {
      const lastDate = new Date(c.lastDate)
      const dueDate  = new Date(lastDate)
      dueDate.setDate(dueDate.getDate() + SERVICE_INTERVAL_DAYS)
      const daysUntilDue  = Math.ceil((dueDate - today) / 86400000)
      const daysSinceLast = Math.ceil((today - lastDate) / 86400000)
      return { ...c, dueDate: dueDate.toISOString().split('T')[0], daysUntilDue, daysSinceLast }
    })
    setAllList(list)
    setLoading(false)
  }

  const getStatus = (id) => statuses[id] || 'pending'
  const FOLLOWUP  = ['messaged','appointed','sold','skip']

  const isOverdue  = (c) => c.daysUntilDue < 0
  const isUpcoming = (c) => c.daysUntilDue >= 0 && c.daysUntilDue <= REMIND_BEFORE_DAYS
  const isRecent   = (c) => c.daysSinceLast <= 30 && c.daysUntilDue > REMIND_BEFORE_DAYS
  const needsAction= (c) => isOverdue(c) || isUpcoming(c)

  const overdue_list   = allList.filter(c => isOverdue(c)  && !FOLLOWUP.includes(getStatus(c.id)))
  const upcoming_list  = allList.filter(c => isUpcoming(c) && !FOLLOWUP.includes(getStatus(c.id)))
  const messaged_list  = allList.filter(c => needsAction(c) && getStatus(c.id)==='messaged')
  const appointed_list = allList.filter(c => needsAction(c) && getStatus(c.id)==='appointed')
  const sold_list      = allList.filter(c => needsAction(c) && getStatus(c.id)==='sold')
  const skip_list      = allList.filter(c => needsAction(c) && getStatus(c.id)==='skip')
  const recent_list    = allList.filter(c => isRecent(c))

  const TABS = [
    { key:'overdue',   Icon: AlertTriangle, label:'Overdue 已过期',    count: overdue_list.length,   color:'#e74c3c' },
    { key:'upcoming',  Icon: Bell,          label:'Due Soon 即将到期', count: upcoming_list.length,  color:'#D85A30' },
    { key:'messaged',  Icon: MessageCircle, label:'Msg Sent 已发信',   count: messaged_list.length,  color:'#185fa5' },
    { key:'appointed', Icon: Calendar,      label:'Appointed 已预约',  count: appointed_list.length, color:'#1a7f37' },
    { key:'sold',      Icon: Car,           label:'Car Sold 已卖车',   count: sold_list.length,      color:'#D85A30' },
    { key:'skip',      Icon: XCircle,       label:'Skip 无需跟进',      count: skip_list.length,      color:'#888' },
    { key:'recent',    Icon: CheckCircle2,  label:'Serviced 已保养',   count: recent_list.length,    color:'#27ae60' },
  ]

  const currentList =
    tab==='overdue'   ? overdue_list   :
    tab==='upcoming'  ? upcoming_list  :
    tab==='messaged'  ? messaged_list  :
    tab==='appointed' ? appointed_list :
    tab==='sold'      ? sold_list      :
    tab==='skip'      ? skip_list      :
    recent_list

  const setStatus = (id, newStatus) => {
    if (FOLLOWUP.includes(newStatus)) {
      setFading(f => new Set([...f, id]))
      setTimeout(() => {
        const updated = { ...statuses, [id]: newStatus }
        setStatuses(updated); save('kcars_statuses', updated)
        setFading(f => { const n=new Set(f); n.delete(id); return n })
      }, 500)
    } else {
      const updated = { ...statuses, [id]: newStatus }
      setStatuses(updated); save('kcars_statuses', updated)
    }
  }

  const setNote  = (id, n) => { const u={...notes,[id]:n};    setNotes(u);      save('kcars_notes',u) }
  const setAppt  = (id, d) => { const u={...apptDates,[id]:d};setApptDates(u);  save('kcars_appts',u); setStatus(id,'appointed') }

  const openWA = (c) => {
    const msg = encodeURIComponent(buildMessage(c.name, c.car_plate, c.dueDate, c.daysUntilDue < 0))
    const phone = (c.phone||'').replace(/\D/g,'')
    window.open(phone ? `https://wa.me/65${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
    if (getStatus(c.id)==='pending') setStatus(c.id,'messaged')
  }

  const toggleSelect = (id) => { const s=new Set(selected); s.has(id)?s.delete(id):s.add(id); setSelected(s) }
  const toggleAll    = () => { if(selected.size===currentList.length)setSelected(new Set()); else setSelected(new Set(currentList.map(c=>c.id))) }
  const bulkSend     = async () => {
    const toSend = currentList.filter(c=>selected.has(c.id))
    if(!toSend.length){alert('Please select customers first.');return}
    for(const c of toSend){openWA(c);await new Promise(r=>setTimeout(r,800))}
  }

  const canBulk = tab==='overdue' || tab==='upcoming'

  return (
    <div style={{height:'100%',overflow:'auto'}}>
    <div style={{padding:'16px 20px',maxWidth:960,margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,display:'flex',alignItems:'center',gap:8,fontFamily:"'Syne',sans-serif"}}><Bell size={20} /> Service Reminders 保养提醒</div>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:3}}>Cycle: 6 months · Remind: 1 week before</div>
        </div>
        <button className="btn" onClick={loadReminders} style={{display:'flex',alignItems:'center',gap:5,fontSize:12}}><RefreshCw size={12} /> Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => {setTab(t.key);setSelected(new Set())}}
            style={{
              background: tab===t.key ? t.color : 'var(--card)',
              color: tab===t.key ? '#fff' : 'var(--text)',
              border: `1.5px solid ${tab===t.key ? t.color : 'var(--border)'}`, borderRadius:10,
              padding:'8px 12px', cursor:'pointer', transition:'background .15s, border-color .15s',
              minWidth:110, flex:'1 1 110px', fontFamily:'inherit',
            }}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
              <t.Icon size={13} />
              <span style={{fontSize:18,fontWeight:700}}>{t.count}</span>
            </div>
            <div style={{fontSize:10,opacity:.85,lineHeight:1.3,textAlign:'left'}}>{t.label}</div>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {canBulk && currentList.length > 0 && (
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <input type="checkbox" checked={selected.size===currentList.length&&currentList.length>0} onChange={toggleAll}
            style={{width:16,height:16,accentColor:'var(--orange)',cursor:'pointer'}} />
          <span style={{fontSize:13,flex:1}}>{selected.size>0?`${selected.size} selected`:'Select all 全选'}</span>
          {selected.size>0 && (
            <button className="btn btn-wa" onClick={bulkSend} style={{display:'flex',alignItems:'center',gap:5,fontSize:12}}>
              <MessageCircle size={13} /> Send WhatsApp to {selected.size} customers
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? <div className="spinner"/> : currentList.length===0 ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--text3)'}}>
          <CheckCircle2 size={40} style={{margin:'0 auto 8px'}} />
          <div style={{fontSize:14}}>No customers in this category</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {currentList.map(c => {
            const status = getStatus(c.id)
            const note   = notes[c.id]||''
            const appt   = apptDates[c.id]||''

            return (
              <div key={c.id} style={{
                background:'#fff', border:'1px solid var(--border)', borderRadius:10,
                padding:'12px 14px',
                opacity: fading.has(c.id) ? 0 : status==='sold' ? .55 : 1,
                transform: fading.has(c.id) ? 'translateX(20px)' : 'none',
                transition:'opacity .4s, transform .4s',
                borderLeft: selected.has(c.id) ? '3px solid var(--orange)' : '1px solid var(--border)',
              }}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                  {/* Checkbox */}
                  {canBulk && (
                    <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggleSelect(c.id)}
                      style={{width:16,height:16,accentColor:'var(--orange)',cursor:'pointer',marginTop:3,flexShrink:0}} />
                  )}

                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontWeight:700,fontSize:14}}>{c.name}</span>
                      <span style={{fontFamily:'monospace',fontSize:12,color:'var(--orange)',fontWeight:700}}>{c.car_plate}</span>
                      <span style={{
                        fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,
                        background:c.daysUntilDue<0?'#ffeaea':'#fff3ef',
                        color:c.daysUntilDue<0?'#e74c3c':'var(--orange)'
                      }}>
                        {c.daysUntilDue<0?`逾期 ${Math.abs(c.daysUntilDue)} 天`:`还有 ${c.daysUntilDue} 天`}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text3)',marginTop:3}}>
                      {c.car_make} {c.car_model} · Last: {c.lastDate} · Due: {c.dueDate}
                      {c.phone && <span style={{display:'inline-flex',alignItems:'center',gap:3}}> · <Phone size={10} /> {c.phone}</span>}
                    </div>
                    {appt && <div style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#1a7f37',marginTop:4,fontWeight:600}}><Calendar size={11} /> Appointment: {appt}</div>}
                    {note && noteOpen!==c.id && (
                      <div style={{fontSize:11,color:'var(--text2)',marginTop:4,padding:'3px 8px',background:'var(--bg2)',borderRadius:6,display:'inline-block'}}>
                        {note}
                      </div>
                    )}
                    {noteOpen===c.id && (
                      <div style={{marginTop:8,display:'flex',gap:6}}>
                        <input autoFocus defaultValue={note} placeholder="Add a note..."
                          style={{flex:1,padding:'5px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:12,outline:'none'}}
                          onKeyDown={e=>{if(e.key==='Enter'){setNote(c.id,e.target.value);setNoteOpen(null)}if(e.key==='Escape')setNoteOpen(null)}} />
                        <button className="btn btn-primary" style={{fontSize:11,padding:'5px 10px'}}
                          onClick={e=>{setNote(c.id,e.target.closest('div').querySelector('input').value);setNoteOpen(null)}}>Save</button>
                        <button className="btn" style={{fontSize:11}} onClick={()=>setNoteOpen(null)}>✕</button>
                      </div>
                    )}
                    {apptOpen===c.id && (
                      <div style={{marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
                        <span style={{fontSize:12,color:'var(--text3)'}}>Appointment date:</span>
                        <input type="date" defaultValue={appt}
                          style={{padding:'4px 8px',border:'1px solid var(--border)',borderRadius:6,fontSize:12,outline:'none'}}
                          onChange={e=>{if(e.target.value){setAppt(c.id,e.target.value);setApptOpen(null)}}} />
                        <button className="btn" style={{fontSize:11}} onClick={()=>setApptOpen(null)}>✕</button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flexShrink:0}}>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {[
                        {key:'messaged',  label:'Msg Sent',  color:'#185fa5', bg:'#e6f1fb'},
                        {key:'appointed', label:'Appointed', color:'#1a7f37', bg:'#eaf3de'},
                        {key:'sold',      label:'Car Sold',  color:'#D85A30', bg:'#fff3ef'},
                        {key:'skip',      label:'Skip',       color:'#888',    bg:'#f5f5f5'},
                      ].map(s => (
                        <button key={s.key}
                          onClick={() => {
                            const newS = status===s.key ? 'pending' : s.key
                            setStatus(c.id, newS)
                            if(s.key==='appointed' && newS==='appointed') setTimeout(()=>setApptOpen(c.id),550)
                          }}
                          style={{
                            padding:'3px 10px',borderRadius:20,border:'none',fontSize:11,
                            fontWeight:600,cursor:'pointer',transition:'.15s',
                            background:status===s.key?s.color:s.bg,
                            color:status===s.key?'#fff':s.color,
                          }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',fontSize:11,cursor:'pointer',color:'var(--text2)',fontFamily:'inherit'}}
                        onClick={()=>setNoteOpen(noteOpen===c.id?null:c.id)}>
                        <MessageCircle size={11} /> {note?'Edit':'Note'}
                      </button>
                      {status==='appointed' && (
                        <button style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',border:'1px solid #1a7f37',borderRadius:6,background:'#eaf3de',fontSize:11,cursor:'pointer',color:'#1a7f37',fontFamily:'inherit'}}
                          onClick={()=>setApptOpen(apptOpen===c.id?null:c.id)}>
                          <Calendar size={11} /> {appt||'Set date'}
                        </button>
                      )}
                      <button className="btn btn-wa" onClick={()=>openWA(c)} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,padding:'5px 12px'}}>
                        <MessageCircle size={13} /> WhatsApp
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
    </div>
  )
}
