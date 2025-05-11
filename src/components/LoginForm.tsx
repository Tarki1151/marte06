// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import { signInWithEmailAndPassword } from 'firebase/auth'; // Giriş fonksiyonunu import et
// import './LoginForm.css'; // CSS dosyasını import et - KALDIRILDI

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // Hata mesajı için state
  const [loading, setLoading] = useState(false); // Loading state'i eklendi

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Önceki hataları temizle
    setLoading(true); // Giriş yapılırken loading true yap

    try {
      // Firebase Authentication ile giriş yap
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Giriş başarılı:', userCredential.user);
      // Başarılı giriş sonrası yönlendirme veya state güncelleme buraya gelecek
    } catch (error: any) {
      console.error('Giriş hatası:', error.message);
      setError(error.message); // Hata mesajını state'e kaydet
    } finally {
      setLoading(false); // İşlem bitince (başarılı veya hatalı) loading false yap
    }
  };

  return (
    <div className="login-form"> {/* Yeni eklenen div ve class */} 
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Şifre:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
