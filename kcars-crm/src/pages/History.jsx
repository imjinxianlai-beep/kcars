import { useState } from 'react'
import { supabase } from '../lib/supabase'
import '../handover.css'
const money=n=>new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD'}).format(Number(n||0))
export default function History() {
  const [query,setQuery]=useState(''),[results,setResults]=useState([]),[invoices,setInvoices]=useState([]),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [searched,setSearched]=useState(false),[more,setMore]=useState(false)
  const search=async event=>{
    event.preventDefault();const q=query.trim().replace(/[%_,().]/g,' ')
    if(q.length<2){setError('请输入至少两个字符');return}
    setBusy(true);setError('');setSelected(null);setInvoices([])
    try{
      const [v,c]=await Promise.all([
        supabase.from('vehicles').select('id,car_plate,car_make,car_model,customer_id,customers(name,car_plate)').ilike('car_plate',`%${q}%`).limit(50),
        supabase.from('customers').select('id,name,car_plate,car_make,car_model').or(`name.ilike.%${q}%,car_plate.ilike.%${q}%`).limit(50)
      ])
      if(v.error||c.error)throw v.error||c.error
      const hits=(v.data||[]).map(x=>({...x,name:x.customers?.name,kind:'vehicle'}))
      for(const x of c.data||[]) hits.push({...x,customer_id:x.id,kind:'customer'})
      setResults(hits);setSearched(true)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const load=async(item,offset=0)=>{
    setBusy(true);setError('')
    try{
      let req=supabase.from('invoices').select('id,invoice_no,date,total,status,advisor,mechanic,voided_at,vehicles(car_plate),invoice_items(*)').order('date',{ascending:false}).order('id').range(offset,offset+49)
      const normalize=plate=>String(plate||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
      if(item.kind==='vehicle') {
        // Legacy invoices can have no vehicle_id. Include them only when the
        // customer's recorded plate matches this vehicle, never another car.
        req=normalize(item.customers?.car_plate)===normalize(item.car_plate)
          ?req.or(`vehicle_id.eq.${item.id},and(vehicle_id.is.null,customer_id.eq.${item.customer_id})`)
          :req.eq('vehicle_id',item.id)
      } else req=req.eq('customer_id',item.customer_id)
      const {data,error}=await req;if(error)throw error
      setSelected(item);setInvoices(prev=>offset?[...prev,...data]:data);setMore(data.length===50)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="handover-page"><header className="handover-header"><div><p className="eyebrow">K-CARS AUTO CENTRE</p><h1>维修记录查询</h1><p>按车牌或客户姓名查找车辆和历史发票。</p></div><span className="role-pill">只读查询</span></header>
    <form className="history-search handover-card" onSubmit={search}><label htmlFor="history-query">车牌或客户姓名</label><div><input id="history-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如 SBW25J" autoComplete="off"/><button className="btn btn-primary" disabled={busy}>{busy?'查询中…':'查询'}</button></div></form>
    {error&&<div role="alert" className="import-message error">{error}</div>}
    {searched&&!results.length&&!busy&&<div className="handover-card">没有找到匹配记录，请检查车牌或姓名。</div>}
    {results.length>0&&<div className="history-layout"><section className="handover-card"><h2>查询结果</h2><p className="muted">显示最多 100 个匹配结果，可输入完整车牌缩小范围。</p><div className="batch-list">{results.map(x=><button key={x.kind+x.id} disabled={busy} onClick={()=>load(x)} aria-pressed={selected?.id===x.id}><span><strong>{x.kind==='customer'?`${x.name} · 全部车辆`:x.car_plate}</strong><small>{x.name} · {x.car_make} {x.car_model}</small></span></button>)}</div></section>
    <section className="handover-card"><h2>{selected?`${selected.car_plate||selected.name} 的历史记录`:'选择车辆查看记录'}</h2>{selected&&!invoices.length&&!busy&&<p className="muted">暂无关联发票。</p>}{invoices.map(i=><details className="invoice-history" key={i.id}><summary><span><strong>{i.invoice_no}</strong><small>{i.date} · {i.vehicles?.car_plate||selected.car_plate} · {i.voided_at?'已作废':i.status==='paid'?'已付款':i.status}</small></span><strong>{money(i.total)}</strong></summary><p className="muted">顾问：{i.advisor||'未记录'}　技师：{i.mechanic||'未记录'}</p><div className="handover-table-wrap"><table className="handover-table"><thead><tr><th>项目</th><th>数量</th><th>金额</th></tr></thead><tbody>{[...i.invoice_items].sort((a,b)=>a.sort_order-b.sort_order).map(l=><tr key={l.id}><td>{l.description}</td><td>{l.qty??'—'}</td><td>{money(l.amount)}</td></tr>)}</tbody></table></div></details>)}{more&&<button className="btn btn-ghost" disabled={busy} onClick={()=>load(selected,invoices.length)}>加载更多记录</button>}</section></div>}
  </div>
}
