import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getCustomers, searchCustomers, getInvoices, deleteCustomer,
  upsertCustomer, createInvoice, updateInvoice, updateInvoiceStatus,
  deleteInvoice, generateInvoiceNo, getCatalog } from '../lib/supabase'
import { printInvoice, downloadInvoice } from '../lib/pdf'

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`
const fmtSGD = (n) => `SGD $${parseFloat(n || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`

const statusColors = { draft: 'tag-draft', confirmed: 'tag-confirmed', paid: 'tag-paid' }
const statusLabels = { draft: 'Draft 草稿', confirmed: 'Confirmed 已确认', paid: 'Paid 已付款' }

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

  const loadCustomers = async () => {
    const { data } = await getCustomers()
    setCustomers(data || [])
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
    <div className="app-shell">
      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar-title">
          🔧 {import.meta.env.VITE_GARAGE_NAME || 'K-Cars Garage'}
          <span className="topbar-badge">Singapore</span>
        </div>
        <div className="topbar-user">
          <span>{session.user.email}</span>
          <button className="btn btn-ghost" style={{ color: '#aaa', fontSize: 11 }}
            onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-label">Customers 客户</div>
          <div className="stat-val">{customers.length.toLocaleString()}</div>
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
          <div className="sidebar-count">
            {search ? `${customers.length} results` : `${customers.length.toLocaleString()} customers`}
          </div>
          <div className="cust-list">
            {loading ? <div className="spinner" /> :
              customers.slice(0, 300).map(c => (
                <div key={c.id} className={`cust-item ${selected?.id === c.id ? 'active' : ''}`}
                  onClick={() => selectCustomer(c)}>
                  <div className="cust-name">{c.name}</div>
                  <div className="cust-plate">{c.car_plate}</div>
                  <div className="cust-sub">{c.car_make} {c.car_model}</div>
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
                {selected.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', padding: '4px 0' }}>
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
            </>
          )}
        </div>
      </div>

      {/* Modals */}
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
            setSelected(updated)
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
              onClick={() => downloadInvoice(inv, customer, inv.invoice_items || [])}>
              ⬇️ PDF
            </button>
            <button className="btn btn-primary" style={{ fontSize: 11 }}
              onClick={() => printInvoice(inv, customer, inv.invoice_items || [])}>
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
  })
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
  const [date, setDate] = useState(invoice?.date || new Date().toISOString().split('T')[0])
  const [tech, setTech] = useState(invoice?.technician || '')
  const [notes, setNotes] = useState(invoice?.notes || '')
  const [discount, setDiscount] = useState(invoice?.discount || 0)
  const [status, setStatus] = useState(invoice?.status || 'draft')
  const [invNo, setInvNo] = useState(invoice?.invoice_no || '')
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
    const inv = { invoice_no: invNo, date, technician: tech, notes, discount: parseFloat(discount || 0), status, subtotal: subtotal.toFixed(2), total: total.toFixed(2) }
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
              <label>Technician 技师</label>
              <input value={tech} onChange={e => setTech(e.target.value)} placeholder="e.g. MENG, JON" />
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
