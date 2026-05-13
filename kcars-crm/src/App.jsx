import { useState, useEffect, useRef, useCallback, Suspense, lazy, Component } from 'react'
import { LayoutDashboard, Users, Bell, BarChart2, Columns3, Search, FileText, Wrench, User, X, AlertTriangle, Phone } from 'lucide-react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import { motion, AnimatePresence } from 'framer-motion'

const CRM       = lazy(() => import('./pages/CRM'))
const Reminders = lazy(() => import('./pages/Reminders'))
const Reports   = lazy(() => import('./pages/Reports'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Kanban    = lazy(() => import('./pages/Kanban'))

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}><AlertTriangle size={32} /></div>
        <div style={{ fontWeight:700, fontSize:15 }}>Something went wrong</div>
        <div style={{ fontSize:12, color:'#666', maxWidth:400, textAlign:'center', wordBreak:'break-all' }}>
          {this.state.error?.message}
        </div>
        <button onClick={() => window.location.reload()} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #ddd', cursor:'pointer', fontSize:13, background:'#fff' }}>
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

const PageFallback = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
    <div className="spinner" />
  </div>
)

const NAV_ITEMS = [
  { key: 'dashboard', Icon: LayoutDashboard, label: 'Dashboard 总览' },
  { key: 'crm',       Icon: Users,           label: 'Customers 客户' },
  { key: 'reminders', Icon: Bell,            label: 'Reminders 提醒' },
  { key: 'reports',   Icon: BarChart2,       label: 'Reports 报表' },
  { key: 'kanban',    Icon: Columns3,        label: 'Work Board 工单' },
]

