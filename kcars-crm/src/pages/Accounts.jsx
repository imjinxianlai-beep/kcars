import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { rpc } from '../lib/importClient'
export default function Accounts(){
  const [users,setUsers]=useState([]),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const load=async()=>{const {data,error}=await supabase.from('crm_members').select('user_id,username,role,enabled,created_at').order('created_at');if(error)throw error;setUsers(data)}
  useEffect(()=>{load().catch(e=>setError(e.message))},[])
  const run=async fn=>{setBusy(true);setError('');setNotice('');try{await fn();await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const create=e=>{e.preventDefault();run(async()=>{
    const {data,error}=await supabase.functions.invoke('crm-account',{body:{username:username.trim(),password}})
    if(error||data?.error)throw new Error(data?.error||'账号创建失败。请确认账号管理服务已部署，并稍后重试。')
    setPassword('');setUsername('');setNotice('同事账号已创建，仅有查询和导入权限。')
  })}
  return <div className="handover-page"><header className="handover-header"><div><p className="eyebrow">ADMINISTRATION</p><h1>账号管理</h1><p>为同事创建独立账号，或随时停止其访问权限。</p></div></header>
    {error&&<div className="import-message error" role="alert">{error}</div>}{notice&&<div className="import-message" role="status">{notice}</div>}
    <section className="handover-card"><h2>创建同事账号</h2><form className="accounts-form" onSubmit={create}><label>用户名<input value={username} onChange={e=>setUsername(e.target.value)} required pattern="[A-Za-z0-9_]{3,32}" autoComplete="off" placeholder="3–32 位字母、数字或下划线"/></label><label>初始密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label><p className="muted">权限固定为查询和导入，不提供系统配置、修改历史记录或管理账号的权限。</p><button className="btn btn-primary" disabled={busy}>{busy?'处理中…':'创建同事账号'}</button></form></section>
    <section className="handover-card"><h2>现有账号</h2><div className="handover-table-wrap"><table className="handover-table"><thead><tr><th>用户名</th><th>权限</th><th>状态</th><th>操作</th></tr></thead><tbody>{users.map(u=><tr key={u.user_id}><td>{u.username}</td><td>{u.role==='admin'?'管理员':'查询和导入'}</td><td>{u.enabled?'启用':'停用'}</td><td>{u.role==='operator'&&<button className="btn btn-ghost" disabled={busy} onClick={()=>run(()=>rpc('crm_set_member',{p_user:u.user_id,p_enabled:!u.enabled}))}>{u.enabled?'停用账号':'重新启用'}</button>}</td></tr>)}</tbody></table></div></section>
  </div>
}
