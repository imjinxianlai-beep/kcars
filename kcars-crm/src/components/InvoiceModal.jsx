import { useState, useEffect, useCallback, useRef } from 'react'
import { Pencil, FileText, Wrench } from 'lucide-react'
import { supabase, generateInvoiceNo, searchParts } from '../lib/supabase'

const fmtMoney = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`

function getPartPriceMeta(part, latestPrice) {
  if (part?.selling_price != null && part.selling_price !== '') {
    return {
      amount: parseFloat(part.selling_price),
      label: fmtMoney(part.selling_price),
      source: 'Standard price',
      needsConfirm: false,
    }
  }
  if (part?.selling_price_text) {
    return {
      amount: 0,
      label: part.selling_price_text,
      source: 'Price note',
      needsConfirm: true,
    }
  }
  if (latestPrice?.amount != null) {
    return {
      amount: parseFloat(latestPrice.amount),
      label: `Recent ${fmtMoney(latestPrice.amount)}`,
      source: 'Recent sold price',
      needsConfirm: true,
    }
  }
  return {
    amount: 0,
    label: 'Price TBC',
    source: 'Needs confirmation',
    needsConfirm: true,
  }
}

export default function InvoiceModal({ customer, vehicle, invoice, catalog, onClose, onSave }) {
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
      id: it.id,
      desc: it.description,
      cat: it.category || '',
      cost: parseFloat(it.unit_price || it.amount || 0),
      qty: parseFloat(it.qty || 1),
      partId: it.part_id || null,
      itemType: it.item_type || 'legacy',
      note: it.note || '',
    })) || []
  )
  const [activeCat, setActiveCat] = useState(null)
  const [saving, setSaving] = useState(false)
  const [partsQuery, setPartsQuery] = useState('')
  const [partsResults, setPartsResults] = useState([])
  const [partsLoading, setPartsLoading] = useState(false)
  const [partsError, setPartsError] = useState('')
  const [partsLatestMap, setPartsLatestMap] = useState({})
  const partsSearchSeqRef = useRef(0)

  useEffect(() => {
    if (!invoice) generateInvoiceNo().then(setInvNo)
  }, [invoice])

  const loadPartLatestPrices = useCallback(async (partsList) => {
    const ids = [...new Set((partsList || []).map(p => p.id).filter(Boolean))]
    if (!ids.length) return
    const { data, error } = await supabase
      .from('part_price_recent')
      .select('part_id, amount, date, invoice_no, car_make, car_model')
      .in('part_id', ids)
      .eq('rn', 1)
    if (error) return
    const next = {}
    for (const row of data || []) next[row.part_id] = row
    setPartsLatestMap(prev => ({ ...prev, ...next }))
  }, [])

  useEffect(() => {
    const seq = partsSearchSeqRef.current + 1
    partsSearchSeqRef.current = seq
    if (!partsQuery.trim()) {
      setPartsResults([])
      setPartsError('')
      setPartsLoading(false)
      return
    }
    setPartsLoading(true)
    setPartsError('')
    const t = setTimeout(async () => {
      try {
        const { data, error } = await searchParts(partsQuery.trim())
        if (partsSearchSeqRef.current !== seq) return
        if (error) throw error
        const rows = data || []
        setPartsResults(rows)
        loadPartLatestPrices(rows)
      } catch (err) {
        if (partsSearchSeqRef.current !== seq) return
        setPartsResults([])
        setPartsError('Parts search failed. Please try again.')
      } finally {
        if (partsSearchSeqRef.current === seq) setPartsLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [partsQuery, loadPartLatestPrices])

  const detectType = (cartItems) => {
    const descs = cartItems.map(i => i.desc.toLowerCase())
    if (descs.some(d => d.includes('gearbox') || d.includes('transmission'))) return 'kc_gearbox'
    if (descs.some(d => d.includes('engine overhaul'))) return 'kc_engine'
    return 'onew'
  }

  const currentType = invType === 'auto' ? detectType(cart) : invType
  const typeLabel = { onew: '1 World — Regular 普通维修', kc_engine: 'K-Cars — Engine 引擎大修', kc_gearbox: 'K-Cars — Gearbox 变速箱 (含保修)' }

  const cats = [...new Set((catalog || []).map(c => c.category))]
  const catItems = activeCat ? (catalog || []).filter(c => c.category === activeCat) : []
  const catIcon = (cat) => (catalog || []).find(c => c.category === cat)?.category_icon || null

  const subtotal = cart.reduce((a, i) => a + (parseFloat(i.cost || 0) * parseFloat(i.qty || 1)), 0)
  const total = Math.max(0, subtotal - parseFloat(discount || 0))

  const toggleItem = (item) => {
    const exists = cart.findIndex(c => c.desc === item.name && c.cat === activeCat)
    if (exists >= 0) {
      setCart(cart.filter((_, i) => i !== exists))
    } else {
      setCart([...cart, { desc: item.name, cat: item.category, cost: parseFloat(item.default_price || 0), qty: 1, itemType: 'service' }])
    }
  }

  const updateCost = (idx, val) => {
    setCart(cart.map((c, i) => i === idx ? { ...c, cost: parseFloat(val) || 0 } : c))
  }

  const save = async () => {
    if (!cart.length) { alert('Please add at least one item. 请至少添加一项。'); return }
    setSaving(true)
    const detectedType = invType === 'auto' ? detectType(cart) : invType
    const inv = { invoice_no: invNo, date, technician: advisor + ', ' + mechanic, advisor, mechanic, mileage, chassis_no: chassisNo, notes, discount: parseFloat(discount || 0), status, subtotal: subtotal.toFixed(2), total: total.toFixed(2), invoice_type: detectedType }
    const items = cart.map((c, i) => ({
      id: c.id,
      description: c.desc,
      category: c.cat,
      qty: parseFloat(c.qty || 1),
      unit_price: c.cost,
      amount: parseFloat(c.cost || 0) * parseFloat(c.qty || 1),
      sort_order: i,
      part_id: c.partId || null,
      item_type: c.itemType || (c.partId ? 'part' : 'service'),
      note: c.note || null,
    }))
    try {
      await onSave(inv, items)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{invoice ? <><Pencil size={14} /> Edit {invoice.invoice_no}</> : <><FileText size={14} /> New Invoice 新建发票</>}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f6f9fc', border: '1px solid #e3e8ee', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0d253d' }}>{customer?.name}</div>
              <div style={{ fontSize: 11, color: '#64748d', marginTop: 1 }}>
                {[vehicle?.car_make || customer?.car_make, vehicle?.car_model || customer?.car_model].filter(Boolean).join(' ')}
                {(vehicle?.car_year) && <span style={{ marginLeft: 5 }}>{vehicle.car_year}</span>}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 600, fontSize: 16, color: 'var(--orange)', letterSpacing: '-0.3px', fontFeatureSettings: '"tnum"' }}>
              {vehicle?.car_plate || customer?.car_plate}
            </div>
          </div>

          <div style={{
            background: currentType === 'onew' ? '#e6f1fb' : currentType === 'kc_gearbox' ? '#fff3ef' : '#eaf3de',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, fontWeight: 600,
            color: currentType === 'onew' ? '#185fa5' : currentType === 'kc_gearbox' ? '#D85A30' : '#1a7f37',
          }}>
            {typeLabel[currentType]}
            <span style={{ fontWeight: 400, color: '#888', marginLeft: 8 }}>
              {invType === 'auto' ? '(auto-detected 自动识别)' : '(manual 手动)'}
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

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '.5px', marginBottom: 8 }}>
            Select Services 选择维修项目
          </div>
          <div className="cat-grid">
            {cats.map(cat => (
              <button key={cat} className={`cat-btn ${activeCat === cat ? 'active' : ''}`}
                onClick={() => setActiveCat(activeCat === cat ? null : cat)}>
                {catIcon(cat) ? <>{catIcon(cat)} </> : <Wrench size={11} style={{ marginRight: 4 }} />}{cat}
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

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '.5px', marginBottom: 8, marginTop: 14 }}>
            Parts 配件 <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— search &amp; add from parts library</span>
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              value={partsQuery}
              onChange={e => setPartsQuery(e.target.value)}
              placeholder="Search part name, vehicle, brand... 搜索配件名、车型"
              style={{ width: '100%', boxSizing: 'border-box', paddingRight: partsQuery ? 28 : undefined }}
            />
            {partsQuery && (
              <button onClick={() => { setPartsQuery(''); setPartsResults([]) }}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>
          {partsLoading && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Searching... 搜索中</div>}
          {partsError && <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 8 }}>{partsError}</div>}
          {partsResults.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {partsResults.map(p => {
                const latestPrice = partsLatestMap[p.id]
                const priceMeta = getPartPriceMeta(p, latestPrice)
                const inCart = cart.some(c => c.desc === p.part_name && c.partId === p.id)
                return (
                  <div key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderBottom: '1px solid var(--border2)', fontSize: 13,
                      background: inCart ? 'var(--orange-light, #fff8f5)' : 'var(--bg)',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (inCart) {
                        setCart(cart.filter(c => !(c.desc === p.part_name && c.partId === p.id)))
                      } else {
                        setCart([...cart, {
                          desc: p.part_name,
                          cat: p.category || 'Parts',
                          cost: priceMeta.amount,
                          qty: 1,
                          partId: p.id,
                          itemType: 'part',
                          vehicleText: p.vehicle_text || '',
                          priceSource: priceMeta.source,
                          priceLabel: priceMeta.label,
                          priceText: priceMeta.needsConfirm ? priceMeta.label : null,
                        }])
                      }
                    }}>
                    <input type="checkbox" readOnly checked={inCart} style={{ pointerEvents: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.part_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {[p.vehicle_text, p.category].filter(Boolean).join(' · ')}
                      </div>
                      <div style={{ fontSize: 10, color: priceMeta.needsConfirm ? '#c0392b' : 'var(--text3)', marginTop: 2 }}>
                        {priceMeta.source}{latestPrice?.date ? ` · ${String(latestPrice.date).slice(0, 10)}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', flexShrink: 0 }}>
                      <span style={{ color: priceMeta.needsConfirm ? '#c0392b' : 'var(--orange)', fontWeight: 700 }}>
                        {priceMeta.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="cart-section">
            <div className="cart-label">Selected Items {cart.length > 0 && `(${cart.length})`}</div>
            {cart.length === 0
              ? <div className="cart-empty">Tick items above to add them here 勾选上方项目</div>
              : cart.map((item, i) => (
                <div key={item.id || `${item.desc}-${i}`} className="cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="cart-item-name">
                      {item.desc}
                      {item.partId && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--orange)',
                          background: '#fff3ef', borderRadius: 9999, padding: '1px 7px',
                        }}>
                          STANDARD PART
                        </span>
                      )}
                    </div>
                    <input type="number" style={{ width: 80, padding: '3px 6px', border: `1px solid ${item.priceText ? '#e74c3c' : 'var(--border)'}`, borderRadius: 5, fontSize: 12, textAlign: 'right' }}
                      value={item.cost} onChange={e => updateCost(i, e.target.value)} min="0" />
                    <button className="cart-item-del" onClick={() => setCart(cart.filter((_, j) => j !== i))}>×</button>
                  </div>
                  {item.partId && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 2 }}>
                      {[item.cat, item.vehicleText, item.priceSource].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {item.priceText && (
                    <div style={{ fontSize: 11, color: '#c0392b', paddingLeft: 2 }}>
                      Price needs confirmation: {item.priceText}. Confirm the invoice price before saving.
                    </div>
                  )}
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
              {saving ? 'Saving...' : `Save Invoice 保存 (${cart.length} items)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
