import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;background:#fafafa"><div style="font-size:32px">⚠️</div><div style="font-size:16px;font-weight:700;color:#111">Missing Supabase configuration</div><div style="font-size:13px;color:#666">Create a <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">.env</code> file in the project root with:<br><br><code style="background:#f3f4f6;padding:8px 12px;border-radius:6px;display:block;margin-top:4px">VITE_SUPABASE_URL=...<br>VITE_SUPABASE_ANON_KEY=...</code></div></div>`
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ── Customers ──────────────────────────────────────────
export const getCustomers = (from = 0, to = 999) =>
  supabase.from('customers')
    .select('*, vehicles(id, car_plate, car_make, car_model, car_year, is_primary)', { count: 'exact' })
    .order('updated_at', { ascending: false }).range(from, to)

export const getTotalCustomers = () =>
  supabase.from('customers').select('*', { count: 'exact', head: true })

export const searchCustomers = (q) =>
  supabase.from('customers')
    .select('*, vehicles(id, car_plate, car_make, car_model, car_year, is_primary)')
    .or(`name.ilike.%${q}%,car_plate.ilike.%${q}%,car_model.ilike.%${q}%,car_make.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(100)

export const getCustomer = (id) =>
  supabase.from('customers').select('*').eq('id', id).single()

export const getCustomerByPlate = (plate) =>
  supabase.from('customers').select('*').ilike('car_plate', plate.trim()).maybeSingle()

export const upsertCustomer = (data) =>
  supabase.from('customers').upsert(data, { onConflict: 'car_plate' }).select().single()

export const updateCustomerTags = (id, tags) =>
  supabase.from('customers').update({ tags }).eq('id', id).select().single()

export const deleteCustomer = (id) =>
  supabase.from('customers').delete().eq('id', id)

// ── Invoices ───────────────────────────────────────────
export const getInvoices = (customerId) =>
  supabase.from('invoices').select(`*, invoice_items(*)`)
    .eq('customer_id', customerId)
    .order('date', { ascending: false })

export const getInvoice = (id) =>
  supabase.from('invoices').select(`*, invoice_items(*), customers(*)`)
    .eq('id', id).single()

export const createInvoice = async (invoice, items) => {
  const { data: inv, error } = await supabase
    .from('invoices').insert(invoice).select().single()
  if (error) throw error
  if (items?.length) {
    const rows = items.map((it, i) => ({ ...it, invoice_id: inv.id, sort_order: i }))
    const { error: ie } = await supabase.from('invoice_items').insert(rows)
    if (ie) throw ie
  }
  return inv
}

export const updateInvoice = async (id, invoice, items) => {
  const { error } = await supabase.from('invoices').update(invoice).eq('id', id)
  if (error) throw error
  await supabase.from('invoice_items').delete().eq('invoice_id', id)
  if (items?.length) {
    const rows = items.map((it, i) => ({ ...it, invoice_id: id, sort_order: i }))
    await supabase.from('invoice_items').insert(rows)
  }
}

export const updateInvoiceStatus = (id, status) =>
  supabase.from('invoices').update({ status }).eq('id', id)

export const deleteInvoice = (id) =>
  supabase.from('invoices').delete().eq('id', id)

// Auto-generate invoice number
export const generateInvoiceNo = async () => {
  const prefix = 'INV' + new Date().getFullYear().toString().slice(2)
  const { count } = await supabase.from('invoices')
    .select('*', { count: 'exact', head: true })
    .ilike('invoice_no', `${prefix}%`)
  return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`
}

// ── Customer Activities (Timeline) ────────────────────
export const getActivities = (customerId) =>
  supabase.from('customer_activities').select('*')
    .eq('customer_id', customerId).order('created_at', { ascending: false })

export const addActivity = (data) =>
  supabase.from('customer_activities').insert(data).select().single()

export const deleteActivity = (id) =>
  supabase.from('customer_activities').delete().eq('id', id)

// ── Customer Notes ─────────────────────────────────────
export const getNotes = (customerId) =>
  supabase.from('customer_notes').select('*')
    .eq('customer_id', customerId).order('created_at', { ascending: false })

export const addNote = (data) =>
  supabase.from('customer_notes').insert(data).select().single()

export const updateNote = (id, content) =>
  supabase.from('customer_notes').update({ content }).eq('id', id)

export const deleteNote = (id) =>
  supabase.from('customer_notes').delete().eq('id', id)

// ── Customer Tasks ─────────────────────────────────────
export const getTasks = (customerId) =>
  supabase.from('customer_tasks').select('*')
    .eq('customer_id', customerId).order('completed').order('due_date', { ascending: true, nullsFirst: false })

export const addTask = (data) =>
  supabase.from('customer_tasks').insert(data).select().single()

export const updateTask = (id, data) =>
  supabase.from('customer_tasks').update(data).eq('id', id)

export const deleteTask = (id) =>
  supabase.from('customer_tasks').delete().eq('id', id)

// ── Service Catalog ────────────────────────────────────
export const getCatalog = () =>
  supabase.from('service_catalog').select('*')
    .eq('active', true).order('category').order('sort_order')

export const addCatalogItem = (item) =>
  supabase.from('service_catalog').insert(item).select().single()

export const updateCatalogItem = (id, data) =>
  supabase.from('service_catalog').update(data).eq('id', id)

export const deleteCatalogItem = (id) =>
  supabase.from('service_catalog').delete().eq('id', id)

// ── Vehicles ───────────────────────────────────────────
export const getVehicles = (customerId) =>
  supabase.from('vehicles').select('*')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

export const addVehicle = (data) =>
  supabase.from('vehicles').insert(data).select().single()

export const updateVehicle = (id, data) =>
  supabase.from('vehicles').update(data).eq('id', id).select().single()

export const deleteVehicle = (id) =>
  supabase.from('vehicles').delete().eq('id', id)

export const setPrimaryVehicle = async (vehicleId, customerId) => {
  await supabase.from('vehicles').update({ is_primary: false }).eq('customer_id', customerId)
  return supabase.from('vehicles').update({ is_primary: true }).eq('id', vehicleId).select().single()
}

// ── Parts Library ──────────────────────────────────────
export const getParts = ({ category } = {}) => {
  let q = supabase.from('parts_library').select('*').order('category').order('part_name')
  if (category) q = q.eq('category', category)
  return q
}

export const searchParts = (query) =>
  supabase.from('parts_library').select('*')
    .or(`part_name.ilike.%${query}%,vehicle_text.ilike.%${query}%,brand.ilike.%${query}%,vehicle_model.ilike.%${query}%`)
    .order('category').order('part_name').limit(50)

export const addPart = (data) =>
  supabase.from('parts_library').insert(data).select().single()

export const updatePart = (id, data) =>
  supabase.from('parts_library').update(data).eq('id', id).select().single()

export const deletePart = (id) =>
  supabase.from('parts_library').delete().eq('id', id)
