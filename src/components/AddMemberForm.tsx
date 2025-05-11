// src/components/AddMemberForm.tsx
import React, { useState } from 'react';
import { db } from '../firebaseConfig'; // Firestore db objesini import et
import { collection, addDoc } from 'firebase/firestore'; // Firestore fonksiyonlarını import et

interface AddMemberFormProps {
  onMemberAdded: () => void; // Üye eklendiğinde çağrılacak fonksiyon
}

// Helper function to generate years for the select dropdown
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  // Assume members are born in the last 100 years, adjust as needed
  for (let i = currentYear; i >= currentYear - 100; i--) {
    years.push(i);
  }
  return years;
};

// Helper function to generate days for a given month and year
const generateDays = (year: number | '', month: number | '') => {
    if (year === '' || month === '') return [];

    // Months are 0-indexed in JavaScript Date object
    const date = new Date(year, month, 0); // Day 0 gives the last day of the previous month
    const daysInMonth = date.getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }
    return days;
};

const AddMemberForm: React.FC<AddMemberFormProps> = ({ onMemberAdded }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Doğum tarihi için gün, ay, yıl state'leri
  const [birthDay, setBirthDay] = useState<number | '' >('');
  const [birthMonth, setBirthMonth] = useState<number | '' >('');
  const [birthYear, setBirthYear] = useState<number | '' >('');

  const [parentName, setParentName] = useState(''); // Ebeveyn adı state'i
  const [parentPhone, setParentPhone] = useState(''); // Ebeveyn telefon state'i

  const [loading, setLoading] = useState(false); // Yüklenme state'i
  const [error, setError] = useState<string | null>(null); // Hata state'i

  // 18 yaşından küçük olup olmadığını kontrol et (Gün, Ay, Yıl kullanarak)
  const isMinor = (() => {
      if (birthDay === '' || birthMonth === '' || birthYear === '') return false; // Tarih tam girilmediyse küçük değildir varsay

      const today = new Date();
      const birthDate = new Date(birthYear, birthMonth - 1, birthDay); // Month is 0-indexed
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      // Eğer doğum ayı şu anki aydan büyükse veya doğum ayı şu anki ay ile aynı ama doğum günü şu anki günden büyükse henüz yaşını doldurmamıştır.
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
      }
      return age < 18;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Doğum tarihi tam girildi mi kontrol et
    if (birthDay === '' || birthMonth === '' || birthYear === '') {
        setError('Lütfen doğum tarihini tam olarak girin (Gün, Ay, Yıl).');
        setLoading(false);
        return;
    }

    // 18 yaşından küçükse ve ebeveyn bilgileri boşsa hata ver
    if (isMinor && (!parentName || !parentPhone)) {
      setError('18 yaşından küçük üyeler için ebeveyn adı ve telefon bilgileri gereklidir.');
      setLoading(false);
      return;
    }

    try {
      // Firestore'a yeni üye ekle
      const docRef = await addDoc(collection(db, 'members'), {
        name: name,
        surname: surname,
        email: email,
        phone: phone,
        // Doğum tarihini Date objesi olarak kaydet
        birthDate: new Date(birthYear, birthMonth - 1, birthDay), // Ay 0-indexed
        parentName: isMinor ? parentName : null,
        parentPhone: isMinor ? parentPhone : null,
        createdAt: new Date(),
      });
      console.log('Yeni üye eklendi, Belge ID:', docRef.id);

      // Formu temizle
      setName('');
      setSurname('');
      setEmail('');
      setPhone('');
      setBirthDay('');
      setBirthMonth('');
      setBirthYear('');
      setParentName('');
      setParentPhone('');

      onMemberAdded(); // Üye eklendiğinde callback çağır

    } catch (error: any) {
      console.error('Üye ekleme hatası:', error);
      setError('Üye eklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const years = generateYears();
  // Seçilen yıl ve aya göre günleri oluştur
  const days = generateDays(birthYear, birthMonth);
  const months = [
      { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
      { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
      { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
      { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' },
  ];


  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Ad:</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="surname">Soyad:</label>
        <input
          type="text"
          id="surname"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          required
        />
      </div>
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
        <label htmlFor="phone">Telefon:</label>
        <input
          type="tel"
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div>
        <label>Doğum Tarihi:</label>
        <div className="birthdate-selects"> {/* CSS class'ı kullanıldı */} 
          <select
            value={birthDay}
            onChange={(e) => setBirthDay(parseInt(e.target.value) || '')}
            required
          >
            <option value="">Gün</option>
            {days.map(day => <option key={day} value={day}>{day}</option>)}
          </select>

          <select
            value={birthMonth}
            onChange={(e) => setBirthMonth(parseInt(e.target.value) || '')}
            required
          >
            <option value="">Ay</option>
            {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>

          <select
            value={birthYear}
            onChange={(e) => setBirthYear(parseInt(e.target.value) || '')}
            required
          >
            <option value="">Yıl</option>
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>

      {/* 18 yaşından küçükse ebeveyn bilgileri alanlarını göster */}
      {isMinor && (
        <>
          <h4>Ebeveyn Bilgileri</h4>
          <div>
            <label htmlFor="parentName">Ebeveyn Adı Soyadı:</label>
            <input
              type="text"
              id="parentName"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required={isMinor}
            />
          </div>
          <div>
            <label htmlFor="parentPhone">Ebeveyn Telefon:</label>
            <input
              type="tel"
              id="parentPhone"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              required={isMinor}
            />
          </div>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Ekleniyor...' : 'Kaydet'}
      </button>
    </form>
  );
};

export default AddMemberForm;
