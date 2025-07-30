// src/components/AddPackageForm.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'; // doc, updateDoc importları eklendi
import type { Package } from '../components/PackageList.tsx'; // Import Package interface
import './AddPackageForm.css'; // CSS dosyası

interface AddPackageFormProps {
  onPackageAdded: () => void;
  onPackageUpdated: () => void; // Callback after update
  editingPackage: Package | null; // Package to edit
}

const AddPackageForm: React.FC<AddPackageFormProps> = ({ onPackageAdded, onPackageUpdated, editingPackage }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | '' >('');
  const [lessonCount, setLessonCount] = useState<number | '' >('');
  const [durationDays, setDurationDays] = useState<number | '' >('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false); // loading state
  const [error, setError] = useState<string | null>(null); // error state

  // Populate form when editingPackage changes
  useEffect(() => {
    if (editingPackage) {
      setName(editingPackage.name);
      setDescription(editingPackage.description || '');
      setPrice(editingPackage.price);
      setLessonCount(editingPackage.lessonCount === null || editingPackage.lessonCount === undefined ? '' : editingPackage.lessonCount); // Handle null or undefined
      setDurationDays(editingPackage.durationDays === null || editingPackage.durationDays === undefined ? '' : editingPackage.durationDays); // Handle null or undefined
      setIsActive(editingPackage.isActive);
    } else {
      // Clear form for new package
      setName('');
      setDescription('');
      setPrice('');
      setLessonCount('');
      setDurationDays('');
      setIsActive(true);
    }
    setError(null);
  }, [editingPackage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim()) {
        setError('Paket adı boş olamaz.');
        setLoading(false);
        return;
    }
    if (price === '' || price < 0) {
      setError('Geçerli bir fiyat girin.');
      setLoading(false);
      return;
    }
    // Check lessonCount and durationDays for negative values only if they are not empty string or null
    if (lessonCount !== '' && lessonCount !== null && Number(lessonCount) < 0) { 
        setError('Ders sayısı negatif olamaz.');
        setLoading(false);
        return;
    }
    if (durationDays !== '' && durationDays !== null && Number(durationDays) < 0) { 
        setError('Süre negatif olamaz.');
        setLoading(false);
        return;
    }

    const packageData = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        lessonCount: lessonCount === '' ? null : Number(lessonCount), // Save as null if empty string
        durationDays: durationDays === '' ? null : Number(durationDays), // Save as null if empty string
        isActive: isActive,
    };

    try {
      if (editingPackage) {
        // Update package
        const packageDocRef = doc(db, 'packages', editingPackage.id);
        await updateDoc(packageDocRef, packageData);
        console.log('Paket güncellendi:', editingPackage.id);
        onPackageUpdated(); // Call update callback
      } else {
        // Add new package
        await addDoc(collection(db, 'packages'), {
          ...packageData,
          createdAt: serverTimestamp(),
        });
        console.log('Yeni paket eklendi');
        onPackageAdded(); // Call added callback
      }

      // Clear form if not in editing mode (or if editing is complete and form is hidden)
       if (!editingPackage) {
            setName('');
            setDescription('');
            setPrice('');
            setLessonCount('');
            setDurationDays('');
            setIsActive(true);
       } // else: form will be cleared/hidden by parent (PackageManagement)

    } catch (error: any) {
      console.error(editingPackage ? 'Paket güncelleme hatası:' : 'Paket ekleme hatası:', error);
      setError((editingPackage ? 'Paket güncellenirken bir hata oluştu: ' : 'Paket eklenirken bir hata oluştu: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="packageName">Paket Adı:</label>
        <input
          type="text"
          id="packageName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="packageDescription">Açıklama (İsteğe bağlı):</label>
        <textarea
          id="packageDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        ></textarea>
      </div>
      <div>
        <label htmlFor="packagePrice">Fiyat (TL):</label>
        <input
          type="number"
          id="packagePrice"
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          required
          min="0"
        />
      </div>
      <div>
        <label htmlFor="packageLessonCount">Ders Sayısı (Boş bırakılabilir):</label>
        <input
          type="number"
          id="packageLessonCount"
          value={lessonCount}
          onChange={(e) => setLessonCount(e.target.value === '' ? '' : Number(e.target.value))}
          min="0"
        />
      </div>
      <div>
        <label htmlFor="packageDurationDays">Süre (Gün) (Boş bırakılabilir):</label>
        <input
          type="number"
          id="packageDurationDays"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
          min="0"
        />
      </div>
      <div className="checkbox-container"> {/* Use the class for styling */} 
        <label htmlFor="packageIsActive">Aktif mi?</label>
        <input
          type="checkbox"
          id="packageIsActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? (editingPackage ? 'Güncelleniyor...' : 'Ekleniyor...') : (editingPackage ? 'Güncelle' : 'Kaydet')}
      </button>
    </form>
  );
};

export default AddPackageForm;
