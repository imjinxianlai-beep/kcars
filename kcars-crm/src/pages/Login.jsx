import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { loginEmail } from '../lib/loginIdentity'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      loginEmail(email) // Validate username syntax; retain old owner email login during rollout.
      if(email.includes('@')) {
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
        if(error)throw new Error('用户名或密码不正确，或暂时无法登录。请重试。')
      } else {
        const {data,error}=await supabase.functions.invoke('crm-login',{body:{username:email.trim(),password}})
        if(error||data?.error) {
          let message=data?.error
          try {message=message||(await error?.context?.json())?.error}catch{}
          throw new Error(message||'暂时无法登录，请重试或联系管理员。')
        }
        const {error:sessionError}=await supabase.auth.setSession(data)
        if(sessionError)throw new Error('无法保存登录状态，请重试')
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#111', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32,
        width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.png" alt="K-Cars Auto Centre"
            style={{ height: 70, width: 'auto', objectFit: 'contain', marginBottom: 12,
               }} />
          <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>CRM System 管理系统</div>
        </div>

        <form onSubmit={login}>
          <div className="form-row">
            <label htmlFor="login-username">Username 用户名</label>
            <input id="login-username" type="text" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="输入用户名" required autoComplete="username" autoCapitalize="none" />
          </div>
          <div className="form-row">
            <label htmlFor="login-password">Password 密码</label>
            <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4 }}
            disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In 登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
