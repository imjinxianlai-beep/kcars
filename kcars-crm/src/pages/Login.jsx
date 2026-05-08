import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
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
            <label>Email 邮箱</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required autoComplete="email" />
          </div>
          <div className="form-row">
            <label>Password 密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
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
