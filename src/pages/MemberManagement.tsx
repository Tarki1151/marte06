// src/pages/MemberManagement.tsx
import React, { useState } from 'react';
import AddMemberForm from '../components/AddMemberForm.tsx';
import MemberList from '../components/MemberList.tsx';
import './MemberManagement.css'; // Sayfaya özgü diğer stiller için
import type { Member } from '../components/MemberList.tsx'; // Member tipi için import

const MemberManagement: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false); // Yeni üye formu gösterme/gizleme state'i
  const [refreshList, setRefreshList] = useState(false); // Liste yenileme için state
  const [editingMember, setEditingMember] = useState<Member | null>(null); // Düzenlenen üye state'i

  // Üye ekleme başarılı olunca tetiklenir
  const handleMemberAdded = () => {
    setShowAddForm(false); // Formu gizle
    setRefreshList(prev => !prev); // Listeyi yenile
  };

  // Üye silme başarılı olunca tetiklenir
  const handleMemberDeleted = () => {
    setRefreshList(prev => !prev); // Listeyi yenile
  };

  // Üye düzenle butonuna basılınca tetiklenir
  const handleMemberEdited = (member: Member) => {
    setEditingMember(member); // Düzenlenen üyeyi state'e kaydet
    setShowAddForm(true); // Düzenleme formu için ekleme formunu göster (veya ayrı bir modal açabilirsiniz)
    // TODO: Formu düzenlenecek üye bilgileriyle doldurma mantığı eklenecek
  };

  return (
    <div className="member-management-page">
      <div className="page-header">
        <h2>Üye Yönetimi</h2>
      </div>

      {/* Yeni Üye Ekle / Düzenle Butonu */}
      {/* Düzenleme modundaysa metni değiştir */} 
      <button onClick={() => setShowAddForm(!showAddForm)}>
        {showAddForm ? 'Formu Gizle' : editingMember ? 'Üyeyi Düzenle' : 'Yeni Üye Ekle'}
      </button>

      {/* Yeni Üye Ekle / Düzenle Formu (showAddForm true ise gösterilecek) */}
      {showAddForm && (
        <div className="add-member-form-container card"> {/* .card class'ı eklendi */} 
          {/* Düzenleme modundaysa form prop'una düzenlenecek üyeyi pass et */} 
          <AddMemberForm 
            onMemberAdded={handleMemberAdded} 
            // editingMember prop'u eklenecek ve AddMemberForm ona göre düzenlenecek
            // editingMember={editingMember}
          />
        </div>
      )}

      {/* Üye Listesi */}
      <div className="member-list-container card"> {/* .card class'ı eklendi */} 
        <MemberList 
          refreshTrigger={refreshList} 
          onMemberDeleted={handleMemberDeleted} /* onMemberDeleted callback'i pass edildi */
          onMemberEdited={handleMemberEdited}   /* onMemberEdited callback'i pass edildi */
        />
      </div>
    </div>
  );
};

export default MemberManagement;
