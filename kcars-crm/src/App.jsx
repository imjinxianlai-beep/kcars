import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import CRM from './pages/CRM'
import Reminders from './pages/Reminders'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('crm')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  if (!session) return <Login />

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <div className="topbar" style={{ background:'#fff', borderBottom:'2px solid #f0f0f0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div className="topbar-title">
            <img src="/logo.png" alt="K-Cars Auto Centre"
              style={{ height:36, width:'auto', objectFit:'contain', borderRadius:4 }} />
            <span className="topbar-badge">Singapore</span>
          </div>
          {/* Nav tabs */}
          <div style={{ display:'flex', gap:4 }}>
            {[
              { key:'crm',       label:'👥 Customers 客户' },
              { key:'reminders', label:'🔔 Reminders 提醒' },
            ].map(t => (
              <button key={t.key} onClick={() => setPage(t.key)}
                style={{
                  background: page===t.key ? 'var(--orange)' : '#f5f5f5',
                  color: page===t.key ? '#fff' : '#555',
                  border: 'none', borderRadius:6,
                  padding:'5px 12px', fontSize:12, fontWeight:600,
                  cursor:'pointer', transition:'.15s'
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize:12, color:'#666', display:'flex', alignItems:'center', gap:10 }}>
          <span>{session.user.email}</span>
          <button className="btn btn-ghost" style={{ color:'#888', fontSize:11 }}
            onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ flex:1, overflow:'auto' }}>
        {page === 'crm'       && <CRM session={session} embedded />}
        {page === 'reminders' && <Reminders />}
      </div>
    </div>
  )
}
