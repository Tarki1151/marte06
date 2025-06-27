// src/components/BottomNavBar.tsx
import React, { useState } from 'react'; // useState hook'unu import et
import { Link, useNavigate } from 'react-router-dom';
import './BottomNavBar.css';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import ConfirmModal from './ConfirmModal'; // ConfirmModal bileşenini import et

const BottomNavBar: React.FC = () => {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false); // Modal görünürlük state'i

  // Çıkış yapma işlemini başlatan fonksiyon (modali açar)
  const handleLogoutClick = () => {
    setShowLogoutModal(true); // Modali göster
  };

  // Modal üzerinde evet tıklandığında çıkış işlemini yapan fonksiyon
  const handleConfirmLogout = async () => {
    setShowLogoutModal(false); // Modali kapat
    try {
      await signOut(auth);
      console.log('Çıkış başarılı!');
      navigate('/login');
    } catch (error: any) {
      console.error('Çıkış hatası:', error.message);
      alert('Çıkış yapılırken bir hata oluştu: ' + error.message);
    }
  };

  // Modal üzerinde hayır tıklandığında veya kapatıldığında modali kapatan fonksiyon
  const handleCancelLogout = () => {
    setShowLogoutModal(false); // Modali kapat
  };

  return (
    <>
      <nav className="bottom-nav-bar">
        <Link to="/members" className="nav-link">
          <i className="nav-icon">👥</i>
          <span>Üyeler</span>
        </Link>
        <Link to="/packages" className="nav-link">
          <i className="nav-icon">📦</i>
          <span>Paketler</span>
        </Link>
        <Link to="/calendar" className="nav-link">
          <i className="nav-icon">📅</i>
          <span>Takvim</span>
        </Link>
        <Link to="/reports" className="nav-link">
          <i className="nav-icon">📊</i>
          <span>Raporlar</span>
        </Link>

        {/* Çıkış Yap butonu - Modali açar */}
        <button onClick={handleLogoutClick} className="nav-link logout-link-button">
          <i className="nav-icon">🚪</i>
          <span>Çıkış</span>
        </button>
      </nav>

      {/* Onay Modali */}
      <ConfirmModal
        message="Çıkış yapmak istediğinizden emin misiniz?"
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
        isVisible={showLogoutModal}
      />
    </>
  );
};

export default BottomNavBar;
