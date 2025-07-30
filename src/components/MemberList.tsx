// src/components/MemberList.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useToast } from './ToastContext';
import Modal from './Modal';
import './MemberList.css';
import { formatPhone } from '../utils/formatPhone';

export interface Member {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  birthDate?: Timestamp;
  parentName?: string;
  parentPhone?: string;
  createdAt: Timestamp;
  notes?: string;
}

interface MemberListProps {
  refreshTrigger: boolean;
  onMemberDeleted: () => void;
  onMemberEdited: (member: Member) => void;
  onMemberClick: (member: Member) => void; // Yeni callback prop'u
}

const MemberList: React.FC<MemberListProps> = ({ refreshTrigger, onMemberDeleted, onMemberEdited, onMemberClick }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    setSearch('');
  }, [refreshTrigger]);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const querySnapshot = await getDocs(collection(db, 'members'));
        const membersData: Member[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Member, 'id'>
        }));
        setMembers(membersData);
      } catch (error: any) {
        console.error('Üyeleri çekme hatası:', error);
        setError('Üyeler yüklenirken bir hata oluştu: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [refreshTrigger]);

  if (loading) {
    return <div>Üyeler yükleniyor...</div>;
  }

  if (error) {
    return <div className="error-message" role="alert">{error}</div>;
  }

  // Filtrelenmiş üyeler
  const filteredMembers = members.filter((member) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      member.name?.toLowerCase().includes(q) ||
      member.surname?.toLowerCase().includes(q) ||
      member.email?.toLowerCase().includes(q) ||
      formatPhone(member.phone).replace(/\s/g, '').includes(q.replace(/\D/g, ''))
    );
  });

  if (members.length === 0) {
    return <div>Henüz kayıtlı üye bulunmamaktadır.</div>;
  }

  const openDeleteModal = (member: Member) => {
    setConfirmDeleteId(member.id);
    setConfirmDeleteName(`${member.name} ${member.surname}`);
  };

  const closeDeleteModal = () => {
    setConfirmDeleteId(null);
    setConfirmDeleteName(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await deleteDoc(doc(db, 'members', confirmDeleteId));
      showToast('Üye başarıyla silindi.', 'success');
      onMemberDeleted();
    } catch (error: any) {
      showToast('Üye silinirken hata oluştu: ' + error.message, 'error');
      setError('Üye silinirken bir hata oluştu: ' + error.message);
    } finally {
      setDeletingId(null);
      closeDeleteModal();
    }
  };

  const handleEditClick = (member: Member) => {
    onMemberEdited(member);
  };

   // Handle click on the member list item (to open detail modal)
  const handleMemberItemClick = (member: Member) => {
      onMemberClick(member); // Call the parent's member click handler
  };

  return (
    <>
      <div className="member-list">
        <h3>Kayıtlı Üyeler</h3>
        <input
          type="text"
          placeholder="Üye ara (isim, soyisim, e-posta, telefon)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: '1rem', padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #ddd', width: '100%', maxWidth: 320 }}
          aria-label="Üye ara"
        />
        <ul>
          {filteredMembers.length === 0 ? (
            <li style={{ color: '#888', padding: '1rem' }}>Aramanıza uygun üye bulunamadı.</li>
          ) : (
            <>
              {filteredMembers.map(member => (
                <li 
                  key={member.id} 
                  className="member-list-item card clickable"
                  tabIndex={0}
                  aria-label={`Üye: ${member.name} ${member.surname}`}
                  onClick={() => handleMemberItemClick(member)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleMemberItemClick(member); }}
                >
                  <span>
                    {member.name} {member.surname} - {formatPhone(member.phone) || 'Telefon Yok'}
                    {member.notes && ` - Not: ${member.notes}`}
                  </span>
                  <div className="actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEditClick(member)} title="Düzenle" aria-label={`Üyeyi Düzenle: ${member.name} ${member.surname}`}>✏️</button>
                    <button onClick={() => openDeleteModal(member)} disabled={deletingId === member.id} title="Sil" aria-label={`Üyeyi Sil: ${member.name} ${member.surname}`}>
                      {deletingId === member.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      </div>
      {/* Silme Onay Modali */}
      <Modal
        isOpen={!!confirmDeleteId}
        onClose={closeDeleteModal}
        title="Üyeyi Sil"
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
          <strong>{confirmDeleteName}</strong> adlı üyeyi silmek istediğinize emin misiniz?
        </div>
      </Modal>
    </>
  );
}

export default MemberList;