export default function App() {
  const [session, setSession]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState('crm')
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [pendingCustomerId, setPendingCustomerId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#FAFAFA' }}>
      <div className="spinner" />
    </div>
  )

  if (!session) return <Login />

  return (
    <div className="app-shell">
      {/* ── Left Navigation Sidebar ── */}
      <nav className={`nav-sidebar ${navCollapsed ? 'collapsed' : ''}`}>
        <div className="nav-logo">
          <img src="/logo.png" alt="K-Cars" />
          {!navCollapsed && (
            <div className="nav-logo-text">
              K-Cars Auto
              <span>Auto Centre Singapore</span>
            </div>
          )}
        </div>

        <motion.div className="nav-items"
          variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="visible">
          {NAV_ITEMS.map(item => (
            <motion.button key={item.key}
              variants={{ hidden: { x: -16, opacity: 0 }, visible: { x: 0, opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } } }}
              className={`nav-item ${page === item.key ? 'active' : ''}`}
              onClick={() => setPage(item.key)}
              title={navCollapsed ? item.label : undefined}
              aria-current={page === item.key ? 'page' : undefined}
              whileTap={{ scale: 0.97 }}>
              <span className="nav-icon"><item.Icon size={16} /></span>
              {!navCollapsed && <span className="nav-label">{item.label}</span>}
            </motion.button>
          ))}
        </motion.div>

        <div className="nav-collapse-btn" onClick={() => setNavCollapsed(c => !c)}>
          <span>{navCollapsed ? '→' : '←'}</span>
          {!navCollapsed && <span>Collapse 收起</span>}
        </div>
      </nav>

      {/* ── Right Content Area ── */}
      <div className="app-content">
        {/* Top Bar */}
        <div className="topbar">
          <div className="topbar-search-wrap" onClick={() => setSearchOpen(true)}>
            <span className="topbar-search-icon"><Search size={14} /></span>
            <input
              readOnly
              placeholder="Search customers, plates, invoices... 搜索客户、车牌、发票"
              style={{ cursor: 'pointer' }}
            />
            <span className="topbar-kbd">⌘K</span>
          </div>

          <div className="topbar-right">
            <span className="topbar-user">{session.user.email}</span>
            <button className="btn btn-ghost"
              style={{ fontSize: 11, color: 'var(--text3)', padding: '5px 10px' }}
              onClick={() => supabase.auth.signOut()}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="page-content">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div key={page}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                style={{ height: '100%' }}>
                <Suspense fallback={<PageFallback />}>
                  {page === 'crm'       && <CRM session={session} onNavigate={setPage} pendingCustomerId={pendingCustomerId} onCustomerSelected={() => setPendingCustomerId(null)} />}
                  {page === 'reminders' && <Reminders />}
                  {page === 'reports'   && <Reports />}
                  {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
                  {page === 'kanban'    && <Kanban />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <div className="mobile-bottom-nav">
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            className={`mobile-nav-item ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
            aria-current={page === item.key ? 'page' : undefined}>
            <span className="mobile-nav-icon"><item.Icon size={20} /></span>
            <span>{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ── Global Search Overlay ── */}
      {searchOpen && (
        <GlobalSearch
          onClose={() => setSearchOpen(false)}
          onNavigate={(p, customerId) => {
            setPage(p)
            if (customerId) setPendingCustomerId(customerId)
            setSearchOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Global Search Overlay ──────────────────────────────────────────────────
function GlobalSearch({ onClose, onNavigate }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return }
    setLoading(true)
    const [custRes, invRes, itemRes] = await Promise.all([
      supabase.from('customers').select('id, name, car_plate, car_make, car_model, phone')
        .or(`name.ilike.%${q}%,car_plate.ilike.%${q}%,car_make.ilike.%${q}%,car_model.ilike.%${q}%`)
        .limit(5),
      supabase.from('invoices').select('id, invoice_no, date, total, customer_id, customers(name, car_plate)')
        .ilike('invoice_no', `%${q}%`).limit(5),
      supabase.from('invoice_items').select('id, description, invoice_id, invoices(invoice_no, customer_id, customers(name, car_plate))')
        .ilike('description', `%${q}%`).limit(5),
    ])
    setResults({
      customers: custRes.data || [],
      invoices:  invRes.data  || [],
      items:     itemRes.data || [],
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  const total = results ? results.customers.length + results.invoices.length + results.items.length : 0

  return (
    <div className="search-overlay-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="search-overlay">
        <div className="search-overlay-input">
          <Search size={18} color="var(--text3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search customers, plates, invoices, services... 搜索"
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          {loading && <div style={{ width:16, height:16, border:'2px solid var(--border)', borderTopColor:'var(--orange)', borderRadius:'50%', animation:'spin .6s linear infinite', flexShrink:0 }} />}
          <button onClick={onClose} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'var(--text3)', flexShrink:0 }}>ESC</button>
        </div>

        <div className="search-overlay-results">
          {!query.trim() && (
            <div style={{ padding:'32px 18px', textAlign:'center', color:'var(--text3)' }}>
              <Search size={32} style={{ margin:'0 auto 10px', display:'block' }} />
              <div style={{ fontSize:14 }}>Type to search customers, plates, invoices...</div>
              <div style={{ fontSize:12, marginTop:4 }}>搜索客户名、车牌、车型、发票号、维修项目</div>
            </div>
          )}

          {query.trim() && !loading && total === 0 && (
            <div style={{ padding:'32px 18px', textAlign:'center', color:'var(--text3)' }}>
              <X size={32} style={{ margin:'0 auto 10px', display:'block' }} />
              <div>No results for "<strong>{query}</strong>"</div>
            </div>
          )}

          {results && results.customers.length > 0 && (
            <>
              <div className="search-group-label" style={{ display:'flex', alignItems:'center', gap:5 }}><Users size={10} /> Customers 客户</div>
              {results.customers.map(c => (
                <div key={c.id} className="search-result-item"
                  onClick={() => onNavigate('crm', c.id)}>
                  <div style={{ width:32, height:32, borderRadius:8, background:'var(--orange-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><User size={15} color="var(--orange)" /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      <span style={{ color:'var(--orange)', fontFamily:'monospace', fontWeight:700 }}>{c.car_plate}</span>
                      {c.car_make && ` · ${c.car_make} ${c.car_model || ''}`}
                      {c.phone && <> · <Phone size={9} style={{margin:'0 2px'}} />{c.phone}</>}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {results && results.invoices.length > 0 && (
            <>
              <div className="search-group-label" style={{ marginTop:8, display:'flex', alignItems:'center', gap:5 }}><FileText size={10} /> Invoices 发票</div>
              {results.invoices.map(inv => (
                <div key={inv.id} className="search-result-item"
                  onClick={() => onNavigate('crm', inv.customer_id)}>
                  <div style={{ width:32, height:32, borderRadius:8, background:'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FileText size={15} color="var(--blue)" /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{inv.invoice_no}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {inv.customers?.name} · {inv.date}
                      <span style={{ color:'var(--orange)', marginLeft:8, fontWeight:600 }}>
                        ${parseFloat(inv.total||0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {results && results.items.length > 0 && (
            <>
              <div className="search-group-label" style={{ marginTop:8, display:'flex', alignItems:'center', gap:5 }}><Wrench size={10} /> Services 维修项目</div>
              {results.items.map(it => (
                <div key={it.id} className="search-result-item"
                  onClick={() => onNavigate('crm', it.invoices?.customer_id)}>
                  <div style={{ width:32, height:32, borderRadius:8, background:'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Wrench size={15} color="var(--green)" /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{it.description}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {it.invoices?.customers?.name} · {it.invoices?.invoice_no}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {results && total > 0 && (
          <div style={{ padding:'8px 18px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text3)', flexShrink:0 }}>
            {total} results · Click to open customer detail 点击跳转到客户详情
          </div>
        )}
      </div>
    </div>
  )
}

