// src/pages/BranchManagement.tsx
import React, { useState } from 'react';
import AddBranchForm from '../components/AddBranchForm.tsx'; // AddBranchForm'u import et
import BranchList from '../components/BranchList.tsx'; // BranchList'i import et
import './BranchManagement.css';
import type { Branch } from '../components/BranchList.tsx'; // Branch interface'ini import et

const BranchManagement: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshList, setRefreshList] = useState(false); // Liste yenileme için state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null); // Düzenlenmekte olan branş state'i eklendi

  // Branş ekleme başarılı olunca tetiklenir
  const handleBranchAdded = () => {
    setShowAddForm(false); // Formu gizle
    setRefreshList(prev => !prev); // Listeyi yenile
    setEditingBranch(null); // Yeni ekleme sonrası editingBranch'i temizle
  };

  // Branş silme başarılı olunca tetiklenir
  const handleBranchDeleted = () => {
      setRefreshList(prev => !prev); // Refresh the list after deletion
      // TODO: Potentially show a success message
  };

  // Branş düzenle butonuna basılınca tetiklenir
  const handleBranchEdited = (branch: Branch) => {
      console.log('Branş düzenleme istendi:', branch);
      setEditingBranch(branch); // Düzenlenmekte olan branşı state'e kaydet
      setShowAddForm(true); // Formu göster
  };

    // Branş güncelleme başarılı olunca tetiklenir (AddBranchForm tarafından çağrılır)
    const handleBranchUpdated = () => {
        setEditingBranch(null); // Düzenleme sonrası editingBranch'i temizle
        setShowAddForm(false); // Formu gizle
        setRefreshList(prev => !prev); // Listeyi yenile
        // TODO: Potentially show a success message
    };


  return (
    <div className="branch-management-page"> {/* Ana konteyner */}
      <div className="page-header"> {/* Başlık için container - Üye yönetimine benzer stil */}
        <h2>Branş Yönetimi</h2>
        {/* Logout butonu burada yok, sadece Branş Yönetimi başlığı var */}
      </div>

      {/* Yeni Branş Ekle / Düzenle Butonu */}
      {/* Düzenleme modundaysa metni değiştir */} 
      <button onClick={() => setShowAddForm(!showAddForm)}>
        {showAddForm ? 'Formu Gizle' : editingBranch ? 'Branşı Düzenle' : 'Yeni Branş Ekle'}
      </button>

      {/* Yeni Branş Ekle / Düzenle Formu (showAddForm true ise gösterilecek) */}
      {showAddForm && (
        <div className="add-branch-form-container card"> {/* Form konteyneri */}
          <AddBranchForm 
            onBranchAdded={handleBranchAdded} 
            onBranchUpdated={handleBranchUpdated} /* Güncelleme callback'i pass edildi */
            editingBranch={editingBranch} /* editingBranch state'i pass edildi */
          />
        </div>
      )}

      {/* Branş Listesi */}
      <div className="branch-list-container card"> {/* Liste konteyneri */}
        <BranchList 
          refreshTrigger={refreshList} 
          onBranchDeleted={handleBranchDeleted} /* Pass delete handler */
          onBranchEdited={handleBranchEdited} /* Pass edit handler */
        /> {/* Listeyi kullandık ve trigger prop'unu verdik */}
      </div>
    </div>
  );
};

export default BranchManagement;
