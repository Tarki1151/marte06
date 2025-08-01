// src/pages/PackageManagement.tsx
import React, { useState, useEffect } from 'react';
import AddPackageForm from '../components/AddPackageForm';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastContext';
import PackageList from '../components/PackageList';
import type { Package } from '../types/Package';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import './PackageManagement.css';

const PackageManagement: React.FC = () => {
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'packages'));
      const packagesData = querySnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id })) as Package[];
      setPackages(packagesData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching packages: ", error);
      showToast('Paketler yüklenirken bir hata oluştu.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleFormSuccess = () => {
    fetchPackages(); // Refresh the list
    setIsModalOpen(false); // Close modal
    setEditingPackage(null); // Reset editing state
  };

  const handleAddNewPackage = () => {
    setEditingPackage(null);
    setIsModalOpen(true);
  };

  const handleEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (packageId: string) => {
    setPackageToDelete(packageId);
    setIsConfirmModalVisible(true);
  };

  const confirmDeletion = async () => {
    if (packageToDelete) {
      try {
        await deleteDoc(doc(db, 'packages', packageToDelete));
        showToast('Paket başarıyla silindi.', 'success');
        fetchPackages(); // Refresh the list
      } catch (error) {
        console.error("Error deleting package: ", error);
        showToast('Paket silinirken bir hata oluştu.', 'error');
      }
      setPackageToDelete(null);
      setIsConfirmModalVisible(false);
    }
  };

  return (
    <div className="package-management-page"> {/* Ana konteyner */}
      <div className="page-header"> {/* Başlık için container */}
        <h2>Paket Yönetimi</h2>
        <button onClick={handleAddNewPackage} className="button primary">Yeni Paket Ekle</button>
      </div>

      {/* New/Edit Package Button */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPackage(null);
        }}
        title={editingPackage ? 'Paketi Düzenle' : 'Yeni Paket Ekle'}
      >
        <AddPackageForm 
          onSuccess={handleFormSuccess} 
          existingPackage={editingPackage}
        />
      </Modal>

      {/* Package List */}
      <div className="package-list-container card"> {/* .card class will apply */} 
        {loading ? (
          <p style={{ textAlign: 'center', padding: '0.5rem' }}>Paketler yükleniyor...</p>
        ) : (
          <PackageList 
            packages={packages}
            onPackageEdited={handleEditPackage}
            onPackageDeleted={handleDeleteRequest}
          />
        )}
      </div>

      <ConfirmModal
        isVisible={isConfirmModalVisible}
        message="Bu paketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDeletion}
        onCancel={() => {
          setIsConfirmModalVisible(false);
          setPackageToDelete(null);
        }}
      />
    </div>
  );
};

export default PackageManagement;
