// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './utils/AuthContext.tsx';
import Login from './pages/Login.tsx';
import MemberManagement from './pages/MemberManagement.tsx';
import PackageManagement from './pages/PackageManagement.tsx'; // Yeni sayfa importu
import BranchManagement from './pages/BranchManagement.tsx'; // Yeni sayfa importu
import CalendarManagement from './pages/CalendarManagement.tsx'; // Yeni sayfa importu
import Reports from './pages/Reports.tsx'; // Yeni sayfa importu
import BottomNavBar from './components/BottomNavBar.tsx';
// import './App.css'; // KALDIRILDI

function App() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="App"> {/* Ana konteyner */}
      <Routes>
        {/* Login Sayfası */}
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/members" /> : <Login />}
        />

        {/* Üye Yönetimi Sayfası - Korumalı Rota */}
        <Route
          path="/members"
          element={currentUser ? <MemberManagement /> : <Navigate to="/login" />}
        />

        {/* Paket Yönetimi Sayfası - Korumalı Rota */}
        <Route
          path="/packages"
          element={currentUser ? <PackageManagement /> : <Navigate to="/login" />}
        />

        {/* Branş Yönetimi Sayfası - Korumalı Rota */}
        <Route
          path="/branches"
          element={currentUser ? <BranchManagement /> : <Navigate to="/login" />}
        />

        {/* Takvim Yönetimi Sayfası - Korumalı Rota */}
        <Route
          path="/calendar"
          element={currentUser ? <CalendarManagement /> : <Navigate to="/login" />}
        />

        {/* Raporlama Sayfası - Korumalı Rota */}
        <Route
          path="/reports"
          element={currentUser ? <Reports /> : <Navigate to="/login" />}
        />

        {/* Ana Rota - Giriş durumuna göre yönlendirme */}
        <Route
          path="/"
          element={currentUser ? <Navigate to="/members" /> : <Navigate to="/login" />}
        />

        {/* Tanımlanmayan rotalar için 404 sayfası veya başka bir yönlendirme eklenebilir */}
        {/* <Route path="*" element={<div>Sayfa Bulunamadı</div>} /> */}

      </Routes>

      {/* current user varsa navigasyon barı göster */}
      {currentUser && (
        <BottomNavBar />
      )}
    </div>
  );
}

export default App;
