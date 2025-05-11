// src/components/BranchList.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig'; // Firestore db objesini import et
import { collection, getDocs, doc, deleteDoc, type DocumentData, Timestamp } from 'firebase/firestore'; // Firestore fonksiyonlarını import et

export interface Branch {
  id: string; // Firestore belge ID'si
  name: string;
  description?: string; // Açıklama alanı opsiyonel
  createdAt: Timestamp; // Timestamp tipi eklendi
}

interface BranchListProps {
  refreshTrigger: boolean; // Listeyi yenilemek için kullanılacak trigger
  onBranchDeleted: () => void; // Branş silindiğinde çağrılacak callback
  onBranchEdited: (branch: Branch) => void; // Branş düzenlenmek istendiğinde çağrılacak callback
}

const BranchList: React.FC<BranchListProps> = ({ refreshTrigger, onBranchDeleted, onBranchEdited }) => { // onBranchEdited prop adı düzeltildi
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null); // Silinen branşın ID'si

  useEffect(() => {
    const fetchBranches = async () => {
      setLoading(true);
      setError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'branches'));
        const branchesData: Branch[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Branch, 'id'>
        }));
        setBranches(branchesData);
      } catch (error: any) {
        console.error('Branşları çekme hatası:', error);
        setError('Branşlar yüklenirken bir hata oluştu: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [refreshTrigger]); // refreshTrigger'ı dependency array'ine ekle

  if (loading) {
    return <div>Branşlar yükleniyor...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (branches.length === 0) {
    return <div>Henüz tanımlı branş bulunmamaktadır.</div>;
  }

  // Branş düzenleme işlemi başlatan fonksiyon
  const handleEditClick = (branch: Branch) => {
    onBranchEdited(branch); // Callback fonksiyonunu çağır, branş objesini pass et
  };

  // Branş silme işlemi başlatan fonksiyon
  const handleDeleteClick = async (branchId: string) => {
    const confirmDelete = window.confirm('Bu branşı silmek istediğinizden emin misiniz?');
    if (confirmDelete) {
      setDeletingId(branchId); // Silinen branşı işaretle
      try {
        // Firestore'dan branşı sil
        await deleteDoc(doc(db, 'branches', branchId));
        console.log('Branş silindi:', branchId);
        onBranchDeleted(); // Silme başarılı olduktan sonra callback'i çağır

      } catch (error: any) {
        console.error('Branş silme hatası:', error);
        setError('Branş silinirken bir hata oluştu: ' + error.message);
      } finally {
        setDeletingId(null); // Silme işlemi bitti
      }
    }
  };

  return (
    <div className="branch-list"> {/* Liste konteyneri */}
      <h3>Tanımlı Branşlar</h3>
      <ul>
        {branches.map(branch => (
          <li key={branch.id} className="branch-list-item card"> {/* .card class'ı ve class eklendi */} 
            {/* Branş Bilgileri */} 
            <span>{branch.name}</span>
            {/* Açıklama kısmı kaldırıldı */} 

            {/* Aksiyon Butonları (İkonlu) */} 
            <div className="actions"> {/* common.css'teki .actions class'ını kullan */} 
                {/* Düzenle butonu (ikon) - handleEditClick'i çağır */}
                <button onClick={() => handleEditClick(branch)} title="Düzenle" className="edit-button">✏️</button>
                {/* Sil butonu (ikon) - handleDeleteClick'i çağır - loading durumunda disabled */}
                <button onClick={() => handleDeleteClick(branch.id)} disabled={deletingId === branch.id} title="Sil" className="delete-button"> {/* .delete-button class'ı eklendi */} 
                    {deletingId === branch.id ? '...' : '🗑️'}
                </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BranchList;
