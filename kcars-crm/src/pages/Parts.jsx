import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { supabase, addPart, updatePart } from '../lib/supabase'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(part) {
  if (part?.selling_price != null && part.selling_price !== '') {
    return `$${Math.round(part.selling_price).toLocaleString()}`
  }
  if (part?.selling_price_text) return part.selling_price_text
  return null
}

function dedupe(rows, key) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const v = row[key]
    if (v && !seen.has(v)) { seen.add(v); out.push(v) }
  }
  return out
}

// ── BackBtn ───────────────────────────────────────────────────────────────────

function BackBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
        color: '#0d253d',
        padding: '0 12px 0 0',
        fontFamily: 'inherit',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {'‹ '}{label}
    </button>
  )
}

// ── StepHeader ────────────────────────────────────────────────────────────────

function StepHeader({ title, subtitle, backLabel, onBack, onAdd }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: '#fff',
      borderBottom: '1px solid #e3e8ee',
      padding: '14px 20px 12px',
      boxShadow: 'rgba(0,55,112,0.06) 0 2px 8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
          {backLabel && onBack && (
            <BackBtn label={backLabel} onClick={onBack} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#0d253d',
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {title}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={onAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
        >
          <Plus size={13} /> Add Part
        </button>
      </div>
    </div>
  )
}

// ── ListCard ──────────────────────────────────────────────────────────────────

function ListCard({ children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e3e8ee',
      overflow: 'hidden',
      margin: '16px 20px',
      boxShadow: 'rgba(0,55,112,0.08) 0 1px 3px',
    }}>
      {children}
    </div>
  )
}

// ── ListRow ───────────────────────────────────────────────────────────────────

function ListRow({ primary, secondary, badge, chevron, price, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        background: hovered ? '#f6f9fc' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0d253d', lineHeight: 1.3 }}>
          {primary}
        </div>
        {secondary && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{secondary}</div>
        )}
      </div>

      {badge != null && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '1px 8px',
          borderRadius: 9999,
          background: '#e3e8ee',
          color: '#64748d',
          marginLeft: 10,
          flexShrink: 0,
        }}>
          {badge}
        </span>
      )}

      {price != null && (
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          color: price === 'TBC' ? '#94a3b8' : 'var(--orange)',
          fontFeatureSettings: '"tnum"',
          letterSpacing: '-0.4px',
          marginLeft: 12,
          flexShrink: 0,
        }}>
          {price}
        </span>
      )}

      {chevron && (
        <span style={{ color: '#94a3b8', fontSize: 18, marginLeft: 10, flexShrink: 0, lineHeight: 1 }}>
          ›
        </span>
      )}
    </div>
  )
}

// ── LoadingView ───────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '64px 0' }}>
      <div className="spinner" />
    </div>
  )
}

// ── EmptyView ─────────────────────────────────────────────────────────────────

function EmptyView({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: '#94a3b8', fontSize: 14 }}>
      {message || 'No data found'}
    </div>
  )
}

