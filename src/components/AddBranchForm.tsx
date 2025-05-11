// src/components/AddBranchForm.tsx
import React, { useState, useEffect } from 'react'; // useEffect hook'unu import et
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'; // doc, updateDoc importları eklendi
import type { Branch } from './BranchList.tsx'; // Branch interface'ini import et
import './AddBranchForm.css'; // CSS dosyası

interface AddBranchFormProps {
  onBranchAdded: () => void; // Branş eklendiğinde çağrılacak fonksiyon
  onBranchUpdated: () => void; // Branş güncellendiğinde çağrılacak fonksiyon
  editingBranch: Branch | null; // Düzenlenmekte olan branş (null ise yeni ekleme)
}

const AddBranchForm: React.FC<AddBranchFormProps> = ({ onBranchAdded, onBranchUpdated, editingBranch }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // editingBranch prop'u değiştiğinde formu doldur
  useEffect(() => {
    if (editingBranch) {
      setName(editingBranch.name);
      setDescription(editingBranch.description || ''); // Açıklama yoksa boş string yap
    } else {
      // Yeni ekleme moduna geçince formu temizle
      setName('');
      setDescription('');
    }
    setError(null); // Form değiştiğinde hataları temizle
  }, [editingBranch]); // editingBranch değiştiğinde bu effect çalışır

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim()) {
        setError('Branş adı boş olamaz.');
        setLoading(false);
        return;
    }

    const branchData = {
        name: name.trim(),
        description: description.trim(),
    };

    try {
      if (editingBranch) {
        // Branşı güncelle
        const branchDocRef = doc(db, 'branches', editingBranch.id);
        await updateDoc(branchDocRef, branchData); // updateDoc kullan
        console.log('Branş güncellendi:', editingBranch.id);
        onBranchUpdated(); // Güncelleme başarılı olunca callback çağır
      } else {
        // Yeni branş ekle
        await addDoc(collection(db, 'branches'), {
          ...branchData,
          createdAt: serverTimestamp(), // Sunucu zaman damgası kullan
        });
        console.log('Yeni branş eklendi');
        onBranchAdded(); // Ekleme başarılı olunca callback çağır
      }

      // Formu temizle (ekleme moduna dönerse)
      if (!editingBranch) {
          setName('');
          setDescription('');
      } // Düzenleme bitince form BranchManagement tarafından gizlenecek

    } catch (error: any) {
      console.error(editingBranch ? 'Branş güncelleme hatası:' : 'Branş ekleme hatası:', error);
      setError((editingBranch ? 'Branş güncellenirken bir hata oluştu: ' : 'Branş eklenirken bir hata oluştu: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="branchName">Branş Adı:</label>
        <input
          type="text"
          id="branchName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="branchDescription">Açıklama (İsteğe bağlı):</label>
        <textarea
          id="branchDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        ></textarea>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? (editingBranch ? 'Güncelleniyor...' : 'Ekleniyor...') : (editingBranch ? 'Güncelle' : 'Kaydet')}
      </button>
    </form>
  );
};

export default AddBranchForm;
