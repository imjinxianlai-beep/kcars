import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ── Customers ──────────────────────────────────────────
export const getCustomers = (from = 0, to = 999) =>
  supabase.from('customers').select('*', { count: 'exact' })
    .order('updated_at', { ascending: false }).range(from, to)

export const getTotalCustomers = () =>
  supabase.from('customers').select('*', { count: 'exact', head: true })

export const searchCustomers = (q) =>
  supabase.from('customers').select('*')
    .or(`name.ilike.%${q}%,car_plate.ilike.%${q}%,car_model.ilike.%${q}%,car_make.ilike.%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(100)

export const getCustomer = (id) =>
  supabase.from('customers').select('*').eq('id', id).single()

export const getCustomerByPlate = (plate) =>
  supabase.from('customers').select('*').ilike('car_plate', plate.trim()).maybeSingle()

export const upsertCustomer = (data) =>
  supabase.from('customers').upsert(data, { onConflict: 'car_plate' }).select().single()

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
