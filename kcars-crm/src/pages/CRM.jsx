import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, Pencil, Trash2, MessageCircle, Car, ClipboardList, Wrench, Phone, Calendar, FileText, Download, Printer, CheckCircle2, DollarSign, Clock, AlertTriangle } from 'lucide-react'
import { supabase, getCustomers, getTotalCustomers, searchCustomers, getCustomer, getInvoices, deleteCustomer,
  upsertCustomer, updateCustomerTags, createInvoice, updateInvoice, updateInvoiceStatus,
  deleteInvoice, voidInvoice, getCatalog,
  getVehicles, addVehicle, updateVehicle, deleteVehicle, setPrimaryVehicle,
  getVehicleMakes, getVehicleModels,
  getActivities, addActivity, deleteActivity,
  getNotes, addNote, updateNote, deleteNote,
  getTasks, addTask, updateTask, deleteTask,
} from '../lib/supabase'
import { printInvoice, downloadInvoice } from '../lib/pdf'
import InvoiceModal from '../components/InvoiceModal'

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`
const fmtSGD = (n) => `SGD $${parseFloat(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`

const AVATAR_PALETTE = [
  { bg:'#FEF0EB', fg:'#D85A30' },
  { bg:'#DBEAFE', fg:'#2563EB' },
  { bg:'#DCFCE7', fg:'#16A34A' },
  { bg:'#FEE2E2', fg:'#DC2626' },
  { bg:'#FEF3C7', fg:'#D97706' },
  { bg:'#E0F2FE', fg:'#0284C7' },
  { bg:'#F0FDF4', fg:'#15803D' },
]
const getAvatarPalette = (name = '') => AVATAR_PALETTE[(name.charCodeAt(0) || 0) % AVATAR_PALETTE.length]
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

function CustAvatar({ name = '', size = 32, type = 'individual' }) {
  if (type === 'company') {
    return (
      <div style={{
        width: size, height: size, borderRadius: Math.round(size * 0.22),
        background: '#2d3748', color: '#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: Math.round(size * 0.3), fontWeight: 700, flexShrink: 0,
        letterSpacing: '-.3px',
      }}>Co</div>
    )
  }
  const { bg, fg } = getAvatarPalette(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      background: bg, color: fg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: Math.round(size * 0.37), fontWeight: 700, flexShrink: 0,
      letterSpacing: '-.5px',
    }}>{getInitials(name)}</div>
  )
}

const statusColors = { draft: 'tag-draft', confirmed: 'tag-confirmed', paid: 'tag-paid' }
const statusLabels = { draft: 'Draft 草稿', confirmed: 'Confirmed 已确认', paid: 'Paid 已付款' }

const PRESET_TAGS = [
  { key: 'vip',      label: 'VIP',             bg: '#FEF3C7', color: '#D97706' },
  { key: 'regular',  label: 'Regular 常客',    bg: '#DBEAFE', color: '#2563EB' },
  { key: 'new',      label: 'New 新客户',      bg: '#DCFCE7', color: '#16A34A' },
  { key: 'problem',  label: 'Problem',         bg: '#FEE2E2', color: '#DC2626' },
  { key: 'sold_car', label: 'Sold Car 已卖车', bg: '#F3F4F6', color: '#6B7280' },
]

const tagMeta = Object.fromEntries(PRESET_TAGS.map(t => [t.key, t]))

export default function CRM({ session, pendingCustomerId, onCustomerSelected }) {
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [catalog, setCatalog] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [mobileView, setMobileView] = useState('list') // list | detail
  const [openInv, setOpenInv] = useState(null)
  const [modal, setModal] = useState(null) // null | 'customer' | 'invoice' | 'catalog'
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [tagFilter, setTagFilter] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [activeVehicle, setActiveVehicle] = useState(null)
  const searchRef = useRef(null)

  // Load customers on mount
  useEffect(() => {
    loadCustomers()
    loadCatalog()
    // Real-time: refresh customer list when any change
    const sub = supabase.channel('crm-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        if (selected) loadInvoices(selected.id)
        loadCustomers()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, loadCustomers)
      .subscribe()
    return () => sub.unsubscribe()
  }, [])

  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 1000

  const loadCustomers = async (p = 0) => {
    const from = p * PAGE_SIZE
    const { data, count } = await getCustomers(from, from + PAGE_SIZE - 1)
    setCustomers(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  const loadCatalog = async () => {
    const { data } = await getCatalog()
    setCatalog(data || [])
  }

  const loadInvoices = async (custId) => {
    const { data } = await getInvoices(custId)
    setInvoices(data || [])
  }

  const loadVehicles = async (custId) => {
    const { data } = await getVehicles(custId)
    const vList = data || []
    setVehicles(vList)
    setActiveVehicle(vList.find(v => v.is_primary) || vList[0] || null)
  }

  // Search debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) { loadCustomers(); return }
      const { data } = await searchCustomers(search)
      setCustomers(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const selectCustomer = async (c) => {
    setSelected(c)
    setOpenInv(null)
    setMobileView('detail')
    await Promise.all([loadInvoices(c.id), loadVehicles(c.id)])
  }

  // Auto-select customer when navigating from global search
  useEffect(() => {
    if (!pendingCustomerId) return
    getCustomer(pendingCustomerId).then(({ data }) => {
      if (data) selectCustomer(data)
      onCustomerSelected?.()
    })
  }, [pendingCustomerId])

  const activeInvoices = invoices.filter(i => !i.voided_at)
  const stats = {
    customers: customers.length,
    invoices: activeInvoices.length,
    revenue: activeInvoices.reduce((a, i) => a + (parseFloat(i.total) || 0), 0),
    unpaid: activeInvoices.filter(i => i.status !== 'paid').length,
  }

  // Filter invoices by selected vehicle during render — no extra useEffect needed
  const filteredInvoices = activeVehicle
    ? invoices.filter(i => i.vehicle_id === activeVehicle.id)
    : invoices

  const totalAllRev = customers.reduce((a) => a, 0)

  return (
    <div className="crm-shell">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">Customers 客户</div>
          <div className="stat-val">{(search ? customers.length : totalCount).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Invoices 发票</div>
          <div className="stat-val">{selected ? invoices.length : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenue 营业额</div>
          <div className="stat-val orange">{selected ? fmtSGD(stats.revenue) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unpaid 未付款</div>
          <div className="stat-val" style={{ color: stats.unpaid > 0 ? 'var(--red)' : '' }}>
            {selected ? stats.unpaid : '—'}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <div className={`sidebar ${mobileView === 'detail' ? 'hidden' : ''}`}>
          <div className="sidebar-search">
            <input ref={searchRef} value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, plate, model..." />
          </div>
          <div className="sidebar-actions">
            <button className="btn-add" onClick={() => setModal('customer')}>
              <Plus size={13} /> Add Customer 新增客户
            </button>
          </div>

          {/* Tag filter */}
          <div style={{ padding:'6px 8px', borderBottom:'1px solid var(--border2)', display:'flex', gap:4, flexWrap:'wrap' }}>
            <button onClick={() => setTagFilter(null)} style={{
              padding:'2px 8px', borderRadius:20, border:'1px solid var(--border)',
              fontSize:10, fontWeight:600, cursor:'pointer',
              background: tagFilter === null ? 'var(--orange)' : 'transparent',
              color: tagFilter === null ? '#fff' : 'var(--text3)',
            }}>All</button>
            {PRESET_TAGS.map(t => (
              <button key={t.key} onClick={() => setTagFilter(tagFilter === t.key ? null : t.key)} style={{
                padding:'2px 8px', borderRadius:20, border:`1px solid ${t.color}40`,
                fontSize:10, fontWeight:600, cursor:'pointer',
                background: tagFilter === t.key ? t.bg : 'transparent',
                color: tagFilter === t.key ? t.color : 'var(--text3)',
              }}>{t.emoji}</button>
            ))}
          </div>

          <div className="sidebar-count">
            {search ? `${customers.length} results` : `Showing ${customers.length.toLocaleString()} of ${totalCount.toLocaleString()} customers`}
          </div>
          <div className="cust-list">
            {loading ? <div className="spinner" /> :
              customers.slice(0, 300)
                .filter(c => !tagFilter || (c.tags || []).includes(tagFilter))
                .map((c, idx) => {
                  const pv = c.vehicles?.find(v => v.is_primary) || c.vehicles?.[0]
                  return (
                  <motion.div key={c.id}
                    className={`cust-item ${selected?.id === c.id ? 'active' : ''}`}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.3) }}
                    onClick={() => selectCustomer(c)}>
                    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <CustAvatar name={c.name} size={34} type={c.customer_type} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="cust-name">{c.name}</div>
                        {c.customer_type === 'company' && c.contact_person && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>{c.contact_person}</div>
                        )}
                        <div className="cust-plate">{pv?.car_plate || c.car_plate}</div>
                        <div className="cust-sub">{pv?.car_make || c.car_make} {pv?.car_model || c.car_model}</div>
                        {(c.tags || []).length > 0 && (
                          <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:3 }}>
                            {(c.tags || []).map(tag => {
                              const m = tagMeta[tag]; if (!m) return null
                              return <span key={tag} style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:9, padding:'1px 6px', borderRadius:20, background:m.bg, color:m.color, fontWeight:700 }}>
                                <span style={{ width:4, height:4, borderRadius:'50%', background:m.color, display:'inline-block', flexShrink:0 }} />
                                {m.label}
                              </span>
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  )
                })}
            {customers.length > 300 && (
              <div className="sidebar-count">Showing 300 of {customers.length} — search to narrow</div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className={`detail-panel ${mobileView === 'detail' ? 'active' : ''}`}>
          {!selected ? (
            <div className="detail-empty">
              <Car size={52} color="var(--text3)" />
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select a customer</div>
              <div>Search by name, plate number, or model</div>
            </div>
          ) : (
            <motion.div key={selected.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}>
              <button className="mobile-back" onClick={() => { setMobileView('list'); setSelected(null) }}>
                › Back to list
              </button>

              {/* Customer Header */}
              <div className="card">
                <div className="card-header">
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <CustAvatar name={selected.name} size={48} type={selected.customer_type} />
                    <div>
                      <div className="customer-name">{selected.name}</div>
                      <div className="customer-meta">
                        {stats.invoices} visits · {fmtSGD(stats.revenue)} total
                        {selected.updated_at && ` · Updated ${new Date(selected.updated_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="actions">
                    {selected.phone && (
                      <a href={`https://wa.me/65${selected.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <button className="btn btn-wa" style={{ display:'flex', alignItems:'center', gap:5 }}><MessageCircle size={13} /> WhatsApp</button>
                      </a>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ display:'flex', alignItems:'center', gap:5, ...(activeVehicle ? {} : { opacity:0.4, cursor:'not-allowed' }) }}
                      onClick={() => activeVehicle && setModal('invoice')}
                      title={activeVehicle ? undefined : '请先选择车辆 Please select a vehicle first'}>
                      <Plus size={13} /> New Invoice
                    </button>
                    <button className="btn" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={() => setModal('editCustomer')}><Pencil size={13} /> Edit</button>
                    <button className="btn btn-danger" style={{ display:'flex', alignItems:'center', gap:4 }} onClick={async () => {
                      if (!confirm('Delete this customer and ALL their invoices?')) return
                      await deleteCustomer(selected.id)
                      setSelected(null); setInvoices([]); loadCustomers()
                    }}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="info-grid">
                  <div className="info-box">
                    <div className="info-label">Phone 电话</div>
                    <div className="info-val">{selected.phone || '—'}</div>
                  </div>
                  {selected.customer_type === 'company' && selected.contact_person && (
                    <div className="info-box">
                      <div className="info-label">Contact 联系人</div>
                      <div className="info-val">{selected.contact_person}</div>
                    </div>
                  )}
                  {selected.customer_type === 'company' && selected.uen && (
                    <div className="info-box">
                      <div className="info-label">UEN</div>
                      <div className="info-val" style={{ fontFamily:'monospace', fontSize:12 }}>{selected.uen}</div>
                    </div>
                  )}
                </div>
                <VehicleSection
                  customerId={selected.id}
                  vehicles={vehicles}
                  activeVehicle={activeVehicle}
                  onSelect={setActiveVehicle}
                  onRefresh={() => loadVehicles(selected.id)}
                />
                {/* Tags */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', paddingTop:4 }}>
                  {PRESET_TAGS.map(t => {
                    const has = (selected.tags || []).includes(t.key)
                    return (
                      <button key={t.key} onClick={async () => {
                        const curr = selected.tags || []
                        const next = has ? curr.filter(x => x !== t.key) : [...curr, t.key]
                        const { data } = await updateCustomerTags(selected.id, next)
                        if (data) { setSelected(data); loadCustomers() }
                      }} style={{
                        padding:'3px 10px', borderRadius:20,
                        border:`1.5px solid ${has ? t.color : 'var(--border)'}`,
                        background: has ? t.bg : 'transparent',
                        color: has ? t.color : 'var(--text3)',
                        fontSize:11, fontWeight:600, cursor:'pointer', transition:'.15s',
                      }}>
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                {selected.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', padding: '4px 0', marginTop:4 }}>
                    {selected.notes}
                  </div>
                )}
              </div>

              {/* Invoice List */}
              <div className="section-title">
                <span style={{ display:'flex', alignItems:'center', gap:5 }}><ClipboardList size={11} /> INVOICE HISTORY 发票记录</span>
                <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{filteredInvoices.length} records</span>
              </div>

              {filteredInvoices.map((inv, idx) => (
                <InvoiceCard key={inv.id} inv={inv} open={openInv === idx}
                  onToggle={() => setOpenInv(openInv === idx ? null : idx)}
                  onEdit={() => { setEditingInvoice(inv); setModal('invoice') }}
                  onDelete={async () => {
                    if (inv.status !== 'draft' || inv.voided_at) return
                    if (!confirm('Delete this draft invoice permanently? This cannot be undone.')) return
                    await deleteInvoice(inv.id)
                    loadInvoices(selected.id)
                  }}
                  onVoid={async () => {
                    if (inv.voided_at || inv.status === 'draft') return
                    const reason = prompt('Void reason is required. This action cannot be undone.\n\nWhy is this invoice being voided?')
                    if (!reason?.trim()) return alert('Void reason is required.')
                    if (!confirm(`Void invoice ${inv.invoice_no}? This cannot be undone.`)) return
                    await voidInvoice(inv.id, reason.trim())
                    loadInvoices(selected.id)
                  }}
                  onStatusChange={async (status) => {
                    if (inv.voided_at) return
                    await updateInvoiceStatus(inv.id, status)
                    loadInvoices(selected.id)
                  }}
                  customer={selected}
                />
              ))}

              {/* Activity Timeline */}
              <ActivityTimeline customerId={selected.id} session={session} />

              {/* Notes & Tasks */}
              <NotesAndTasks customerId={selected.id} />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'customer' && (
        <CustomerModal onClose={() => setModal(null)}
          onSave={async (data) => {
            const { data: cust } = await upsertCustomer(data)
            if (cust?.id && data.car_plate) {
              const { data: existing } = await getVehicles(cust.id)
              if (!existing?.length) {
                await addVehicle({ customer_id: cust.id, car_plate: data.car_plate.trim().toUpperCase(), car_make: data.car_make || null, car_model: data.car_model || null, car_year: data.car_year || null, is_primary: true })
              }
            }
            loadCustomers()
            setModal(null)
          }} />
      )}

      {modal === 'editCustomer' && selected && (
        <CustomerModal customer={selected} onClose={() => setModal(null)}
          onSave={async (data) => {
            const { data: updated } = await upsertCustomer({ ...data, id: selected.id })
            // Keep selected loaded even if upsert returns null (e.g. no-op)
            setSelected(prev => updated ?? { ...prev, ...data, car_plate: data.car_plate?.trim().toUpperCase() })
            loadCustomers()
            setModal(null)
          }} />
      )}

      {modal === 'invoice' && (
        <InvoiceModal
          customer={selected}
          vehicle={activeVehicle}
          invoice={editingInvoice}
          catalog={catalog}
          onClose={() => { setModal(null); setEditingInvoice(null) }}
          onSave={async (inv, items) => {
            if (editingInvoice) {
              await updateInvoice(editingInvoice.id, inv, items)
            } else {
              await createInvoice({ ...inv, customer_id: selected.id, vehicle_id: activeVehicle?.id ?? null }, items)
            }
            loadInvoices(selected.id)
            setModal(null); setEditingInvoice(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Invoice Card ───────────────────────────────────────────────────────
function InvoiceCard({ inv, open, onToggle, onEdit, onDelete, onVoid, onStatusChange, customer }) {
  const items = inv.invoice_items || []
  const isPaid = inv.status === 'paid' || inv.work_status === 'paid'
  const isVoided = !!inv.voided_at
  const canDelete = inv.status === 'draft' && !isVoided
  const canVoid = ['confirmed', 'paid'].includes(inv.status) && !isVoided
  const canEdit = inv.status !== 'paid' && !isPaid && !isVoided
  return (
    <div className="invoice-card" style={isVoided ? { opacity: 0.72, filter: 'grayscale(0.15)' } : undefined}>
      <div className="invoice-header" onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap:'wrap' }}>
            <div className="inv-no">{inv.invoice_no}</div>
            <span className={`tag ${statusColors[inv.status]}`}>{statusLabels[inv.status]}</span>
            {isVoided && <span className="tag tag-voided">VOIDED 已作废</span>}
          </div>
          <div className="inv-date" style={{ display:'flex', alignItems:'center', gap:4 }}>
            {inv.date}{inv.technician && <><span style={{ color:'var(--border)' }}>·</span><Wrench size={10} style={{ color:'var(--text3)' }} />{inv.technician}</>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="inv-total">{fmt(inv.total)}</div>
          <div className={`inv-chevron ${open ? 'open' : ''}`}>▼</div>
        </div>
      </div>

      {open && (
        <div className="invoice-items open">
          {items.length === 0
            ? <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>No items</div>
            : items.sort((a, b) => a.sort_order - b.sort_order).map(it => (
              <div key={it.id} className="inv-item-row">
                <div className="inv-item-desc">{it.description}</div>
                <div className="inv-item-cat">{it.category}</div>
                <div className={`inv-item-amount ${parseFloat(it.amount) < 0 ? 'neg' : 'pos'}`}>
                  {parseFloat(it.amount) < 0 ? '−' : '+'}${Math.abs(parseFloat(it.amount)).toFixed(2)}
                </div>
              </div>
            ))}

          {inv.discount > 0 && (
            <div className="inv-item-row">
              <div className="inv-item-desc" style={{ color: 'var(--red)' }}>Discount / 折扣</div>
              <div className="inv-item-cat" />
              <div className="inv-item-amount neg">−${parseFloat(inv.discount).toFixed(2)}</div>
            </div>
          )}

          <div className="inv-total-row">
            <span>{isVoided ? 'VOIDED TOTAL / 已作废金额' : 'TOTAL / 总计'}</span>
            <span style={isVoided ? { color:'var(--text3)', textDecoration:'line-through' } : undefined}>{fmt(inv.total)}</span>
          </div>

          {isVoided && (
            <div style={{ padding:'10px 14px', background:'#F3F4F6', color:'var(--text2)', fontSize:12, borderTop:'1px solid var(--border2)' }}>
              <div style={{ fontWeight:700, color:'#6B7280', marginBottom:3 }}>Voided 作废</div>
              <div>{inv.void_reason || 'No reason provided'}</div>
              {inv.voided_at && (
                <div style={{ color:'var(--text3)', marginTop:3 }}>
                  {new Date(inv.voided_at).toLocaleString('en-SG')}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', background: 'var(--bg2)', flexWrap: 'wrap' }}>
            {canEdit ? (
              <button className="btn" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }} onClick={onEdit}><Pencil size={11} /> Edit</button>
            ) : (
              <span style={{ fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:4, padding:'5px 8px' }}>
                {isVoided ? 'Voided invoice locked' : 'Paid invoice locked'}
              </span>
            )}
            <button className="btn btn-green" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }}
              onClick={() => downloadInvoice(inv, customer, inv.invoice_items || [], inv.invoice_type)}>
              <Download size={11} /> PDF
            </button>
            <button className="btn btn-primary" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }}
              onClick={() => printInvoice(inv, customer, inv.invoice_items || [], inv.invoice_type)}>
              <Printer size={11} /> Print
            </button>
            {inv.status === 'draft' && !isVoided && (
              <button className="btn btn-blue" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }}
                onClick={() => onStatusChange('confirmed')}><CheckCircle2 size={11} /> Confirm</button>
            )}
            {inv.status === 'confirmed' && !isVoided && (
              <button className="btn btn-green" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }}
                onClick={() => onStatusChange('paid')}><DollarSign size={11} /> Mark Paid</button>
            )}
            {canVoid && (
              <button className="btn btn-danger" style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }} onClick={onVoid}>
                Void
              </button>
            )}
            {canDelete && (
              <button className="btn btn-danger" style={{ fontSize:11, marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }} onClick={onDelete}><Trash2 size={11} /></button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Customer Modal ─────────────────────────────────────────────────────
function CustomerModal({ customer, onClose, onSave }) {
  const [custType, setCustType] = useState(customer?.customer_type || 'individual')
  const [form, setForm] = useState({
    name:           customer?.name           || '',
    phone:          customer?.phone          || '',
    car_plate:      customer?.car_plate      || null,
    notes:          customer?.notes          || '',
    tags:           customer?.tags           || [],
    contact_person: customer?.contact_person || '',
    uen:            customer?.uen            || '',
  })
  const toggleTag = (key) => setForm(f => ({
    ...f, tags: f.tags.includes(key) ? f.tags.filter(t => t !== key) : [...f.tags, key],
  }))
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) { alert('Name is required. 请输入名称。'); return }
    setSaving(true)
    await onSave({
      ...form,
      name: form.name.trim(),
      customer_type: custType,
      contact_person: custType === 'company' ? (form.contact_person.trim() || null) : null,
      uen:            custType === 'company' ? (form.uen.trim() || null) : null,
    })
    setSaving(false)
  }

  const isCompany = custType === 'company'

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3 style={{ display:'flex', alignItems:'center', gap:7 }}>
            {customer ? <><Pencil size={14} /> Edit Customer 编辑客户</> : <><Users size={14} /> Add Customer 新增客户</>}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          {/* Type toggle — segmented control */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: 'inline-flex', padding: 3, borderRadius: 9999,
              background: '#f6f9fc', border: '1px solid #e3e8ee',
            }}>
              {[['individual', 'Individual 个人'], ['company', 'Company 公司']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setCustType(val)} style={{
                  padding: '5px 18px', borderRadius: 9999, border: 'none',
                  background: custType === val ? 'var(--orange)' : 'transparent',
                  color: custType === val ? '#fff' : '#64748d',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: '.15s',
                  whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Individual fields */}
          {!isCompany && (
            <div className="form-grid">
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Name 姓名 *</label>
                <input value={form.name} onChange={set('name')} placeholder="e.g. Tan Wei Ming" />
              </div>
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Phone 电话</label>
                <input value={form.phone} onChange={set('phone')} placeholder="e.g. 91234567" />
              </div>
            </div>
          )}

          {/* Company fields */}
          {isCompany && (
            <div className="form-grid">
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Company Name 公司名 *</label>
                <input value={form.name} onChange={set('name')} placeholder="e.g. ABC Auto Pte Ltd" />
              </div>
              <div className="form-row">
                <label>UEN <span style={{ fontWeight:400, color:'var(--text3)', fontSize:11 }}>统一企业号</span></label>
                <input value={form.uen} onChange={set('uen')} placeholder="e.g. 202012345K"
                  style={{ fontFamily:'monospace' }} />
              </div>
              <div className="form-row">
                <label>Phone 电话</label>
                <input value={form.phone} onChange={set('phone')} placeholder="e.g. 62345678" />
              </div>
              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Contact Person 联系人</label>
                <input value={form.contact_person} onChange={set('contact_person')} placeholder="e.g. David Lim" />
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="form-row" style={{ marginTop: 4 }}>
            <label>Tags 标签</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {PRESET_TAGS.map(t => {
                const has = form.tags.includes(t.key)
                return (
                  <button key={t.key} type="button" onClick={() => toggleTag(t.key)} style={{
                    padding:'4px 11px', borderRadius:20,
                    border:`1.5px solid ${has ? t.color : 'var(--border)'}`,
                    background: has ? t.bg : 'transparent',
                    color: has ? t.color : 'var(--text3)',
                    fontSize:11, fontWeight:600, cursor:'pointer', transition:'.15s',
                  }}>{t.label}</button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="form-row">
            <label>Notes 备注</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Any notes..." />
          </div>

          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel 取消</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save 保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vehicle Section ────────────────────────────────────────────────────
function VehicleSection({ customerId, vehicles, activeVehicle, onSelect, onRefresh }) {
  const [modal, setModal]               = useState(null)
  const [settingPrimary, setSettingPrimary] = useState(null)

  const handleDelete = async (v) => {
    if (vehicles.length <= 1) { alert('Cannot delete the only vehicle. 不能删除唯一车辆。'); return }
    if (!confirm(`Delete ${v.car_plate}? 确认删除？`)) return
    await deleteVehicle(v.id)
    onRefresh()
  }

  const handleSave = async (formData) => {
    const { is_primary, ...rest } = formData
    if (modal.mode === 'add') {
      const { data: newV } = await addVehicle({ ...rest, customer_id: customerId, is_primary: false })
      if (is_primary && newV) await setPrimaryVehicle(newV.id, customerId)
    } else {
      await updateVehicle(modal.vehicle.id, rest)
      if (is_primary) await setPrimaryVehicle(modal.vehicle.id, customerId)
    }
    setModal(null)
    onRefresh()
  }

  const handleSetPrimary = async (v) => {
    setSettingPrimary(v.id)
    await setPrimaryVehicle(v.id, customerId)
    setSettingPrimary(null)
    onRefresh()
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="section-title" style={{ marginBottom: 10 }}>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><Car size={11} /> VEHICLES 车辆</span>
        <button className="btn" style={{ fontSize:11, padding:'3px 8px', display:'flex', alignItems:'center', gap:3 }}
          onClick={() => setModal({ mode:'add', vehicle:null })}>
          <Plus size={10} /> Add 添加
        </button>
      </div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        {vehicles.map(v => {
          const isActive = activeVehicle?.id === v.id
          return (
            <div key={v.id} onClick={() => onSelect(v)} style={{
              position: 'relative',
              border: isActive ? '2px solid var(--orange)' : '1px solid #e3e8ee',
              borderRadius: 12,
              padding: '10px 12px 10px',
              cursor: 'pointer',
              background: isActive ? '#fff8f5' : '#fff',
              minWidth: 150, maxWidth: 190,
              boxShadow: isActive
                ? 'rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px'
                : 'rgba(0,55,112,0.06) 0 1px 3px',
              transition: 'border-color .15s, box-shadow .15s',
            }}>
              {/* Badge row — reserves space so plate is never covered */}
              <div style={{ display:'flex', justifyContent:'flex-end', minHeight:18, marginBottom:3 }}>
                {v.is_primary && (
                  <span style={{
                    background:'#fff0e6', color:'var(--orange)',
                    fontSize:9, fontWeight:700, letterSpacing:'.5px',
                    textTransform:'uppercase', padding:'2px 7px',
                    borderRadius:9999, lineHeight:1.6,
                  }}>PRIMARY</span>
                )}
              </div>
              {/* Plate — main visual anchor */}
              <div style={{
                fontFamily:'monospace', fontWeight:600, fontSize:19,
                color:'#0d253d', letterSpacing:'-0.3px',
                fontFeatureSettings:'"tnum"', marginBottom:4, lineHeight:1,
              }}>{v.car_plate}</div>
              {/* Make · Model · Year */}
              <div style={{ fontSize:12, color:'#64748d', lineHeight:1.4 }}>
                {[v.car_make, v.car_model].filter(Boolean).join(' ') || <span style={{ color:'#b0bec9' }}>—</span>}
                {v.car_year && <span style={{ marginLeft:5, color:'#a0aec0', fontSize:11 }}>{v.car_year}</span>}
              </div>
              {/* Actions */}
              <div style={{ display:'flex', gap:4, marginTop:10, alignItems:'center' }}>
                {!v.is_primary && (
                  <button
                    onClick={e => { e.stopPropagation(); handleSetPrimary(v) }}
                    disabled={!!settingPrimary}
                    style={{
                      flex:1, fontSize:10, fontWeight:600, padding:'4px 0',
                      borderRadius:9999, border:'1px solid #e3e8ee',
                      background:'transparent', color:'#64748d',
                      cursor: settingPrimary ? 'wait' : 'pointer',
                      opacity: settingPrimary === v.id ? 0.5 : 1,
                      transition:'.15s',
                    }}>
                    {settingPrimary === v.id ? '...' : '设为主车辆'}
                  </button>
                )}
                <button className="btn" style={{ padding:'3px 7px', fontSize:10 }}
                  onClick={e => { e.stopPropagation(); setModal({ mode:'edit', vehicle:v }) }}>
                  <Pencil size={9} />
                </button>
                <button className="btn" style={{ padding:'3px 7px', fontSize:10, color:'#c0392b' }}
                  onClick={e => { e.stopPropagation(); handleDelete(v) }}>
                  <Trash2 size={9} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {modal && (
        <VehicleModal
          vehicle={modal.vehicle}
          mode={modal.mode}
          isOnly={vehicles.length === 0}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ─── ComboBox ────────────────────────────────────────────────────────────
// Top-level to avoid re-mounting on every VehicleModal render (rerender-no-inline-components)
function ComboBox({ value, onChange, suggestions, placeholder, transform }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Derive filtered list during render — no extra useEffect needed (rerender-derived-state-no-effect)
  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions

  const commit = (raw) => {
    onChange(transform ? transform(raw) : raw.trim())
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (value.trim()) onChange(transform ? transform(value) : value.trim()) }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
          margin: 0, padding: '4px 0', listStyle: 'none',
          boxShadow: 'rgba(0,55,112,0.08) 0 8px 24px, rgba(0,55,112,0.04) 0 2px 6px',
          maxHeight: 224, overflowY: 'auto',
        }}>
          {filtered.slice(0, 8).map(s => (
            <li key={s}
              onMouseDown={e => { e.preventDefault(); commit(s) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#0d253d', lineHeight: 1.4 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f6f9fc' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Years list computed once at module load
const VEHICLE_YEARS = (() => {
  const cur = new Date().getFullYear()
  return Array.from({ length: cur - 1990 + 1 }, (_, i) => cur - i)
})()

// ─── Vehicle Modal ──────────────────────────────────────────────────────
function VehicleModal({ vehicle, mode, isOnly, onClose, onSave }) {
  const [form, setForm] = useState({
    car_plate:  vehicle?.car_plate  || '',
    car_make:   vehicle?.car_make   || '',
    car_model:  vehicle?.car_model  || '',
    car_year:   vehicle?.car_year   || '',
    notes:      vehicle?.notes      || '',
    is_primary: vehicle?.is_primary ?? (mode === 'add' ? isOnly : false),
  })
  const [makes, setMakes]   = useState([])
  const [models, setModels] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Fetch all makes once on mount
  useEffect(() => {
    getVehicleMakes().then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.car_make).filter(Boolean))].sort()
      setMakes(unique)
    })
  }, [])

  // Fetch models whenever car_make settles (300ms debounce)
  useEffect(() => {
    const make = form.car_make.trim()
    if (!make) { setModels([]); return }
    const t = setTimeout(() => {
      getVehicleModels(make).then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.car_model).filter(Boolean))].sort()
        setModels(unique)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [form.car_make])

  const save = async () => {
    if (!form.car_plate.trim()) { alert('Car plate is required. 请输入车牌。'); return }
    setSaving(true)
    await onSave({ ...form, car_plate: form.car_plate.trim().toUpperCase() })
    setSaving(false)
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h3 style={{ display:'flex', alignItems:'center', gap:7 }}>
            <Car size={14} /> {mode === 'add' ? 'Add Vehicle 添加车辆' : 'Edit Vehicle 编辑车辆'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Car Plate 车牌 *</label>
            <input value={form.car_plate} onChange={set('car_plate')}
              placeholder="e.g. SKA1234A"
              style={{ textTransform:'uppercase', fontFamily:'monospace', fontWeight:700 }} />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Make 品牌</label>
              <ComboBox
                value={form.car_make}
                onChange={v => setForm(f => ({ ...f, car_make: v }))}
                suggestions={makes}
                placeholder="e.g. Toyota"
                transform={v => v.trim().replace(/\b\w/g, c => c.toUpperCase())}
              />
            </div>
            <div className="form-row">
              <label>Model 型号</label>
              <ComboBox
                value={form.car_model}
                onChange={v => setForm(f => ({ ...f, car_model: v }))}
                suggestions={models}
                placeholder="e.g. Wish"
                transform={v => v.trim().toUpperCase()}
              />
            </div>
            <div className="form-row">
              <label>Year 年份</label>
              <select value={form.car_year} onChange={set('car_year')}>
                <option value="">— select —</option>
                {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Notes 备注</label>
            <input value={form.notes} onChange={set('notes')} placeholder="optional" />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0' }}>
            <input type="checkbox" id="isPrimary" checked={form.is_primary}
              onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
            <label htmlFor="isPrimary" style={{ fontSize:13, cursor:'pointer' }}>Set as primary vehicle 设为主车辆</label>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel 取消</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save 保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Timeline ──────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { key: 'repair',      Icon: Wrench,       label: 'Repair 维修记录',  color: 'var(--orange)' },
  { key: 'whatsapp',    Icon: MessageCircle, label: 'WhatsApp 联系',    color: '#25D366' },
  { key: 'note',        Icon: FileText,     label: 'Note 备注',         color: 'var(--blue)' },
  { key: 'appointment', Icon: Calendar,     label: 'Appointment 预约', color: 'var(--green)' },
]

function ActivityTimeline({ customerId, session }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(true)
  const [addOpen, setAddOpen]       = useState(false)
  const [type, setType]             = useState('note')
  const [content, setContent]       = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => { load() }, [customerId])

  const load = async () => {
    setLoading(true)
    const { data } = await getActivities(customerId)
    setActivities(data || [])
    setLoading(false)
  }

  const save = async () => {
    if (!content.trim()) return
    setSaving(true)
    await addActivity({ customer_id: customerId, type, content: content.trim(), created_by: session?.user?.email || 'Staff' })
    setContent(''); setAddOpen(false); setSaving(false)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this activity?')) return
    await deleteActivity(id)
    load()
  }

  const typeInfo = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.key, t]))
  const fmtDate = (iso) => new Date(iso).toLocaleString('en-SG', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

  return (
    <div>
      <div className="section-title">
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><Clock size={11} /> ACTIVITY TIMELINE 活动记录</span>
        <button className="btn" style={{ fontSize:11, padding:'3px 10px' }}
          onClick={() => setAddOpen(!addOpen)}>
          + Add 添加
        </button>
      </div>

      {addOpen && (
        <div className="card" style={{ marginBottom:10, padding:'12px 14px' }}>
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            {ACTIVITY_TYPES.map(t => (
              <button key={t.key} onClick={() => setType(t.key)} style={{
                padding:'4px 11px', borderRadius:20, border:`1.5px solid ${type===t.key ? t.color : 'var(--border)'}`,
                background: type===t.key ? `${t.color}18` : 'transparent',
                color: type===t.key ? t.color : 'var(--text3)',
                fontSize:11, fontWeight:600, cursor:'pointer',
              }}>
                <t.Icon size={11} /> {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Describe what happened... 描述发生了什么"
            style={{ width:'100%', height:64, padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--orange)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ display:'flex', gap:6, marginTop:8, justifyContent:'flex-end' }}>
            <button className="btn" style={{ fontSize:11 }} onClick={() => { setAddOpen(false); setContent('') }}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize:11 }} onClick={save} disabled={saving || !content.trim()}>
              {saving ? 'Saving...' : '✓ Save 保存'}
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="spinner" style={{ margin:'16px auto' }} /> : activities.length === 0 ? (
        <div style={{ textAlign:'center', padding:'20px', color:'var(--text3)', fontSize:12, background:'var(--card)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
          No activities yet. Add the first one above. 暂无记录
        </div>
      ) : (
        <div className="timeline">
          {activities.map(act => {
            const t = typeInfo[act.type] || typeInfo.note
            return (
              <div key={act.id} className={`timeline-item ${act.type}`}>
                <div className="timeline-dot"><t.Icon size={8} /></div>
                <div className="timeline-content">
                  <div style={{ fontSize:13, lineHeight:1.5 }}>{act.content}</div>
                  <div className="timeline-meta" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}><t.Icon size={10} /> {t.label} · {fmtDate(act.created_at)}</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {act.created_by && <span style={{ fontSize:10, color:'var(--text3)' }}>by {act.created_by}</span>}
                      <button onClick={() => remove(act.id)} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>×</button>
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

// ─── Notes & Tasks ──────────────────────────────────────────────────────────
function NotesAndTasks({ customerId }) {
  const [notes, setNotes]   = useState([])
  const [tasks, setTasks]   = useState([])
  const [tab, setTab]       = useState('tasks') // tasks | notes
  const [newNote, setNewNote] = useState('')
  const [newTask, setNewTask] = useState({ title: '', due_date: '' })
  const [editNoteId, setEditNoteId] = useState(null)
  const [editNoteVal, setEditNoteVal] = useState('')

  useEffect(() => { loadAll() }, [customerId])

  const loadAll = async () => {
    const [n, t] = await Promise.all([getNotes(customerId), getTasks(customerId)])
    setNotes(n.data || [])
    setTasks(t.data || [])
  }

  // ── Notes ──
  const saveNote = async () => {
    if (!newNote.trim()) return
    await addNote({ customer_id: customerId, content: newNote.trim() })
    setNewNote(''); loadAll()
  }

  const saveEditNote = async (id) => {
    if (!editNoteVal.trim()) return
    await updateNote(id, editNoteVal.trim())
    setEditNoteId(null); loadAll()
  }

  const removeNote = async (id) => {
    if (!confirm('Delete note?')) return
    await deleteNote(id); loadAll()
  }

  // ── Tasks ──
  const saveTask = async () => {
    if (!newTask.title.trim()) return
    await addTask({ customer_id: customerId, title: newTask.title.trim(), due_date: newTask.due_date || null, completed: false })
    setNewTask({ title: '', due_date: '' }); loadAll()
  }

  const toggleTask = async (task) => {
    await updateTask(task.id, { completed: !task.completed }); loadAll()
  }

  const removeTask = async (id) => {
    await deleteTask(id); loadAll()
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-SG') : null
  const isOverdue = (task) => !task.completed && task.due_date && new Date(task.due_date) < new Date()

  const pendingTasks = tasks.filter(t => !t.completed)
  const doneTasks    = tasks.filter(t => t.completed)

  return (
    <div style={{ marginTop: 4 }}>
      <div className="section-title">
        <span>📌 NOTES & TASKS 备注 & 任务</span>
        <div style={{ display:'flex', gap:4 }}>
          {[{ key:'tasks', label:`Tasks ${tasks.length>0?`(${pendingTasks.length})`:''}`}, { key:'notes', label:`Notes ${notes.length>0?`(${notes.length})`:''}`}].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
              border: '1px solid var(--border)',
              background: tab===t.key ? 'var(--orange)' : 'transparent',
              color: tab===t.key ? '#fff' : 'var(--text3)',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── TASKS ── */}
      {tab === 'tasks' && (
        <div>
          {/* New task input */}
          <div className="card" style={{ padding:'10px 12px', marginBottom:8 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input
                value={newTask.title}
                onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveTask()}
                placeholder="New task... 新任务"
                style={{ flex:1, minWidth:120, padding:'7px 10px', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'inherit', outline:'none' }}
                onFocus={e => e.target.style.borderColor = 'var(--orange)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <input type="date"
                value={newTask.due_date}
                onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                style={{ padding:'7px 10px', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'inherit', outline:'none', color:'var(--text)' }}
              />
              <button className="btn btn-primary" style={{ fontSize:11 }} onClick={saveTask}>+ Add</button>
            </div>
          </div>

          {/* Pending tasks */}
          {pendingTasks.length === 0 && doneTasks.length === 0 && (
            <div style={{ textAlign:'center', padding:16, color:'var(--text3)', fontSize:12, background:'var(--card)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>No tasks yet. 暂无任务</div>
          )}

          {pendingTasks.map(task => (
            <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={removeTask} overdue={isOverdue(task)} fmtDate={fmtDate} />
          ))}

          {doneTasks.length > 0 && (
            <>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', margin:'10px 0 6px' }}>Completed 已完成</div>
              {doneTasks.map(task => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={removeTask} overdue={false} fmtDate={fmtDate} done />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── NOTES ── */}
      {tab === 'notes' && (
        <div>
          <div className="card" style={{ padding:'10px 12px', marginBottom:8 }}>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note... 添加备注"
              style={{ width:'100%', height:60, padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--orange)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
              <button className="btn btn-primary" style={{ fontSize:11 }} onClick={saveNote} disabled={!newNote.trim()}>+ Save Note</button>
            </div>
          </div>

          {notes.length === 0 && (
            <div style={{ textAlign:'center', padding:16, color:'var(--text3)', fontSize:12, background:'var(--card)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>No notes yet. 暂无备注</div>
          )}

          {notes.map(note => (
            <div key={note.id} className="card" style={{ padding:'10px 14px', marginBottom:8 }}>
              {editNoteId === note.id ? (
                <div>
                  <textarea
                    value={editNoteVal}
                    onChange={e => setEditNoteVal(e.target.value)}
                    style={{ width:'100%', height:64, padding:'7px 10px', border:'1.5px solid var(--orange)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none' }}
                    autoFocus
                  />
                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end', marginTop:6 }}>
                    <button className="btn" style={{ fontSize:11 }} onClick={() => setEditNoteId(null)}>Cancel</button>
                    <button className="btn btn-primary" style={{ fontSize:11 }} onClick={() => saveEditNote(note.id)}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, lineHeight:1.6, color:'var(--text)' }}>{note.content}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, display:'flex', alignItems:'center', gap:3 }}>
                      <Clock size={10} />{new Date(note.created_at).toLocaleString('en-SG', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={() => { setEditNoteId(note.id); setEditNoteVal(note.content) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:'2px 4px', display:'flex', alignItems:'center' }}><Pencil size={12} /></button>
                    <button onClick={() => removeNote(note.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:'2px 4px', display:'flex', alignItems:'center' }}><Trash2 size={12} /></button>
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

function TaskRow({ task, onToggle, onDelete, overdue, fmtDate, done }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
      background:'var(--card)', border:`1px solid ${overdue ? 'var(--red-light)' : 'var(--border)'}`,
      borderRadius:'var(--radius)', marginBottom:6,
      opacity: done ? .6 : 1,
    }}>
      <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)}
        style={{ width:16, height:16, accentColor:'var(--orange)', cursor:'pointer', flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text3)' : 'var(--text)' }}>
          {task.title}
        </div>
        {task.due_date && (
          <div style={{ fontSize:11, marginTop:2, color: overdue ? 'var(--red)' : 'var(--text3)', fontWeight: overdue ? 700 : 400 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{overdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}{overdue ? ' Overdue:' : ''} {fmtDate(task.due_date)}</span>
          </div>
        )}
      </div>
      <button onClick={() => onDelete(task.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14, padding:'0 2px', flexShrink:0 }}>×</button>
    </div>
  )
}
