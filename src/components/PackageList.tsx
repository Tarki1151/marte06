// src/components/PackageList.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useToast } from './ToastContext';
import Modal from './Modal';
import './PackageList.css';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    setSearch(''); // Reset search on refresh
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
    return <div className="error-message" role="alert">{error}</div>;
  }

  // Filtrelenmiş paketler
  const filteredPackages = packages.filter((pkg) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      pkg.name?.toLowerCase().includes(q) ||
      pkg.description?.toLowerCase().includes(q) ||
      String(pkg.price).includes(q) ||
      (pkg.lessonCount !== null && pkg.lessonCount !== undefined && String(pkg.lessonCount).includes(q)) ||
      (pkg.durationDays !== null && pkg.durationDays !== undefined && String(pkg.durationDays).includes(q))
    );
  });

  if (packages.length === 0) {
    return <div>Henüz tanımlı paket bulunmamaktadır.</div>;
  }

  // Handle Edit icon click
  const handleEditClick = (pkg: Package) => {
    onPackageEdited(pkg); // Call the parent's edit handler
  };

  // Modal aç
  const openDeleteModal = (pkg: Package) => {
    setConfirmDeleteId(pkg.id);
    setConfirmDeleteName(pkg.name);
  };

  // Modal kapat
  const closeDeleteModal = () => {
    setConfirmDeleteId(null);
    setConfirmDeleteName(null);
  };

  // Silme işlemini onayla
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await deleteDoc(doc(db, 'packages', confirmDeleteId));
      showToast('Paket başarıyla silindi.', 'success');
      onPackageDeleted(confirmDeleteId);
    } catch (error: any) {
      showToast('Paket silinirken hata oluştu: ' + error.message, 'error');
      setError('Paket silinirken bir hata oluştu: ' + error.message);
    } finally {
      setDeletingId(null);
      closeDeleteModal();
    }
  };

  return (
    <div className="package-list"> {/* Liste konteyneri */}
      <h3>Tanımlı Paketler</h3>
      <input
        type="text"
        placeholder="Paket ara (isim, açıklama, fiyat, ders, süre)"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #ddd', width: '100%', maxWidth: 320 }}
        aria-label="Paket ara"
      />
      <ul>
        {filteredPackages.length === 0 ? (
          <li style={{ color: '#888', padding: '1rem' }}>Aramanıza uygun paket bulunamadı.</li>
        ) : (
          filteredPackages.map(pkg => (
            <li key={pkg.id} className="package-list-item card">
              {/* Paket Bilgileri */}
              <span>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pkg.name}
                  {pkg.isActive && <span className="badge" aria-label="Aktif Paket">Aktif</span>}
                  {!pkg.isActive && <span className="badge inactive" aria-label="Pasif Paket">Pasif</span>}
                </h4>
                <p><strong>Fiyat:</strong> {pkg.price} TL</p>
                {pkg.lessonCount !== null && pkg.lessonCount !== undefined && <p><strong>Ders Sayısı:</strong> {pkg.lessonCount}</p>}
                {pkg.durationDays !== null && pkg.durationDays !== undefined && <p><strong>Süre:</strong> {pkg.durationDays} Gün</p>}
                {pkg.description && <p><em>{pkg.description}</em></p>}
              </span>

              {/* Aksiyon Butonları (İkonlu) */}
              <div className="actions">
                {/* Düzenle butonu (ikon) */}
                <button onClick={() => handleEditClick(pkg)} title="Düzenle" aria-label={`Paketi Düzenle: ${pkg.name}`} className="edit-button">✏️</button>
                {/* Sil butonu (ikon) - loading durumunda disabled */}
                <button onClick={() => openDeleteModal(pkg)} disabled={deletingId === pkg.id} title="Sil" aria-label={`Paketi Sil: ${pkg.name}`} className="delete-button">
                  {deletingId === pkg.id ? '...' : '🗑️'}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
      {/* Silme Onay Modali */}
      <Modal
        isOpen={!!confirmDeleteId}
        onClose={closeDeleteModal}
        title="Paketi Sil"
        actions={
          <>
            <button onClick={handleConfirmDelete} style={{ background: 'var(--color-error)' }} disabled={deletingId === confirmDeleteId}>
              {deletingId === confirmDeleteId ? 'Siliniyor...' : 'Evet, Sil'}
            </button>
            <button onClick={closeDeleteModal} style={{ background: 'var(--color-border)', color: '#333' }}>Vazgeç</button>
          </>
        }
      >
        <div>
          <strong>{confirmDeleteName}</strong> adlı paketi silmek istediğinize emin misiniz?
        </div>
      </Modal>
    </div>
  );
};

export default PackageList;
