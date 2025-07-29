// src/components/LoginForm.tsx
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth objesini import et
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'; // Giriş fonksiyonlarını ve Google Auth sağlayıcısını import et
import { useNavigate } from 'react-router-dom';
// import './LoginForm.css'; // CSS dosyasını import et - Kaldırıldı
import googleLogo from '../images/google-logo.png'; // Google logosunu import et

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // Hata mesajı için state
  const [loading, setLoading] = useState(false); // Loading state'i eklendi
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Önceki hataları temizle
    setLoading(true); // Giriş yapılırken loading true yap

    try {
      // Firebase Authentication ile giriş yap
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Giriş başarılı:', userCredential.user);
      navigate('/members');
    } catch (error: any) {
      console.error('Giriş hatası:', error.message);
      setError(error.message); // Hata mesajını state'e kaydet
    } finally {
      setLoading(false); // İşlem bitince (başarılı veya hatalı) loading false yap
    }
  };

  const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            // This gives you a Google Access Token. You can use it to access the Google API.
            // const credential = GoogleAuthProvider.credentialFromResult(result);
            // const token = credential?.accessToken;
            console.log('Google ile giriş başarılı:', result.user);
            navigate('/members');
        } catch (error: any) {
            console.error('Google ile giriş hatası:', error.message);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };


  return (
    <div className="login-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}> {/* Ana konteyner */} 
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
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
        <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{ // Apply styles to try to match the image
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#f0f0f0',
                color: '#212121',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
            }}
        >
            {loading ? 'Google ile Giriş Yapılıyor...' : (
                <>
                    <img src={googleLogo} alt="Google Logo" style={{ height: '20px', width: '20px' }} />
                    Google ile Giriş Yap
                </>
            )}
        </button>
    </div>
  );
};

export default LoginForm;