// ── PartModal ─────────────────────────────────────────────────────────────────

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
    if (!form.part_name.trim()) { alert('Part name is required.'); return }
    onSave({
      ...form,
      selling_price: form.selling_price === '' ? null : parseFloat(form.selling_price),
      cost_price:    form.cost_price    === '' ? null : parseFloat(form.cost_price),
    })
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    border: '1px solid #a8c3de',
    borderRadius: 6,
    fontSize: 14,
    color: '#0d253d',
    outline: 'none',
    background: '#fff',
    fontFamily: 'inherit',
  }

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748d',
    marginBottom: 5,
    display: 'block',
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0d253d' }}>
            {mode === 'add' ? 'Add Part' : 'Edit Part'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={labelStyle}>Part Name *</label>
            <input
              value={form.part_name}
              onChange={set('part_name')}
              placeholder="e.g. CVT Gearbox Assembly"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Vehicle Make</label>
              <select value={form.vehicle_make} onChange={set('vehicle_make')} style={inputStyle}>
                <option value="">— select —</option>
                {makes.sort().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vehicle Model</label>
              <input
                value={form.vehicle_model}
                onChange={set('vehicle_model')}
                placeholder="e.g. Wish"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Vehicle Description</label>
            <input
              value={form.vehicle_text}
              onChange={set('vehicle_text')}
              placeholder="e.g. Toyota Wish 2.0 2009-2017"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <input
              value={form.category}
              onChange={set('category')}
              placeholder="e.g. Transmission"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Selling Price (SGD)</label>
              <input
                type="number"
                value={form.selling_price}
                onChange={set('selling_price')}
                placeholder="e.g. 1800"
                min="0"
                step="1"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Price Range Text</label>
              <input
                value={form.selling_price_text}
                onChange={set('selling_price_text')}
                placeholder="e.g. $1800-$2500"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder="Additional notes, installation info..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : mode === 'add' ? '+ Add Part' : 'Save'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Parts() {
  const [step, setStep]                       = useState(1)
  const [selectedMake, setSelectedMake]       = useState(null)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)

  const [brands, setBrands]         = useState([])
  const [vehicles, setVehicles]     = useState([])
  const [categories, setCategories] = useState([])
  const [parts, setParts]           = useState([])

  const [loading, setLoading] = useState(false)
  const [modal, setModal]     = useState(null)
  const [saving, setSaving]   = useState(false)

  // Step 1 — fetch brands on mount
  useEffect(() => {
    setLoading(true)
    supabase
      .from('parts_library')
      .select('vehicle_make')
      .order('vehicle_make')
      .then(({ data }) => {
        setBrands(dedupe(data || [], 'vehicle_make'))
        setLoading(false)
      })
  }, [])

  // Step 2 — fetch vehicles when make is selected
  useEffect(() => {
    if (!selectedMake) return
    setLoading(true)
    supabase
      .from('parts_library')
      .select('vehicle_text')
      .eq('vehicle_make', selectedMake)
      .order('vehicle_text')
      .then(({ data }) => {
        setVehicles(dedupe(data || [], 'vehicle_text'))
        setLoading(false)
      })
  }, [selectedMake])

  // Step 3 — fetch categories when vehicle is selected
  useEffect(() => {
    if (!selectedVehicle) return
    setLoading(true)
    supabase
      .from('parts_library')
      .select('category')
      .eq('vehicle_text', selectedVehicle)
      .order('category')
      .then(({ data }) => {
        const rows = data || []
        const countMap = {}
        for (const row of rows) {
          const c = row.category
          if (c) countMap[c] = (countMap[c] || 0) + 1
        }
        const cats = Object.entries(countMap).map(([name, count]) => ({ name, count }))
        cats.sort((a, b) => a.name.localeCompare(b.name))
        setCategories(cats)
        setLoading(false)
      })
  }, [selectedVehicle])

  // Step 4 — fetch parts when category is selected
  useEffect(() => {
    if (!selectedVehicle || !selectedCategory) return
    setLoading(true)
    supabase
      .from('parts_library')
      .select('*')
      .eq('vehicle_text', selectedVehicle)
      .eq('category', selectedCategory)
      .order('part_name')
      .then(({ data }) => {
        setParts(data || [])
        setLoading(false)
      })
  }, [selectedVehicle, selectedCategory])

  // Navigation handlers
  const goToStep1 = () => {
    setStep(1)
    setSelectedMake(null)
    setSelectedVehicle(null)
    setSelectedCategory(null)
  }

  const goToStep2 = () => {
    setStep(2)
    setSelectedVehicle(null)
    setSelectedCategory(null)
  }

  const goToStep3 = () => {
    setStep(3)
    setSelectedCategory(null)
  }

  const selectMake = (make) => {
    setSelectedMake(make)
    setSelectedVehicle(null)
    setSelectedCategory(null)
    setStep(2)
  }

  const selectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle)
    setSelectedCategory(null)
    setStep(3)
  }

  const selectCategory = (category) => {
    setSelectedCategory(category)
    setStep(4)
  }

  const handleSave = async (formData) => {
    setSaving(true)
    if (modal.mode === 'add') {
      const { data, error } = await addPart(formData)
      if (error) { alert(error.message); setSaving(false); return }
      if (step === 4 && data) {
        setParts(ps => [...ps, data].sort((a, b) => a.part_name.localeCompare(b.part_name)))
      }
    } else {
      const { data, error } = await updatePart(modal.part.id, formData)
      if (error) { alert(error.message); setSaving(false); return }
      if (step === 4 && data) {
        setParts(ps => ps.map(p => p.id === modal.part.id ? data : p))
      }
    }
    setSaving(false)
    setModal(null)
  }

  // Header config per step
  const headerProps = (() => {
    if (step === 1) return { title: 'Parts Lookup', subtitle: 'Select a brand', backLabel: null, onBack: null }
    if (step === 2) return { title: selectedMake, subtitle: 'Select a vehicle', backLabel: selectedMake, onBack: goToStep1 }
    if (step === 3) return { title: selectedVehicle, subtitle: 'Select a part category', backLabel: selectedMake, onBack: goToStep2 }
    return { title: selectedCategory, subtitle: `${selectedMake} · ${selectedVehicle}`, backLabel: selectedVehicle, onBack: goToStep3 }
  })()

  // Makes list for modal (brands already loaded from step 1)
  const makesForModal = brands.length > 0
    ? brands
    : []

  return (
    <div style={{ background: '#f6f9fc', height: '100%', overflow: 'auto' }}>

      <StepHeader
        title={headerProps.title}
        subtitle={headerProps.subtitle}
        backLabel={headerProps.backLabel}
        onBack={headerProps.onBack}
        onAdd={() => setModal({ mode: 'add', part: null })}
      />

      {/* Step 1 — Brands */}
      {step === 1 && (
        loading ? <LoadingView /> : brands.length === 0 ? <EmptyView message="No brands found" /> : (
          <ListCard>
            {brands.map((brand, i) => (
              <div key={brand} style={{ borderBottom: i === brands.length - 1 ? 'none' : '1px solid #e3e8ee' }}>
                <ListRow
                  primary={brand}
                  chevron
                  onClick={() => selectMake(brand)}
                />
              </div>
            ))}
          </ListCard>
        )
      )}

      {/* Step 2 — Vehicles */}
      {step === 2 && (
        loading ? <LoadingView /> : vehicles.length === 0 ? <EmptyView message="No vehicles found" /> : (
          <ListCard>
            {vehicles.map((vehicle, i) => (
              <div key={vehicle} style={{ borderBottom: i === vehicles.length - 1 ? 'none' : '1px solid #e3e8ee' }}>
                <ListRow
                  primary={vehicle}
                  chevron
                  onClick={() => selectVehicle(vehicle)}
                />
              </div>
            ))}
          </ListCard>
        )
      )}

      {/* Step 3 — Categories */}
      {step === 3 && (
        loading ? <LoadingView /> : categories.length === 0 ? <EmptyView message="No categories found" /> : (
          <ListCard>
            {categories.map((cat, i) => (
              <div key={cat.name} style={{ borderBottom: i === categories.length - 1 ? 'none' : '1px solid #e3e8ee' }}>
                <ListRow
                  primary={cat.name}
                  badge={cat.count}
                  chevron
                  onClick={() => selectCategory(cat.name)}
                />
              </div>
            ))}
          </ListCard>
        )
      )}

      {/* Step 4 — Parts */}
      {step === 4 && (
        loading ? <LoadingView /> : parts.length === 0 ? <EmptyView message="No parts found" /> : (
          <ListCard>
            {parts.map((part, i) => {
              const priceStr = fmtPrice(part)
              return (
                <div key={part.id} style={{ borderBottom: i === parts.length - 1 ? 'none' : '1px solid #e3e8ee' }}>
                  <ListRow
                    primary={part.part_name}
                    secondary={part.notes || null}
                    price={priceStr || 'TBC'}
                  />
                </div>
              )
            })}
          </ListCard>
        )
      )}

      {modal && (
        <PartModal
          part={modal.part}
          mode={modal.mode}
          makes={makesForModal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

    </div>
  )
}
