// src/components/MemberList.tsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, deleteDoc, type DocumentData, Timestamp } from 'firebase/firestore'; // Timestamp importu eklendi

export interface Member { // Export edildi
  id: string;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  birthDate?: Timestamp; // birthYear yerine birthDate (Timestamp)
  parentName?: string;
  parentPhone?: string;
  createdAt: Timestamp; // any yerine Timestamp
  notes?: string; // Not alanı eklendi
}

interface MemberListProps {
  refreshTrigger: boolean; // Listeyi yenilemek için kullanılacak trigger
  onMemberDeleted: () => void; // Üye silindiğinde çağrılacak callback
  onMemberEdited: (member: Member) => void; // Üye düzenlenmek istendiğinde çağrılacak callback
}

const MemberList: React.FC<MemberListProps> = ({ refreshTrigger, onMemberDeleted, onMemberEdited }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true); // Yüklenme state'i
  const [error, setError] = useState<string | null>(null); // Hata state'i
  const [deletingId, setDeletingId] = useState<string | null>(null); // Silinen üyenin ID'si

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
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (members.length === 0) {
    return <div>Henüz kayıtlı üye bulunmamaktadır.</div>;
  }

  const handleEditClick = (member: Member) => {
    onMemberEdited(member);
  };

  const handleDeleteClick = async (memberId: string) => {
    const confirmDelete = window.confirm('Bu üyeyi silmek istediğinizden emin misiniz?');
    if (confirmDelete) {
      setDeletingId(memberId);
      try {
        await deleteDoc(doc(db, 'members', memberId));
        console.log('Üye silindi:', memberId);
        onMemberDeleted();
      } catch (error: any) {
        console.error('Silme hatası:', error);
        setError('Üye silinirken bir hata oluştu: ' + error.message);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="member-list">
      <h3>Kayıtlı Üyeler</h3>
      <ul>
        {members.map(member => (
          <li key={member.id} className="member-list-item card">
            <span>
              {member.name} {member.surname} - {member.phone || 'Telefon Yok'}
              {member.notes && ` - Not: ${member.notes}`}
            </span> {/* Corrected template literal */}
            <div className="member-actions">
                <button onClick={() => handleEditClick(member)} title="Düzenle">✏️</button>
                <button onClick={() => handleDeleteClick(member.id)} disabled={deletingId === member.id} title="Sil">
                    {deletingId === member.id ? '...' : '🗑️'}
                </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MemberList;
