import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { rpc, uploadBatch } from '../lib/importClient'
import '../handover.css'

const money = n => new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD'}).format(Number(n || 0))
const labels = { ready:'待导入', hold:'待补资料', duplicate:'已存在，跳过', imported:'已导入', draft:'待确认', partial:'部分完成', complete:'已完成' }
export default function Imports({ profile, historyOnly = false }) {
  const [files,setFiles] = useState({}), [batches,setBatches] = useState([]), [batch,setBatch] = useState(null)
  const [entries,setEntries] = useState([]), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('')
  const [confirm,setConfirm] = useState(false), [filter,setFilter] = useState('all'), [page,setPage] = useState(0), [plates,setPlates] = useState({})
  const [events,setEvents] = useState([])
  const loadBatches = useCallback(async () => {
    const {data,error} = await supabase.from('crm_import_batches').select('*').order('created_at',{ascending:false}).limit(100)
    if(error) throw error
    setBatches(data || [])
  },[])
  const loadBatch = useCallback(async id => {
    const {data: b,error: be} = await supabase.from('crm_import_batches').select('*').eq('id',id).single()
    if(be) throw be
    const all=[]
    for(let start=0;;start+=1000) {
      const {data,error} = await supabase.from('crm_import_entries').select('id,batch_id,source,invoice_no,car_plate,status,issues,total,line_count,invoice_id,payload').eq('batch_id',id).order('invoice_no').range(start,start+999)
      if(error) throw error
      all.push(...data)
      if(data.length<1000) break
    }
    const {data: logs,error: le}=await supabase.from('crm_import_events').select('*').eq('batch_id',id).order('created_at',{ascending:false}).limit(30)
    if(le) throw le
    setBatch(b);setEntries(all);setEvents(logs || []);setPage(0);setFilter('all')
  },[])
  useEffect(()=>{loadBatches().catch(e=>setError(e.message))},[loadBatches])
  const run = async fn => {setBusy(true);setError('');setNotice('');try{await fn()}catch(e){setError(e.message || '操作失败，请重试')}finally{setBusy(false)}}
  const prepare = () => run(async()=>{const id=await uploadBatch(files);await loadBatch(id);await loadBatches();setNotice('检查完成。请核对下方数量和金额后确认导入。')})
  const commit = () => run(async()=>{
    setConfirm(false)
    try {
      const r=await rpc('crm_commit_import',{p_id:batch.id})
      setNotice(`本次成功导入 ${r.invoices} 张发票、${r.items} 条明细，共 ${money(r.total)}。${r.held ? `还有 ${r.held} 张等待补齐资料。`:''}`)
    } catch(e) {
      // A lost response is not proof of rollback: always reload the durable result.
      setError(`未收到导入成功响应：${e.message}。已重新读取批次状态；再次确认会自动跳过已导入记录。`)
    }
    await loadBatch(batch.id);await loadBatches()
  })
  const fixPlate = entry => run(async()=>{await rpc('crm_fix_import_plate',{p_entry:entry.id,p_plate:plates[entry.id] || ''});await loadBatch(batch.id);setNotice('车牌已补充，请重新核对后确认导入。')})
  const download = file => run(async()=>{
    const {data,error}=await supabase.storage.from('crm-imports').download(file.path)
    if(error) throw error
    const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  })
  const ready=entries.filter(e=>e.status==='ready'), shown=entries.filter(e=>filter==='all'||e.status===filter)
  const canEdit=batch && (profile.role==='admin'||batch.created_by===profile.user_id)
  return <div className="handover-page">
    <header className="handover-header"><div><p className="eyebrow">K-CARS AUTO CENTRE</p><h1>{historyOnly?'导入历史':'每月数据更新'}</h1><p>上传 AutoCount 导出的两份 Excel，核对后一次完成更新。</p></div><span className="role-pill">{profile.role==='admin'?'管理员':'查询与导入权限'}</span></header>
    {error&&<div className="import-message error" role="alert">{error}</div>}
    {notice&&<div className="import-message" role="status">{notice}</div>}
    {!historyOnly&&<section className="handover-card"><h2>选择本月文件</h2><p className="muted">支持 .xlsx，每份最多 5 MB。系统读取所有工作表，保留免费项目和折扣。</p>
      <div className="upload-grid">{[['kcars','K Cars'],['oneworld','1 World']].map(([key,title])=><label className="upload-slot" key={key}><strong>{title}</strong><span>{files[key]?.name || '选择 Excel 工作簿'}</span><input aria-label={`${title} Excel 文件`} type="file" accept=".xlsx" disabled={busy} onChange={e=>{setFiles(f=>({...f,[key]:e.target.files[0]}));setConfirm(false)}}/></label>)}</div>
      <button className="btn btn-primary" disabled={busy||!files.kcars||!files.oneworld} onClick={prepare}>{busy?'正在处理…':'上传并检查'}</button>
    </section>}
    {batch&&<section className="handover-card">
      <div className="section-heading"><div><h2>检查结果</h2><p className="muted">{new Date(batch.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'})} · {labels[batch.status]}</p></div><button className="btn btn-ghost" disabled={busy} onClick={()=>run(()=>loadBatch(batch.id))}>刷新结果</button></div>
      <div className="import-stats">{['ready','duplicate','hold','imported'].map(status=><button key={status} className={filter===status?'selected':''} onClick={()=>{setFilter(filter===status?'all':status);setPage(0)}}><span>{labels[status]}</span><strong>{entries.filter(e=>e.status===status).length}</strong></button>)}</div>
      <div className="import-total">待导入金额 <strong>{money(ready.reduce((a,e)=>a+Number(e.total),0))}</strong><span>{ready.reduce((a,e)=>a+e.line_count,0)} 条明细</span></div>
      <p className="muted">已有发票按原发票号跳过，不覆盖历史记录。待补资料的单据会保留在这个批次，之后可继续处理。</p>
      {canEdit&&ready.length>0&&<div className="confirm-import">{!confirm?<button className="btn btn-primary" disabled={busy} onClick={()=>setConfirm(true)}>确认导入…</button>:<><p>将新增 <strong>{ready.length}</strong> 张发票，共 <strong>{money(ready.reduce((a,e)=>a+Number(e.total),0))}</strong>，核对成功后记为已付款。</p><button className="btn btn-primary" disabled={busy} onClick={commit}>确认并导入 {ready.length} 张</button><button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirm(false)}>取消</button></>}</div>}
      <div className="handover-table-wrap"><table className="handover-table"><thead><tr><th>发票 / 来源</th><th>日期 / 客户</th><th>车牌</th><th>金额</th><th>处理状态</th></tr></thead><tbody>{shown.slice(page*40,(page+1)*40).map(e=><tr key={e.id}><td><strong>{e.invoice_no}</strong><small>{e.source==='kcars'?'K Cars':'1 World'} · {e.line_count} 条明细</small></td><td>{e.payload[0]?.date}<small>{e.payload[0]?.customer}</small></td><td>{e.car_plate||'缺少车牌'}{canEdit&&e.status==='hold'&&!e.car_plate&&<div className="plate-editor"><input aria-label={`${e.invoice_no} 车牌`} value={plates[e.id]||''} placeholder="如 SBW25J" maxLength={20} onChange={x=>setPlates(p=>({...p,[e.id]:x.target.value}))}/><button className="btn btn-ghost" disabled={busy||!plates[e.id]?.trim()} onClick={()=>fixPlate(e)}>保存</button></div>}</td><td className="numeric">{money(e.total)}</td><td><span className={`import-status ${e.status}`}>{labels[e.status]}</span>{e.issues.map((issue,i)=><small key={i}>{issue}</small>)}</td></tr>)}</tbody></table></div>
      <div className="pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>上一页</button><span>第 {page+1} 页，共 {shown.length} 张</span><button disabled={(page+1)*40>=shown.length} onClick={()=>setPage(p=>p+1)}>下一页</button></div>
      {canEdit&&<div className="original-files"><strong>原始文件</strong>{batch.files.map(f=><button className="btn btn-ghost" key={f.source} disabled={busy} onClick={()=>download(f)}>{f.name}</button>)}</div>}
      <details><summary>操作记录</summary>{events.map(e=><p className="muted" key={e.id}>{new Date(e.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'})} · {({prepared:'上传并检查',committed:'确认导入',plate_supplied:'补充车牌'})[e.action]||e.action}{e.action==='committed'?`：${e.detail.invoices} 张，${money(e.detail.total)}`:''}</p>)}</details>
    </section>}
    <section className="handover-card"><h2>最近导入记录</h2>{!batches.length?<p className="muted">还没有上传记录。原有维修历史仍可正常查询。</p>:<div className="batch-list">{batches.map(b=><button key={b.id} disabled={busy} onClick={()=>run(()=>loadBatch(b.id))}><span><strong>{new Date(b.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'})}</strong><small>{b.files.map(f=>f.name).join(' / ')}</small></span><span>{labels[b.status]}</span></button>)}</div>}</section>
  </div>
}
