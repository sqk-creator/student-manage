import React, { useState } from 'react';
import { api } from '../../services/api';

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await api.login('test');
      api.setToken(data.token);
      onLogin(data.token);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',
      background:'linear-gradient(135deg,#001529 0%,#002140 100%)'
    }}>
      <div style={{
        background:'#fff',borderRadius:12,padding:'48px 40px',width:400,
        boxShadow:'0 8px 40px rgba(0,0,0,0.12)',textAlign:'center'
      }}>
        <div style={{fontSize:40,marginBottom:12}}>◆</div>
        <h1 style={{fontSize:22,fontWeight:700,color:'#262626',marginBottom:4}}>学生管理系统</h1>
        <p style={{fontSize:13,color:'#999',marginBottom:32}}>管理后台</p>
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width:'100%',height:44,border:'none',borderRadius:6,
            background:loading?'#91caff':'#1890ff',color:'#fff',
            fontSize:16,cursor:loading?'not-allowed':'pointer'
          }}
        >
          {loading ? '登录中...' : '教师登录'}
        </button>
      </div>
    </div>
  );
}
