// src/pages/MemberManagement.tsx
import React, { useState } from 'react';
import AddMemberForm from '../components/AddMemberForm.tsx';
import MemberList from '../components/MemberList.tsx';
import './MemberManagement.css'; // Sayfaya özgü diğer stiller için
import type { Member } from '../components/MemberList.tsx'; // Member tipi için import
import MemberDetailModal from '../components/MemberDetailModal.tsx'; // MemberDetailModal importu eklendi
import { db } from '../firebaseConfig.ts'; // Firebase db instance
import { doc, deleteDoc } from 'firebase/firestore';


const MemberManagement: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false); // Yeni üye formu gösterme/gizleme state'i
  const [refreshList, setRefreshList] = useState(false); // Liste yenileme için state
  const [editingMember, setEditingMember] = useState<Member | null>(null); // Düzenlenen üye state'i
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false); // Üye detay modalı görünürlük state'i
  const [memberForDetail, setMemberForDetail] = useState<Member | null>(null); // Detayı gösterilecek üye state'i


  // Üye ekleme başarılı olunca tetiklenir
  const handleMemberAdded = () => {
    setShowAddForm(false); // Formu gizle
    setRefreshList(prev => !prev); // Listeyi yenile
    setEditingMember(null); // Düzenleme durumunu sıfırla
  };



  // Üye listesinde bir üyeye tıklanınca tetiklenir
  const handleMemberClick = (member: Member) => {
      setMemberForDetail(member); // Detayı gösterilecek üyeyi state'e kaydet
      setShowMemberDetailModal(true); // Detay modalını göster
  };

  // Üye detay modalından düzenleme talebi gelince tetiklenir
  const handleEditMember = (member: Member) => {
    setShowMemberDetailModal(false); // Detay modalını kapat
    setEditingMember(member); // Düzenlenecek üyeyi ayarla
    setShowAddForm(true); // Ekleme/düzenleme formunu göster
  };

  // Üye detay modalından silme talebi gelince tetiklenir
  const handleDeleteMember = async (memberId: string) => {
    try {
      const memberDocRef = doc(db, 'members', memberId);
      await deleteDoc(memberDocRef);
      console.log('Member deleted successfully with ID:', memberId);
      
      // After successful deletion from the backend:
      handleCloseMemberDetailModal(); // Close the modal
      setRefreshList(prev => !prev); // Refresh the member list
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Üye silinirken bir hata oluştu.');
    }
  };

  // Üye detay modalı kapatılınca tetiklenir
  const handleCloseMemberDetailModal = () => {
      setMemberForDetail(null); // Detay gösterilecek üyeyi temizle
      setShowMemberDetailModal(false); // Detay modalını gizle
       // Detay modalında güncelleme/silme yapılmışsa listeyi yenile
       setRefreshList(prev => !prev);
  };

  return (
    <div className="member-management-page">
      <div className="page-header">
        <h2>Üye Yönetimi</h2>
      </div>

      {/* Yeni Üye Ekle / Düzenle Butonu */}
      <div className="controls">
          {/* Yeni Üye Ekle Butonu (Düzenleme modunda gizli) */}
          {!editingMember && !showAddForm && (
               <button onClick={() => {
                    setShowAddForm(true);
               }}>Yeni Üye Ekle</button>
          )}

           {/* Formu Gizle Butonu (Form açıksa göster) */}
           {showAddForm && (
                <button onClick={() => {
                     setShowAddForm(false);
                     setEditingMember(null);
                }}>Formu Gizle</button>
           )}

      </div>

      {/* Yeni Üye Ekle / Düzenle Formu (showAddForm true ise gösterilecek) */}
      {showAddForm && (
        <div className="add-member-form-container card"> {/* .card class'ı eklendi */} 
          <AddMemberForm 
            onMemberAdded={handleMemberAdded} 
            // TODO: onMemberUpdated ve editingMember prop'ları AddMemberForm componentine eklenecek
            // onMemberUpdated={handleMemberUpdated}
            editingMember={editingMember} // Düzenleme modunda mevcut üye verisi
          />
        </div>
      )}

      {/* Üye Listesi */}
      <div className="member-list-container card"> {/* .card class'ı eklendi */} 
        <MemberList 
          refreshTrigger={refreshList} 
          onMemberClick={handleMemberClick} /* onMemberClick callback'i pass edildi */
        />
      </div>

      {/* Üye Detay Modalı */}
      {showMemberDetailModal && memberForDetail && (
          <MemberDetailModal 
              isVisible={showMemberDetailModal} /* Modalın görünürlüğünü kontrol et */
              onClose={handleCloseMemberDetailModal} /* Kapatma callback'i */
              member={memberForDetail} /* Detayı gösterilecek üyeyi pass et */
              onMemberUpdate={handleEditMember}
              onDelete={handleDeleteMember}
          />
      )}

    </div>
  );
};

export default MemberManagement;
