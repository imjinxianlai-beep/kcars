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
        fontSize: 17,
        fontWeight: 400,
        color: 'var(--orange)',
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.374px',
        lineHeight: 1,
      }}
    >
      {'‹ '}{label}
    </button>
  )
}

// ── StepHeader ────────────────────────────────────────────────────────────────

function StepHeader({ title, backLabel, onBack, onAdd }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: 'rgba(245,245,247,0.85)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: '1px solid #e0e0e0',
      minHeight: 44,
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* Left — back button */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        {backLabel && onBack && (
          <BackBtn label={backLabel} onClick={onBack} />
        )}
      </div>

      {/* Center — title */}
      <div style={{
        fontSize: 17,
        fontWeight: 600,
        color: '#1d1d1f',
        letterSpacing: '-0.374px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '40%',
        textAlign: 'center',
      }}>
        {title}
      </div>

      {/* Right — add button */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={onAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            padding: '6px 12px',
            flexShrink: 0,
          }}
        >
          <Plus size={12} /> Add Part
        </button>
      </div>
    </div>
  )
}

// ── PageSubtitle ──────────────────────────────────────────────────────────────

function PageSubtitle({ text }) {
  if (!text) return null
  return (
    <div style={{
      fontSize: 13,
      color: '#6e6e73',
      padding: '12px 32px 4px',
      letterSpacing: '-0.08px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
    }}>
      {text}
    </div>
  )
}

// ── ListCard ──────────────────────────────────────────────────────────────────

function ListCard({ children }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 18,
      border: '1px solid #e0e0e0',
      overflow: 'hidden',
      margin: '0 16px 24px',
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
        padding: '12px 16px',
        minHeight: 44,
        background: hovered ? '#f5f5f7' : '#ffffff',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 17,
          fontWeight: 400,
          color: '#1d1d1f',
          letterSpacing: '-0.374px',
          lineHeight: 1.35,
        }}>
          {primary}
        </div>
        {secondary && (
          <div style={{
            fontSize: 14,
            fontWeight: 400,
            color: '#6e6e73',
            letterSpacing: '-0.224px',
            marginTop: 2,
            lineHeight: 1.3,
          }}>
            {secondary}
          </div>
        )}
      </div>

      {badge != null && (
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          padding: '1px 7px',
          borderRadius: 9999,
          background: 'rgba(210,210,215,0.64)',
          color: '#1d1d1f',
          marginLeft: 8,
          flexShrink: 0,
          fontFamily: 'inherit',
        }}>
          {badge}
        </span>
      )}

      {price != null && (
        price === 'TBC' ? (
          <span style={{
            fontSize: 14,
            fontWeight: 400,
            color: '#6e6e73',
            marginLeft: 12,
            flexShrink: 0,
          }}>
            TBC
          </span>
        ) : (
          <span style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--orange)',
            fontFeatureSettings: '"tnum"',
            letterSpacing: '-0.374px',
            marginLeft: 12,
            flexShrink: 0,
          }}>
            {price}
          </span>
        )
      )}

      {chevron && (
        <span style={{
          color: '#c7c7cc',
          fontSize: 20,
          marginLeft: 8,
          flexShrink: 0,
          lineHeight: 1,
        }}>
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
    <div style={{
      textAlign: 'center',
      padding: '56px 24px',
      color: '#6e6e73',
      fontSize: 14,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      letterSpacing: '-0.224px',
    }}>
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
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    fontSize: 15,
    color: '#1d1d1f',
    outline: 'none',
    background: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
    letterSpacing: '-0.224px',
  }

  const labelStyle = {
    fontSize: 13,
    fontWeight: 400,
    color: '#6e6e73',
    letterSpacing: '-0.08px',
    marginBottom: 5,
    display: 'block',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  }

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-head">
          <h3 style={{
            fontSize: 17,
            fontWeight: 600,
            color: '#1d1d1f',
            letterSpacing: '-0.374px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
          }}>
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
  const [step, setStep]                         = useState(1)
  const [selectedMake, setSelectedMake]         = useState(null)
  const [selectedVehicle, setSelectedVehicle]   = useState(null)
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

  const makesForModal = brands.length > 0 ? brands : []

  return (
    <div style={{
      background: '#f5f5f7',
      height: '100%',
      overflow: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
    }}>

      <StepHeader
        title={headerProps.title}
        backLabel={headerProps.backLabel}
        onBack={headerProps.onBack}
        onAdd={() => setModal({ mode: 'add', part: null })}
      />

      <PageSubtitle text={headerProps.subtitle} />

      {/* Step 1 — Brands */}
      {step === 1 && (
        loading ? <LoadingView /> : brands.length === 0 ? <EmptyView message="No brands found" /> : (
          <ListCard>
            {brands.map((brand, i) => (
              <div key={brand} style={{ borderBottom: i < brands.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
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
              <div key={vehicle} style={{ borderBottom: i < vehicles.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
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
              <div key={cat.name} style={{ borderBottom: i < categories.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
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
                <div key={part.id} style={{ borderBottom: i < parts.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
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
