import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getCustomers, getTotalCustomers, searchCustomers, getInvoices, deleteCustomer,
  upsertCustomer, updateCustomerTags, createInvoice, updateInvoice, updateInvoiceStatus,
  deleteInvoice, generateInvoiceNo, getCatalog,
  getActivities, addActivity, deleteActivity,
  getNotes, addNote, updateNote, deleteNote,
  getTasks, addTask, updateTask, deleteTask,
} from '../lib/supabase'
import { printInvoice, downloadInvoice } from '../lib/pdf'

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`
const fmtSGD = (n) => `SGD $${parseFloat(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`

const statusColors = { draft: 'tag-draft', confirmed: 'tag-confirmed', paid: 'tag-paid' }
const statusLabels = { draft: 'Draft 草稿', confirmed: 'Confirmed 已确认', paid: 'Paid 已付款' }

const PRESET_TAGS = [
  { key: 'vip',      label: 'VIP',       emoji: '🌟', bg: '#FEF3C7', color: '#D97706' },
  { key: 'regular',  label: 'Regular 常客', emoji: '🔄', bg: '#DBEAFE', color: '#2563EB' },
  { key: 'new',      label: 'New 新客户',  emoji: '🆕', bg: '#DCFCE7', color: '#16A34A' },
  { key: 'problem',  label: 'Problem ⚠️', emoji: '⚠️', bg: '#FEE2E2', color: '#DC2626' },
  { key: 'sold_car', label: 'Sold Car 已卖车', emoji: '🚗', bg: '#F3F4F6', color: '#6B7280' },
]

const tagMeta = Object.fromEntries(PRESET_TAGS.map(t => [t.key, t]))

export default function CRM({ session }) {
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
    await loadInvoices(c.id)
  }

  const stats = {
    customers: customers.length,
    invoices: invoices.length,
    revenue: invoices.reduce((a, i) => a + (parseFloat(i.total) || 0), 0),
    unpaid: invoices.filter(i => i.status !== 'paid').length,
  }

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
              placeholder="🔍  Name, plate, model..." />
          </div>
          <div className="sidebar-actions">
            <button className="btn-add" onClick={() => setModal('customer')}>
              ＋ Add Customer 新增客户
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
                .map(c => (
                  <div key={c.id} className={`cust-item ${selected?.id === c.id ? 'active' : ''}`}
                    onClick={() => selectCustomer(c)}>
                    <div className="cust-name">{c.name}</div>
                    <div className="cust-plate">{c.car_plate}</div>
                    <div className="cust-sub">{c.car_make} {c.car_model}</div>
                    {(c.tags || []).length > 0 && (
                      <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:3 }}>
                        {(c.tags || []).map(tag => {
                          const m = tagMeta[tag]; if (!m) return null
                          return <span key={tag} style={{ fontSize:9, padding:'1px 5px', borderRadius:20, background:m.bg, color:m.color, fontWeight:700 }}>{m.emoji} {m.label}</span>
                        })}
                      </div>
                    )}
                  </div>
                ))}
            {customers.length > 300 && (
              <div className="sidebar-count">Showing 300 of {customers.length} — search to narrow</div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className={`detail-panel ${mobileView === 'detail' ? 'active' : ''}`}>
          {!selected ? (
            <div className="detail-empty">
              <div className="icon">🚗</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select a customer</div>
              <div>Search by name, plate number, or model</div>
            </div>
          ) : (
            <>
              <button className="mobile-back" onClick={() => { setMobileView('list'); setSelected(null) }}>
                ← Back to list
              </button>

              {/* Customer Header */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="customer-name">{selected.name}</div>
                    <div className="customer-meta">
                      {invoices.length} visits · {fmtSGD(stats.revenue)} total
                      {selected.updated_at && ` · Updated ${new Date(selected.updated_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="actions">
                    {selected.phone && (
                      <a href={`https://wa.me/65${selected.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer">
                        <button className="btn btn-wa">📱 WhatsApp</button>
                      </a>
                    )}
                    <button className="btn btn-primary" onClick={() => setModal('invoice')}>
                      ＋ New Invoice 开单
                    </button>
                    <button className="btn" onClick={() => setModal('editCustomer')}>✏️ Edit</button>
                    <button className="btn btn-danger" onClick={async () => {
                      if (!confirm('Delete this customer and ALL their invoices?')) return
                      await deleteCustomer(selected.id)
                      setSelected(null); setInvoices([]); loadCustomers()
                    }}>🗑</button>
                  </div>
                </div>
                <div className="info-grid">
                  <div className="info-box">
                    <div className="info-label">Car Plate 车牌</div>
                    <div className="info-val plate">{selected.car_plate}</div>
                  </div>
                  <div className="info-box">
                    <div className="info-label">Make 品牌</div>
                    <div className="info-val">{selected.car_make || '—'}</div>
                  </div>
                  <div className="info-box">
                    <div className="info-label">Model 型号</div>
                    <div className="info-val">{selected.car_model || '—'}</div>
                  </div>
                  <div className="info-box">
                    <div className="info-label">Phone 电话</div>
                    <div className="info-val">{selected.phone || '—'}</div>
                  </div>
                </div>
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
                        {t.emoji} {t.label}
                      </button>
                    )
                  })}
                </div>

                {selected.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', padding: '4px 0', marginTop:4 }}>
                    📝 {selected.notes}
                  </div>
                )}
              </div>

              {/* Invoice List */}
              <div className="section-title">
                <span>📋 INVOICE HISTORY 发票记录</span>
                <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{invoices.length} records</span>
              </div>

              {invoices.map((inv, idx) => (
                <InvoiceCard key={inv.id} inv={inv} open={openInv === idx}
                  onToggle={() => setOpenInv(openInv === idx ? null : idx)}
                  onEdit={() => { setEditingInvoice(inv); setModal('invoice') }}
                  onDelete={async () => {
                    if (!confirm('Delete this invoice?')) return
                    await deleteInvoice(inv.id)
                    loadInvoices(selected.id)
                  }}
                  onStatusChange={async (status) => {
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
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'customer' && (
        <CustomerModal onClose={() => setModal(null)}
          onSave={async (data) => {
            await upsertCustomer(data)
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
          invoice={editingInvoice}
          catalog={catalog}
          onClose={() => { setModal(null); setEditingInvoice(null) }}
          onSave={async (inv, items) => {
            if (editingInvoice) {
              await updateInvoice(editingInvoice.id, inv, items)
            } else {
              await createInvoice({ ...inv, customer_id: selected.id }, items)
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
function InvoiceCard({ inv, open, onToggle, onEdit, onDelete, onStatusChange, customer }) {
  const items = inv.invoice_items || []
  return (
    <div className="invoice-card">
      <div className="invoice-header" onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="inv-no">{inv.invoice_no}</div>
            <span className={`tag ${statusColors[inv.status]}`}>{statusLabels[inv.status]}</span>
          </div>
          <div className="inv-date">{inv.date} {inv.technician && `· 🔧 ${inv.technician}`}</div>
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
            <span>TOTAL / 总计</span>
            <span>{fmt(inv.total)}</span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 14px', background: 'var(--bg2)', flexWrap: 'wrap' }}>
            <button className="btn" style={{ fontSize: 11 }} onClick={onEdit}>✏️ Edit 编辑</button>
            <button className="btn btn-green" style={{ fontSize: 11 }}
              onClick={() => downloadInvoice(inv, customer, inv.invoice_items || [], inv.invoice_type)}>
              ⬇️ PDF
            </button>
            <button className="btn btn-primary" style={{ fontSize: 11 }}
              onClick={() => printInvoice(inv, customer, inv.invoice_items || [], inv.invoice_type)}>
              🖨️ Print 打印
            </button>
            {inv.status === 'draft' && (
              <button className="btn btn-blue" style={{ fontSize: 11 }}
                onClick={() => onStatusChange('confirmed')}>✓ Confirm 确认</button>
            )}
            {inv.status === 'confirmed' && (
              <button className="btn btn-green" style={{ fontSize: 11 }}
                onClick={() => onStatusChange('paid')}>💰 Mark Paid 已付款</button>
            )}
            {inv.status === 'paid' && (
              <button className="btn" style={{ fontSize: 11 }}
                onClick={() => onStatusChange('confirmed')}>↩ Unpay</button>
            )}
            <button className="btn btn-danger" style={{ fontSize: 11, marginLeft: 'auto' }} onClick={onDelete}>🗑</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Customer Modal ─────────────────────────────────────────────────────
function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    car_plate: customer?.car_plate || '',
    car_make: customer?.car_make || '',
    car_model: customer?.car_model || '',
    car_year: customer?.car_year || '',
    notes: customer?.notes || '',
    tags: customer?.tags || [],
  })
  const toggleTag = (key) => setForm(f => ({
    ...f,
    tags: f.tags.includes(key) ? f.tags.filter(t => t !== key) : [...f.tags, key]
  }))
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim() || !form.car_plate.trim()) { alert('Name and plate required.'); return }
    setSaving(true)
    await onSave({ ...form, car_plate: form.car_plate.trim().toUpperCase() })
    setSaving(false)
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{customer ? '✏️ Edit Customer 编辑客户' : '👤 Add Customer 新增客户'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-row">
              <label>Name 姓名 *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. Tan Wei Ming" />
            </div>
            <div className="form-row">
              <label>Phone 电话</label>
              <input value={form.phone} onChange={set('phone')} placeholder="e.g. 91234567" />
            </div>
          </div>
          <div className="form-row">
            <label>Car Plate 车牌 *</label>
            <input value={form.car_plate} onChange={set('car_plate')}
              placeholder="e.g. SKA1234A" style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }} />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Make 品牌</label>
              <input value={form.car_make} onChange={set('car_make')} placeholder="e.g. Toyota" />
            </div>
            <div className="form-row">
              <label>Model 型号</label>
              <input value={form.car_model} onChange={set('car_model')} placeholder="e.g. Wish" />
            </div>
          </div>
          <div className="form-row">
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
                  }}>
                    {t.emoji} {t.label}
                  </button>
                )
              })}
            </div>
          </div>
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

// ─── Invoice Modal ──────────────────────────────────────────────────────
function InvoiceModal({ customer, invoice, catalog, onClose, onSave }) {
  const ADVISORS = ['', 'JON', 'JIMMY', 'MENG', 'IVY', 'NORMAN', 'XIN', 'ZHU', 'TAO', 'XIONG']
  const MECHANICS = ['', 'NORMAN', 'XIN', 'ZHU', 'TAO', 'XIONG', 'MENG']

  const [date, setDate] = useState(invoice?.date || new Date().toISOString().split('T')[0])
  const [advisor, setAdvisor] = useState(invoice?.advisor || '')
  const [mechanic, setMechanic] = useState(invoice?.mechanic || '')
  const [mileage, setMileage] = useState(invoice?.mileage || '')
  const [chassisNo, setChassisNo] = useState(invoice?.chassis_no || '')
  const [notes, setNotes] = useState(invoice?.notes || '')
  const [discount, setDiscount] = useState(invoice?.discount || 0)
  const [status, setStatus] = useState(invoice?.status || 'draft')
  const [invNo, setInvNo] = useState(invoice?.invoice_no || '')
  const [invType, setInvType] = useState(invoice?.invoice_type || 'auto')
  const [cart, setCart] = useState(
    invoice?.invoice_items?.map(it => ({
      desc: it.description, cat: it.category || '', cost: parseFloat(it.unit_price || it.amount || 0)
    })) || []
  )
  const [activeCat, setActiveCat] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!invoice) generateInvoiceNo().then(setInvNo)
  }, [])

  const detectType = (cartItems) => {
    const descs = cartItems.map(i => i.desc.toLowerCase())
    if (descs.some(d => d.includes('gearbox') || d.includes('transmission'))) return 'kc_gearbox'
    if (descs.some(d => d.includes('engine overhaul'))) return 'kc_engine'
    return 'onew'
  }

  const currentType = invType === 'auto' ? detectType(cart) : invType
  const typeLabel = { onew: '1 World — Regular 普通维修', kc_engine: 'K-Cars — Engine 引擎大修', kc_gearbox: 'K-Cars — Gearbox 变速箱 (含保修)' }

  const cats = [...new Set(catalog.map(c => c.category))]
  const catItems = activeCat ? catalog.filter(c => c.category === activeCat) : []
  const catIcon = (cat) => catalog.find(c => c.category === cat)?.category_icon || '🔧'

  const subtotal = cart.reduce((a, i) => a + i.cost, 0)
  const total = Math.max(0, subtotal - parseFloat(discount || 0))

  const toggleItem = (item) => {
    const exists = cart.findIndex(c => c.desc === item.name && c.cat === activeCat)
    if (exists >= 0) {
      setCart(cart.filter((_, i) => i !== exists))
    } else {
      setCart([...cart, { desc: item.name, cat: item.category, cost: parseFloat(item.default_price || 0) }])
    }
  }

  const updateCost = (idx, val) => {
    setCart(cart.map((c, i) => i === idx ? { ...c, cost: parseFloat(val) || 0 } : c))
  }

  const save = async () => {
    if (!cart.length) { alert('Please add at least one item. 请至少添加一项。'); return }
    setSaving(true)
    const detectedType = invType === 'auto' ? detectType(cart) : invType
    const inv = { invoice_no: invNo, date, technician: advisor+', '+mechanic, advisor, mechanic, mileage, chassis_no: chassisNo, notes, discount: parseFloat(discount || 0), status, subtotal: subtotal.toFixed(2), total: total.toFixed(2), invoice_type: detectedType }
    const items = cart.map((c, i) => ({
      description: c.desc, category: c.cat,
      qty: 1, unit_price: c.cost, amount: c.cost, sort_order: i
    }))
    await onSave(inv, items)
    setSaving(false)
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-head">
          <h3>{invoice ? `✏️ Edit ${invoice.invoice_no}` : '📋 New Invoice 新建发票'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* Customer Info */}
          <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
            <strong>{customer?.name}</strong>
            <span style={{ color: 'var(--orange)', fontFamily: 'monospace', marginLeft: 10, fontWeight: 700 }}>{customer?.car_plate}</span>
            <span style={{ color: 'var(--text3)', marginLeft: 8 }}>{customer?.car_make} {customer?.car_model}</span>
          </div>

          {/* Invoice type badge */}
          <div style={{ background: currentType==='onew'?'#e6f1fb': currentType==='kc_gearbox'?'#fff3ef':'#eaf3de',
            borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, fontWeight:600,
            color: currentType==='onew'?'#185fa5': currentType==='kc_gearbox'?'#D85A30':'#1a7f37' }}>
            📄 {typeLabel[currentType]}
            <span style={{ fontWeight:400, color:'#888', marginLeft:8 }}>
              {invType==='auto'?'(auto-detected 自动识别)':'(manual 手动)'}
            </span>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label>Invoice No 发票号</label>
              <input value={invNo} onChange={e => setInvNo(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Date 日期</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Advisor 顾问</label>
              <select value={advisor} onChange={e => setAdvisor(e.target.value)}>
                {ADVISORS.map(a => <option key={a} value={a}>{a || '— Select Advisor —'}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Mechanic 技师</label>
              <select value={mechanic} onChange={e => setMechanic(e.target.value)}>
                {MECHANICS.map(m => <option key={m} value={m}>{m || '— Select Mechanic —'}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Mileage 里程</label>
              <input value={mileage} onChange={e => setMileage(e.target.value)} placeholder="e.g. 93718" />
            </div>
            <div className="form-row">
              <label>Chassis No. 底盘号</label>
              <input value={chassisNo} onChange={e => setChassisNo(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label>Invoice Type 发票类型</label>
              <select value={invType} onChange={e => setInvType(e.target.value)}>
                <option value="auto">Auto-detect 自动识别</option>
                <option value="onew">1 World — Regular 普通维修</option>
                <option value="kc_engine">K-Cars — Engine 引擎大修</option>
                <option value="kc_gearbox">K-Cars — Gearbox 变速箱</option>
              </select>
            </div>
            <div className="form-row">
              <label>Status 状态</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="draft">Draft 草稿</option>
                <option value="confirmed">Confirmed 已确认</option>
                <option value="paid">Paid 已付款</option>
              </select>
            </div>
          </div>

          {/* Category Picker */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '.5px', marginBottom: 8 }}>
            Select Services 选择维修项目
          </div>
          <div className="cat-grid">
            {cats.map(cat => (
              <button key={cat} className={`cat-btn ${activeCat === cat ? 'active' : ''}`}
                onClick={() => setActiveCat(activeCat === cat ? null : cat)}>
                {catIcon(cat)} {cat}
              </button>
            ))}
          </div>

          {activeCat && (
            <div style={{ marginBottom: 12 }}>
              {catItems.map(item => (
                <div key={item.id} className="job-item">
                  <input type="checkbox"
                    checked={cart.some(c => c.desc === item.name && c.cat === activeCat)}
                    onChange={() => toggleItem(item)} />
                  <label className="job-item-name" onClick={() => toggleItem(item)}>{item.name}</label>
                  <input type="number" className="job-item-price"
                    value={cart.find(c => c.desc === item.name)?.cost ?? item.default_price}
                    onChange={e => {
                      const idx = cart.findIndex(c => c.desc === item.name)
                      if (idx >= 0) updateCost(idx, e.target.value)
                    }}
                    min="0" />
                </div>
              ))}
            </div>
          )}

          {/* Cart */}
          <div className="cart-section">
            <div className="cart-label">🛒 Selected Items {cart.length > 0 && `(${cart.length})`}</div>
            {cart.length === 0
              ? <div className="cart-empty">Tick items above to add them here 勾选上方项目</div>
              : cart.map((item, i) => (
                <div key={i} className="cart-item">
                  <div className="cart-item-name">{item.desc}</div>
                  <input type="number" style={{ width: 80, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, textAlign: 'right' }}
                    value={item.cost} onChange={e => updateCost(i, e.target.value)} min="0" />
                  <button className="cart-item-del" onClick={() => setCart(cart.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            {cart.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border2)', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>Discount / 折扣 (SGD $)</span>
                  <input type="number" style={{ width: 80, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, textAlign: 'right' }}
                    value={discount} onChange={e => setDiscount(e.target.value)} min="0" />
                </div>
                <div className="cart-total">
                  <span>Invoice Total / 总金额</span>
                  <span>SGD ${total.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="form-row" style={{ marginTop: 12 }}>
            <label>Notes 备注</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
          </div>

          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel 取消</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : `✓ Save Invoice 保存 (${cart.length} items)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Timeline ──────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { key: 'repair',      icon: '🔧', label: 'Repair 维修记录',   color: 'var(--orange)' },
  { key: 'whatsapp',    icon: '📱', label: 'WhatsApp 联系',     color: '#25D366' },
  { key: 'note',        icon: '📝', label: 'Note 备注',          color: 'var(--blue)' },
  { key: 'appointment', icon: '📅', label: 'Appointment 预约',  color: 'var(--green)' },
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
        <span>⏱ ACTIVITY TIMELINE 活动记录</span>
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
                {t.icon} {t.label}
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
                <div className="timeline-dot">{t.icon}</div>
                <div className="timeline-content">
                  <div style={{ fontSize:13, lineHeight:1.5 }}>{act.content}</div>
                  <div className="timeline-meta" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>{t.icon} {t.label} · {fmtDate(act.created_at)}</span>
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
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                      📝 {new Date(note.created_at).toLocaleString('en-SG', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={() => { setEditNoteId(note.id); setEditNoteVal(note.content) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:13, padding:'2px 4px' }}>✏️</button>
                    <button onClick={() => removeNote(note.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:13, padding:'2px 4px' }}>🗑</button>
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
            {overdue ? '⚠️ Overdue:' : '📅'} {fmtDate(task.due_date)}
          </div>
        )}
      </div>
      <button onClick={() => onDelete(task.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14, padding:'0 2px', flexShrink:0 }}>×</button>
    </div>
  )
}
