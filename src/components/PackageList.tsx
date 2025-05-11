// src/components/PackageList.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc, type DocumentData, Timestamp } from 'firebase/firestore';

export interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  lessonCount?: number | null;
  durationDays?: number | null;
  isActive: boolean;
  createdAt: Timestamp;
}

interface PackageListProps {
  refreshTrigger: boolean;
  onPackageEdited: (pkg: Package) => void; // Edit callback
  onPackageDeleted: (packageId: string) => void; // Delete callback
}

const PackageList: React.FC<PackageListProps> = ({ refreshTrigger, onPackageEdited, onPackageDeleted }) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null); // Track item being deleted

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true);
      setError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'packages'));
        const packagesData: Package[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Package, 'id'>
        }));
        setPackages(packagesData);
      } catch (error: any) {
        console.error('Paketleri çekme hatası:', error);
        setError('Paketler yüklenirken bir hata oluştu: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [refreshTrigger]);

  if (loading) {
    return <div>Paketler yükleniyor...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (packages.length === 0) {
    return <div>Henüz tanımlı paket bulunmamaktadır.</div>;
  }

  // Handle Edit icon click
  const handleEditClick = (pkg: Package) => {
    onPackageEdited(pkg); // Call the parent's edit handler
  };

  // Handle Delete icon click
  const handleDeleteClick = async (packageId: string) => {
    const confirmDelete = window.confirm('Bu paketi silmek istediğinizden emin misiniz?');
    if (confirmDelete) {
      setDeletingId(packageId); // Indicate which item is being deleted
      try {
        // Delete from Firestore
        await deleteDoc(doc(db, 'packages', packageId));
        console.log('Paket silindi:', packageId);
        onPackageDeleted(packageId); // Call the parent's delete handler

      } catch (error: any) {
        console.error('Paket silme hatası:', error);
        setError('Paket silinirken bir hata oluştu: ' + error.message);
      } finally {
        setDeletingId(null); // Clear deleting state
      }
    }
  };

  return (
    <div className="package-list"> {/* Liste konteyneri */}
      <h3>Tanımlı Paketler</h3>
      <ul>
        {packages.map(pkg => (
          <li key={pkg.id} className="package-list-item card"> {/* .card class'ı ve class eklendi */} 
            {/* Paket Bilgileri */} 
            <span>
                <h4>{pkg.name} ({pkg.isActive ? 'Aktif' : 'Pasif'})</h4>
                <p><strong>Fiyat:</strong> {pkg.price} TL</p>
                {pkg.lessonCount !== null && pkg.lessonCount !== undefined && <p><strong>Ders Sayısı:</strong> {pkg.lessonCount}</p>}
                {pkg.durationDays !== null && pkg.durationDays !== undefined && <p><strong>Süre:</strong> {pkg.durationDays} Gün</p>}
                {pkg.description && <p><em>{pkg.description}</em></p>}
            </span>

            {/* Aksiyon Butonları (İkonlu) */} 
            <div className="actions"> {/* common.css'teki .actions class'ını kullan */} 
                {/* Düzenle butonu (ikon) */}
                <button onClick={() => handleEditClick(pkg)} title="Düzenle" className="edit-button">✏️</button>
                {/* Sil butonu (ikon) - loading durumunda disabled */}
                <button onClick={() => handleDeleteClick(pkg.id)} disabled={deletingId === pkg.id} title="Sil" className="delete-button"> 
                    {deletingId === pkg.id ? '...' : '🗑️'}
                </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PackageList;
