// src/pages/PackageManagement.tsx
import React, { useState } from 'react';
import AddPackageForm from '../components/AddPackageForm.tsx';
import PackageList from '../components/PackageList.tsx';
import './PackageManagement.css';
import type { Package } from '../components/PackageList.tsx'; // Import Package interface

const PackageManagement: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshList, setRefreshList] = useState(false); // Liste yenileme için state
  const [editingPackage, setEditingPackage] = useState<Package | null>(null); // State for editing package

  // Handle package added (from AddPackageForm)
  const handlePackageAdded = () => {
    setShowAddForm(false);
    setRefreshList(prev => !prev); // Refresh list
    setEditingPackage(null); // Clear editing state
  };

  // Handle package updated (will be called from AddPackageForm in the next step)
  const handlePackageUpdated = () => {
    setEditingPackage(null); // Clear editing state
    setShowAddForm(false); // Hide form
    setRefreshList(prev => !prev); // Refresh list
    // TODO: Show success message
  };

  // Handle package deleted (from PackageList)
  const handlePackageDeleted = () => {
    setRefreshList(prev => !prev); // Refresh list
    // TODO: Show success message
  };

  // Handle edit button click (from PackageList)
  const handlePackageEdited = (pkg: Package) => {
    setEditingPackage(pkg); // Set package to be edited
    setShowAddForm(true); // Show the form
  };

  return (
    <div className="package-management-page"> {/* Ana konteyner */}
      <div className="page-header"> {/* Başlık için container */}
        <h2>Paket Yönetimi</h2>
      </div>

      {/* New/Edit Package Button */}
      <button onClick={() => setShowAddForm(!showAddForm)}>
        {showAddForm ? 'Formu Gizle' : editingPackage ? 'Paketi Düzenle' : 'Yeni Paket Ekle'}
      </button>

      {/* New/Edit Package Form (shown if showAddForm is true) */}
      {showAddForm && (
        <div className="add-package-form-container card"> {/* .card class will apply */} 
          <AddPackageForm 
            onPackageAdded={handlePackageAdded} 
            onPackageUpdated={handlePackageUpdated} /* Pass update handler */
            editingPackage={editingPackage} /* Pass package to edit */
          />
        </div>
      )}

      {/* Package List */}
      <div className="package-list-container card"> {/* .card class will apply */} 
        <PackageList 
          refreshTrigger={refreshList} 
          onPackageEdited={handlePackageEdited} /* Pass edit handler */
          onPackageDeleted={handlePackageDeleted} /* Pass delete handler */
        />
      </div>
    </div>
  );
};

export default PackageManagement;
