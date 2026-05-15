import { useState, useEffect, useCallback } from 'react'
import { Wrench, Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { getParts, searchParts, addPart, updatePart, deletePart } from '../lib/supabase'

const fmtPrice = (n) => (n != null && n !== '') ? `$${parseFloat(n).toFixed(2)}` : null

export default function Parts() {
  const [parts, setParts]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [query, setQuery]                   = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [categories, setCategories]         = useState([])
  const [modal, setModal]                   = useState(null)
  const [saving, setSaving]                 = useState(false)

  const load = useCallback(async (q, cat) => {
    setLoading(true)
    let data, error
    if (q && q.trim()) {
      const res = await searchParts(q.trim())
      data = res.data; error = res.error
    } else {
      const res = await getParts(cat && cat !== 'all' ? { category: cat } : {})
      data = res.data; error = res.error
      if (!error && (!cat || cat === 'all')) {
        const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))].sort()
        setCategories(cats)
      }
    }
    if (!error) setParts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load('', 'all') }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(query, activeCategory), 250)
    return () => clearTimeout(t)
  }, [query, activeCategory, load])

  const handleDelete = async (id) => {
    if (!confirm('Delete this part? 确认删除？')) return
    await deletePart(id)
    load(query, activeCategory)
  }

  const handleSave = async (formData) => {
    setSaving(true)
    if (modal.mode === 'add') {
      const { error } = await addPart(formData)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await updatePart(modal.part.id, formData)
      if (error) { alert(error.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    load(query, activeCategory)
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Wrench size={18} /> Parts 配件库
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {parts.length} parts · K-Cars Quotation Library
          </div>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={() => setModal({ mode: 'add', part: null })}>
          <Plus size={13} /> Add Part 添加配件
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search part name, vehicle, brand, model... 搜索配件名、车型、品牌"
          style={{ width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
        />
        {query && (
          <button onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
            <X size={13} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', ...categories].map(cat => (
          <button key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: '1px solid var(--border)',
              background: activeCategory === cat ? 'var(--orange)' : 'var(--bg2)',
              color: activeCategory === cat ? '#fff' : 'var(--text2)',
            }}>
            {cat === 'all' ? 'All 全部' : cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : parts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 48 }}>
          No parts found. 没有找到配件。
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Part Name 配件名', 'Vehicle 车型', 'Category 类别', 'Selling Price 售价', 'Cost 成本', 'Notes 备注', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600 }}>{p.part_name}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)', fontSize: 12 }}>
                    {p.vehicle_text || '—'}
                    {p.brand && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({p.brand})</span>}
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    {p.category && (
                      <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9999, padding: '2px 8px', fontSize: 11 }}>
                        {p.category}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>
                    {fmtPrice(p.selling_price)
                      ? <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{fmtPrice(p.selling_price)}</span>
                      : <span style={{ color: '#c0392b', fontSize: 11 }}>{p.selling_price_text || '—'}</span>
                    }
                  </td>
                  <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: 'var(--text3)' }}>
                    {fmtPrice(p.cost_price) || '—'}
                  </td>
                  <td style={{ padding: '9px 10px', color: 'var(--text3)', fontSize: 12, maxWidth: 160 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.notes || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: p.status === 'inactive' ? 'var(--bg2)' : '#eaf3de',
                      color: p.status === 'inactive' ? 'var(--text3)' : '#1a7f37',
                    }}>
                      {p.status || 'active'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                    <button className="btn" style={{ padding: '3px 8px', fontSize: 11, marginRight: 4 }}
                      onClick={() => setModal({ mode: 'edit', part: p })}>
                      <Pencil size={11} />
                    </button>
                    <button className="btn" style={{ padding: '3px 8px', fontSize: 11, color: '#c0392b' }}
                      onClick={() => handleDelete(p.id)}>
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PartModal
          part={modal.part}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}

function PartModal({ part, mode, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    part_name:          part?.part_name          || '',
    vehicle_text:       part?.vehicle_text        || '',
    brand:              part?.brand               || '',
    vehicle_model:      part?.vehicle_model       || '',
    category:           part?.category            || '',
    selling_price:      part?.selling_price       ?? '',
    selling_price_text: part?.selling_price_text  || '',
    cost_price:         part?.cost_price          ?? '',
    notes:              part?.notes               || '',
    status:             part?.status              || 'active',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.part_name.trim()) { alert('Part name is required. 请输入配件名。'); return }
    onSave({
      ...form,
      selling_price: form.selling_price === '' ? null : parseFloat(form.selling_price),
      cost_price:    form.cost_price    === '' ? null : parseFloat(form.cost_price),
    })
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={14} /> {mode === 'add' ? 'Add Part 添加配件' : 'Edit Part 编辑配件'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Part Name 配件名 *</label>
              <input value={form.part_name} onChange={e => set('part_name', e.target.value)} placeholder="e.g. Engine Oil Filter" />
            </div>
            <div className="form-row">
              <label>Vehicle 车型</label>
              <input value={form.vehicle_text} onChange={e => set('vehicle_text', e.target.value)} placeholder="e.g. Toyota Camry 2.5" />
            </div>
            <div className="form-row">
              <label>Brand 品牌</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Toyota" />
            </div>
            <div className="form-row">
              <label>Model 型号</label>
              <input value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Category 类别</label>
              <input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Engine Parts" />
            </div>
            <div className="form-row">
              <label>Selling Price 售价 (SGD)</label>
              <input type="number" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="leave blank if quote-on-request" min="0" step="0.01" />
            </div>
            <div className="form-row">
              <label>Price Text 报价文字</label>
              <input value={form.selling_price_text} onChange={e => set('selling_price_text', e.target.value)} placeholder="e.g. $120–$150" />
            </div>
            <div className="form-row">
              <label>Cost Price 成本</label>
              <input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} min="0" step="0.01" />
            </div>
            <div className="form-row">
              <label>Status 状态</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active 启用</option>
                <option value="inactive">Inactive 停用</option>
              </select>
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Notes 备注</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={onClose}>Cancel 取消</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save 保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
