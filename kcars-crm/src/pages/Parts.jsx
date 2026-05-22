import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Wrench, X, Pencil, Trash2 } from 'lucide-react'
import { getParts, addPart, updatePart, deletePart } from '../lib/supabase'

// ── Module-level constants ────────────────────────────────────────────────────
const BRANDS = ['Toyota', 'Honda', 'Nissan', 'Mitsubishi', 'Hyundai', 'Kia', 'BMW', 'Mercedes', 'Audi']

const CAT_EMOJI = {
  transmission: '⚙️', gearbox: '⚙️',
  engine: '🔧',
  suspension: '🏎️',
  electrical: '⚡',
  brake: '🛑',
  air: '❄️', aircon: '❄️', conditioning: '❄️', compressor: '❄️',
  body: '🚗',
  cooling: '🌡️',
  exhaust: '💨',
  steering: '🔄',
  fuel: '⛽',
  clutch: '🔩',
  differential: '⚙️',
}

const getCatEmoji = (cat = '') => {
  const lc = cat.toLowerCase()
  for (const [key, emoji] of Object.entries(CAT_EMOJI)) {
    if (lc.includes(key)) return emoji
  }
  return '📦'
}

const fmtPrice = (p) => {
  if (p?.selling_price != null && p.selling_price !== '') {
    return `$${parseFloat(p.selling_price).toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return p?.selling_price_text || null
}

// ── Part Row (top-level per rerender-no-inline-components) ───────────────────
function PartRow({ part, onEdit, onDelete }) {
  const price = fmtPrice(part)
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #e3e8ee', gap: 12, transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f6f9fc'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#0d253d', marginBottom: part.vehicle_text ? 2 : 0 }}>
          {part.part_name}
        </div>
        {part.vehicle_text && (
          <div style={{ fontSize: 12, color: '#64748d', marginBottom: part.notes ? 2 : 0 }}>
            {part.vehicle_text}
          </div>
        )}
        {part.notes && (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{part.notes}</div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 72 }}>
        {price
          ? <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--orange)', fontFeatureSettings: '"tnum"', letterSpacing: '-0.4px' }}>{price}</span>
          : <span style={{ fontSize: 12, color: '#94a3b8' }}>QOR</span>
        }
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => onEdit(part)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px', borderRadius: 6, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(part.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '6px', borderRadius: 6, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Category Group (top-level) ────────────────────────────────────────────────
function CategoryGroup({ category, parts, onEdit, onDelete }) {
  const [collapsed, setCollapsed] = useState(false)
  const emoji = getCatEmoji(category)

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e3e8ee', boxShadow: 'rgba(0,55,112,0.08) 0 1px 3px', overflow: 'hidden', marginBottom: 10 }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', cursor: 'pointer', userSelect: 'none', background: '#f6f9fc', borderBottom: collapsed ? 'none' : '1px solid #e3e8ee' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#0d253d', letterSpacing: '-0.2px' }}>
            {category || 'Other'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999, background: '#e3e8ee', color: '#64748d' }}>
            {parts.length}
          </span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: 11, transition: 'transform .2s', transform: collapsed ? 'rotate(-90deg)' : 'none', display: 'inline-block' }}>▼</span>
      </div>

      {!collapsed && parts.map(p => (
        <PartRow key={p.id} part={p} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}

// ── Brand Chips (top-level) ───────────────────────────────────────────────────
function BrandChips({ activeBrand, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {[...BRANDS, 'Others'].map(brand => {
        const active = activeBrand === brand
        return (
          <button
            key={brand}
            onClick={() => onSelect(active ? null : brand)}
            style={{
              flexShrink: 0, padding: '7px 16px', borderRadius: 9999,
              border: active ? 'none' : '1px solid #e3e8ee',
              background: active ? 'var(--orange)' : '#fff',
              color: active ? '#fff' : '#0d253d',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              boxShadow: active ? 'rgba(0,55,112,0.12) 0 2px 6px' : 'rgba(0,55,112,0.06) 0 1px 2px',
              transition: 'background .15s, color .15s, box-shadow .15s',
            }}
          >
            {brand}
          </button>
        )
      })}
    </div>
  )
}

// ── Part Modal (top-level) ────────────────────────────────────────────────────
function PartModal({ part, mode, makes, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    part_name:          part?.part_name          || '',
    vehicle_make:       part?.vehicle_make        || '',
    vehicle_model:      part?.vehicle_model       || '',
    vehicle_text:       part?.vehicle_text        || '',
    category:           part?.category            || '',
    selling_price:      part?.selling_price       ?? '',
    selling_price_text: part?.selling_price_text  || '',
    cost_price:         part?.cost_price          ?? '',
    notes:              part?.notes               || '',
    status:             part?.status              || 'active',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = () => {
    if (!form.part_name.trim()) { alert('Part name is required. 请输入配件名。'); return }
    onSave({
      ...form,
      selling_price: form.selling_price === '' ? null : parseFloat(form.selling_price),
      cost_price:    form.cost_price    === '' ? null : parseFloat(form.cost_price),
    })
  }

  const input = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    border: '1px solid #a8c3de', borderRadius: 6, fontSize: 14,
    color: '#0d253d', outline: 'none', background: '#fff',
    fontFamily: 'inherit',
  }
  const label = { fontSize: 12, fontWeight: 600, color: '#64748d', marginBottom: 5, display: 'block' }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
            <Wrench size={14} /> {mode === 'add' ? 'Add Part 添加配件' : 'Edit Part 编辑配件'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={label}>Part Name 配件名 *</label>
            <input value={form.part_name} onChange={set('part_name')} placeholder="e.g. CVT Gearbox Assembly" style={input} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Vehicle Make 车辆品牌</label>
              <select value={form.vehicle_make} onChange={set('vehicle_make')} style={{ ...input }}>
                <option value="">— select —</option>
                {[...new Set([...BRANDS, ...makes])].sort().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Vehicle Model 车型</label>
              <input value={form.vehicle_model} onChange={set('vehicle_model')} placeholder="e.g. Wish" style={input} />
            </div>
          </div>

          <div>
            <label style={label}>Vehicle Text 车辆描述</label>
            <input value={form.vehicle_text} onChange={set('vehicle_text')} placeholder="e.g. Toyota Wish 2.0 2009–2017" style={input} />
          </div>

          <div>
            <label style={label}>Category 类别</label>
            <input value={form.category} onChange={set('category')} placeholder="e.g. Transmission" style={input} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Selling Price 售价 (SGD)</label>
              <input type="number" value={form.selling_price} onChange={set('selling_price')} placeholder="e.g. 1800" min="0" step="1" style={input} />
            </div>
            <div>
              <label style={label}>Price Range Text 报价范围</label>
              <input value={form.selling_price_text} onChange={set('selling_price_text')} placeholder="e.g. $1800–$2500" style={input} />
            </div>
          </div>

          <div>
            <label style={label}>Notes 备注</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Additional notes, installation info..." rows={2}
              style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn" onClick={onClose}>Cancel 取消</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : mode === 'add' ? '+ Add Part 添加' : '✓ Save 保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty State (top-level) ───────────────────────────────────────────────────
function EmptyState({ query, activeBrand }) {
  const msg = query
    ? `No parts found for "${query}"`
    : activeBrand
    ? `No ${activeBrand} parts in the library yet`
    : 'No parts yet — add the first one!'
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94a3b8' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔩</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#64748d', marginBottom: 4 }}>{msg}</div>
      <div style={{ fontSize: 12 }}>
        {query ? '尝试不同的搜索词' : '点击右上角 + Add Part 添加配件'}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Parts() {
  const [parts, setParts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')
  const [activeBrand, setActiveBrand] = useState(null)
  const [modal, setModal]     = useState(null)  // null | { mode:'add'|'edit', part }
  const [saving, setSaving]   = useState(false)
  const searchRef             = useRef(null)

  useEffect(() => {
    getParts().then(({ data }) => {
      setParts(data || [])
      setLoading(false)
    })
  }, [])

  // ── Client-side filtering (rerender-derived-state-no-effect) ─────────────
  const ql = query.toLowerCase()
  const filtered = parts.filter(p => {
    const matchQuery = !ql || [p.part_name, p.vehicle_text, p.vehicle_make, p.brand, p.vehicle_model]
      .some(f => f?.toLowerCase().includes(ql))
    const matchBrand = !activeBrand || (
      activeBrand === 'Others'
        ? !BRANDS.some(b => p.vehicle_make?.toLowerCase() === b.toLowerCase())
        : p.vehicle_make?.toLowerCase() === activeBrand.toLowerCase()
    )
    return matchQuery && matchBrand
  })

  // Group by category, sort groups by count desc
  const groupMap = {}
  for (const p of filtered) {
    const cat = p.category || 'Other'
    if (!groupMap[cat]) groupMap[cat] = []
    groupMap[cat].push(p)
  }
  const groups = Object.entries(groupMap).sort((a, b) => b[1].length - a[1].length)
  const makes  = [...new Set(parts.map(p => p.vehicle_make).filter(Boolean))].sort()

  const handleDelete = async (id) => {
    if (!confirm('Delete this part? 确认删除？')) return
    await deletePart(id)
    setParts(ps => ps.filter(p => p.id !== id))
  }

  const handleEdit = (part) => setModal({ mode: 'edit', part })

  const handleSave = async (formData) => {
    setSaving(true)
    if (modal.mode === 'add') {
      const { data, error } = await addPart(formData)
      if (error) { alert(error.message); setSaving(false); return }
      setParts(ps => [data, ...ps])
    } else {
      const { data, error } = await updatePart(modal.part.id, formData)
      if (error) { alert(error.message); setSaving(false); return }
      setParts(ps => ps.map(p => p.id === modal.part.id ? data : p))
    }
    setSaving(false)
    setModal(null)
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#f6f9fc' }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#fff', borderBottom: '1px solid #e3e8ee',
        padding: '14px 20px 12px',
        boxShadow: 'rgba(0,55,112,0.06) 0 2px 8px',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0d253d', display: 'flex', alignItems: 'center', gap: 7, letterSpacing: '-0.3px', fontFamily: "'Syne', sans-serif" }}>
              <Wrench size={16} /> Parts 配件询价库
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {loading ? '…' : `${parts.length} parts`}
              {(query || activeBrand) && !loading && (
                <span style={{ color: 'var(--orange)', fontWeight: 600 }}> · {filtered.length} results</span>
              )}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'add', part: null })}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 14px' }}
          >
            <Plus size={13} /> Add Part
          </button>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={'搜索车型 · 配件名  e.g. "Toyota Wish" · "Gearbox" · "Honda Vezel"'}
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: 38, paddingRight: query ? 36 : 14,
              paddingTop: 11, paddingBottom: 11,
              border: '1px solid #a8c3de', borderRadius: 10,
              fontSize: 14, color: '#0d253d', background: '#f6f9fc',
              outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--orange)'}
            onBlur={e => e.target.style.borderColor = '#a8c3de'}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); searchRef.current?.focus() }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 2 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Brand chips */}
        <BrandChips activeBrand={activeBrand} onSelect={setActiveBrand} />
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px 20px', maxWidth: 860, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <div className="spinner" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState query={query} activeBrand={activeBrand} />
        ) : (
          groups.map(([cat, catParts]) => (
            <CategoryGroup
              key={cat}
              category={cat}
              parts={catParts}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {modal && (
        <PartModal
          part={modal.part}
          mode={modal.mode}
          makes={makes}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
