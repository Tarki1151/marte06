// src/pages/MemberManagement.tsx
import React, { useState } from 'react';
import AddMemberForm from '../components/AddMemberForm.tsx';
import MemberList from '../components/MemberList.tsx';
// import './MemberManagement.css'; // Sayfaya özgü diğer stiller için
import type { Member } from '../components/MemberList.tsx'; // Member tipi için import
import MemberDetailModal from '../components/MemberDetailModal.tsx'; // MemberDetailModal importu eklendi

// OCR sonucundan beklenen temel veri yapısı (Yer tutucu - Backend'den dönecek veri formatına göre ayarlanacak)
interface ScannedFormData {
    name?: string;
    surname?: string;
    birthDate?: string; // YYYY-MM-DD formatında string olabilir
    phone?: string;
    email?: string;
    address?: string;
    // Sağlık bilgileri ve paket seçimi gibi diğer alanlar buraya eklenecek
    healthIssues?: string; // Örnek
    medications?: string; // Örnek
    injuries?: string; // Örnek
    packageChoice?: string; // Örnek: '8'li Paket', '10'lu Paket' gibi
    otherPackageDetail?: string; // Diğer seçeneği işaretlendiyse
}

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
    //setScannedMemberData(null); // Taranmış veriyi temizle - Kaldırıldı
  };

  // Üye silme başarılı olunca tetiklenir
  const handleMemberDeleted = () => {
    setRefreshList(prev => !prev); // Listeyi yenile
    // Silme sonrası detay modalı açıksa kapatılabilir veya üye listeden çıkarsa kapanır
    // setMemberForDetail(null);
    // setShowMemberDetailModal(false);
  };

  // Üye düzenle butonuna basılınca tetiklenir
  const handleMemberEdited = (member: Member) => {
    setEditingMember(member); // Düzenlenen üyeyi state'e kaydet
    setShowAddForm(true); // Düzenleme formu için ekleme formunu göster
    //setScannedMemberData(null); // Düzenleme moduna geçerken taranmış veriyi temizle - Kaldırıldı
    // TODO: Formu düzenlenecek üye bilgileriyle doldurma mantığı AddMemberForm componentinde olacak
  };

  // Üye listesinde bir üyeye tıklanınca tetiklenir
  const handleMemberClick = (member: Member) => {
      setMemberForDetail(member); // Detayı gösterilecek üyeyi state'e kaydet
      setShowMemberDetailModal(true); // Detay modalını göster
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
                   // setScannedMemberData(null); // Manuel ekleme için taranmış veriyi temizle - Kaldırıldı
               }}>Yeni Üye Ekle</button>
          )}

           {/* Formu Gizle Butonu (Form açıksa göster) */}
           {showAddForm && (
                <button onClick={() => {
                     setShowAddForm(false);
                     setEditingMember(null);
                     //setScannedMemberData(null); // Form kapatıldığında taranmış veriyi temizle - Kaldırıldı
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
            //initialData={scannedMemberData} // Tarama modunda taranan veri - Kaldırıldı
          />
        </div>
      )}

      {/* Üye Listesi */}
      <div className="member-list-container card"> {/* .card class'ı eklendi */} 
        <MemberList 
          refreshTrigger={refreshList} 
          onMemberDeleted={handleMemberDeleted} /* onMemberDeleted callback'i pass edildi */
          onMemberEdited={handleMemberEdited}   /* onMemberEdited callback'i pass edildi */
          onMemberClick={handleMemberClick} /* onMemberClick callback'i pass edildi */
        />
      </div>

      {/* Üye Detay Modalı */}
      {showMemberDetailModal && memberForDetail && (
          <MemberDetailModal 
              isVisible={showMemberDetailModal} /* Modalın görünürlüğünü kontrol et */
              onClose={handleCloseMemberDetailModal} /* Kapatma callback'i */
              member={memberForDetail} /* Detayı gösterilecek üyeyi pass et */
              // TODO: onPackageAssigned, onPaymentRecorded, onDeleteAssignedPackage, onDeletePayment callbackleri eklenecek
          />
      )}

    </div>
  );
};

export default MemberManagement;
