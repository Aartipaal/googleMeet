import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, register, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | register | otp
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
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
        </div>
        <div style={styles.tabs}>
          {['login', 'register', 'otp'].map(m => (
            <button key={m} onClick={() => { setMode(m); setStep(1); setError(''); }}
              style={{ ...styles.tab, ...(mode === m ? styles.activeTab : {}) }}>
              {m === 'otp' ? 'OTP Login' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <input style={styles.input} placeholder="Full Name" value={form.name}
              onChange={e => set('name', e.target.value)} required />
          )}
          {(mode !== 'otp' || step === 1) && (
            <input style={styles.input} type="email" placeholder="Email" value={form.email}
              onChange={e => set('email', e.target.value)} required />
          )}
          {(mode === 'login' || mode === 'register') && (
            <input style={styles.input} type="password" placeholder="Password" value={form.password}
              onChange={e => set('password', e.target.value)} required />
          )}
          {mode === 'otp' && step === 2 && (
            <input style={styles.input} placeholder="Enter 6-digit OTP" value={form.otp}
              onChange={e => set('otp', e.target.value)} required maxLength={6} />
          )}
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'otp' ? (step === 1 ? 'Send OTP' : 'Verify OTP') : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  logo: { textAlign: 'center', marginBottom: 24 },
  logoIcon: { fontSize: 40 },
  logoText: { margin: '8px 0 0', fontSize: 28, fontWeight: 700, color: '#1a73e8' },
  tabs: { display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0' },
  tab: { flex: 1, padding: '10px 0', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#666' },
  activeTab: { background: '#1a73e8', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  input: { padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' },
  error: { color: '#d32f2f', fontSize: 13, margin: 0 },
  btn: { padding: '13px', borderRadius: 8, border: 'none', background: '#1a73e8', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
};

export default Login;
