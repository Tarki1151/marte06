// src/pages/Login.tsx
import React from 'react';
import LoginForm from '../components/LoginForm'; // LoginForm'u import ettik
import './Login.css'; // İsteğe bağlı CSS
import logo from '/images/logo.png'; // Logoyu import et

const Login: React.FC = () => {
  return (
    <div className="login-page"> {/* Ana konteyner */}
      <img src={logo} alt="Spor Salonu Logo" className="login-logo" /> {/* Logo eklendi */}
      <h2>Yönetici Girişi</h2>
      <LoginForm /> {/* LoginForm bileşenini kullandık */}
    </div>
  );
};

export default Login;
