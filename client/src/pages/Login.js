import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, register, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('register'); // start on register tab
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/');
      } else if (mode === 'register') {
        await register(form.name, form.email, form.password);
        navigate('/');
      } else if (mode === 'otp') {
        if (step === 1) {
          await sendOtp(form.email);
          setStep(2);
          setSuccess('OTP sent to your email!');
        } else {
          await verifyOtp(form.email, form.otp);
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>📹</span>
          <h1 style={styles.logoText}>SmartMeet</h1>
          <p style={styles.logoSub}>Video meetings for everyone</p>
        </div>
        <div style={styles.tabs}>
          {[
            { key: 'register', label: '✏️ Register' },
            { key: 'login', label: '🔑 Login' },
            { key: 'otp', label: '📱 OTP' },
          ].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setStep(1); setError(''); setSuccess(''); }}
              style={{ ...styles.tab, ...(mode === m.key ? styles.activeTab : {}) }}>
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form} autoComplete="on">
          {/* Hidden username field for accessibility */}
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }}
            value={form.email} onChange={e => set('email', e.target.value)} readOnly />

          {mode === 'register' && (
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>👤</span>
              <input style={styles.input} placeholder="Full Name" value={form.name}
                autoComplete="name" onChange={e => set('name', e.target.value)} required />
            </div>
          )}

          {(mode !== 'otp' || step === 1) && (
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>📧</span>
              <input style={styles.input} type="email" placeholder="Email address" value={form.email}
                autoComplete="email" onChange={e => set('email', e.target.value)} required />
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔒</span>
              <input style={styles.input} type="password" placeholder="Password"
                value={form.password} onChange={e => set('password', e.target.value)} required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            </div>
          )}

          {mode === 'otp' && step === 2 && (
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔢</span>
              <input style={styles.input} placeholder="Enter 6-digit OTP" value={form.otp}
                onChange={e => set('otp', e.target.value)} required maxLength={6}
                autoComplete="one-time-code" />
            </div>
          )}

          {error && <div style={styles.error}>⚠️ {error}</div>}
          {success && <div style={styles.successMsg}>✅ {success}</div>}

          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Please wait...' :
              mode === 'otp' ? (step === 1 ? '📨 Send OTP' : '✅ Verify OTP') :
              mode === 'login' ? '🔑 Sign In' : '✏️ Create Account'}
          </button>

          {mode === 'login' && (
            <p style={styles.hint}>Don't have an account?
              <button type="button" style={styles.linkBtn}
                onClick={() => { setMode('register'); setError(''); }}>Register here</button>
            </p>
          )}
          {mode === 'register' && (
            <p style={styles.hint}>Already have an account?
              <button type="button" style={styles.linkBtn}
                onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', padding: 16 },
  card: { background: '#fff', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  logo: { textAlign: 'center', marginBottom: 24 },
  logoIcon: { fontSize: 44 },
  logoText: { margin: '8px 0 4px', fontSize: 26, fontWeight: 700, color: '#1a73e8' },
  logoSub: { margin: 0, fontSize: 13, color: '#888' },
  tabs: { display: 'flex', marginBottom: 24, borderRadius: 10, overflow: 'hidden', border: '1px solid #e0e0e0' },
  tab: { flex: 1, padding: '10px 4px', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#666' },
  activeTab: { background: '#1a73e8', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden', background: '#fafafa' },
  inputIcon: { padding: '0 12px', fontSize: 16 },
  input: { flex: 1, padding: '12px 12px 12px 0', border: 'none', background: 'transparent', fontSize: 14, outline: 'none' },
  error: { background: '#fdecea', color: '#d32f2f', fontSize: 13, padding: '10px 12px', borderRadius: 8 },
  successMsg: { background: '#e8f5e9', color: '#2e7d32', fontSize: 13, padding: '10px 12px', borderRadius: 8 },
  btn: { padding: '13px', borderRadius: 10, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  hint: { textAlign: 'center', fontSize: 13, color: '#888', margin: 0 },
  linkBtn: { background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 4 },
};

export default Login;
