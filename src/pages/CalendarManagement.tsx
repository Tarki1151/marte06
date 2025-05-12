import React, { useState, useEffect, useCallback } from 'react';
import Calendar from '../components/Calendar';
import './CalendarManagement.css';
import type { Member } from '../components/MemberList';
import MemberSelectModal from '../components/MemberSelectModal';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CalendarManagement: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'morning' | 'evening' | null>(null);
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false);
  const [membersForSelectedDate, setMembersForSelectedDate] = useState<Member[]>([]);
  const [loadingMembersForDate, setLoadingMembersForDate] = useState(false);
  const [fetchMembersError, setFetchMembersError] = useState<string | null>(null);

  const fetchMembersForDate = useCallback(async (date: Date, timeSlot: 'morning' | 'evening') => {
    setLoadingMembersForDate(true);
    setFetchMembersError(null);
    setMembersForSelectedDate([]);

    try {
      const lessonTimeUTC = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        timeSlot === 'morning' ? 10 : 16,
        0, 0, 0
      ));

      const lessonsRef = collection(db, 'lessons');
      const q = query(
        lessonsRef,
        where('date', '==', lessonTimeUTC),
        where('timeSlot', '==', timeSlot)
      );

      const querySnapshot = await getDocs(q);
      let memberIds: string[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        memberIds = [...new Set([...memberIds, ...(data.memberIds || [])])];
      });

      if (memberIds.length > 0) {
        const membersSnapshot = await getDocs(collection(db, 'members'));
        const allMembers: Member[] = membersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as Omit<Member, 'id'>
        }));
        const scheduledMembers = allMembers.filter(member => memberIds.includes(member.id));
        scheduledMembers.sort((a, b) => a.name.localeCompare(b.name));
        setMembersForSelectedDate(scheduledMembers);
      } else {
        setMembersForSelectedDate([]);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setFetchMembersError('Failed to load members: ' + error.message);
      setMembersForSelectedDate([]);
    } finally {
      setLoadingMembersForDate(false);
    }
  }, []);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  }, []);

  useEffect(() => {
    if (selectedDate && selectedTimeSlot) {
      fetchMembersForDate(selectedDate, selectedTimeSlot);
    } else {
      setMembersForSelectedDate([]);
    }
  }, [selectedDate, selectedTimeSlot, fetchMembersForDate]);

  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
  };

  const handleTimeSlotSelect = (timeSlot: 'morning' | 'evening') => {
    setSelectedTimeSlot(timeSlot);
  };

  const handleAddLessonClick = () => {
    if (selectedDate && selectedTimeSlot) {
      setShowMemberSelectModal(true);
    } else {
      alert('Lütfen ders eklemek için önce bir tarih ve zaman dilimi seçin.');
    }
  };

  const handleCloseMemberSelectModal = () => {
    setShowMemberSelectModal(false);
    if (selectedDate && selectedTimeSlot) {
      fetchMembersForDate(selectedDate, selectedTimeSlot);
    }
  };

  const handleSaveLesson = async (selectedMemberIds: string[]) => {
    if (!selectedDate || !selectedTimeSlot) return;

    setLoadingMembersForDate(true);
    setFetchMembersError(null);

    try {
      const lessonTimeUTC = new Date(Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedTimeSlot === 'morning' ? 10 : 16,
        0, 0, 0
      ));

      const lessonDocRef = doc(collection(db, 'lessons'));

      await setDoc(lessonDocRef, {
        date: lessonTimeUTC,
        timeSlot: selectedTimeSlot,
        memberIds: selectedMemberIds,
        updatedAt: new Date(),
      });

      handleCloseMemberSelectModal();
    } catch (error: any) {
      console.error('Error saving lesson:', error);
      setFetchMembersError('Failed to save members: ' + error.message);
    } finally {
      setLoadingMembersForDate(false);
    }
  };

  return (
    <div className="calendar-management-page">
      <div className="page-header">
        <h2>Takvim Yönetimi</h2>
      </div>
      <Calendar onDateSelect={handleDateSelect} selectedDate={selectedDate} />
      <div className="selected-date-info card">
        {selectedDate ? (
          <div className="date-details-container">
            <h3>Seçilen Tarih: {selectedDate.toLocaleDateString()}</h3>
            <div className="time-slot-buttons">
              <button
                onClick={() => handleTimeSlotSelect('morning')}
                className={selectedTimeSlot === 'morning' ? 'selected' : ''}
              >
                Sabah (10:00)
              </button>
              <button
                onClick={() => handleTimeSlotSelect('evening')}
                className={selectedTimeSlot === 'evening' ? 'selected' : ''}
              >
                Akşam (16:00)
              </button>
            </div>
            {!loadingMembersForDate && !fetchMembersError && selectedTimeSlot && (
              <button onClick={handleAddLessonClick} className="add-lesson-button">Ders Üyelerini Seç</button>
            )}
            {loadingMembersForDate && <p>Üyeler yükleniyor...</p>}
            {fetchMembersError && <p style={{ color: 'red' }}>{fetchMembersError}</p>}
            {!loadingMembersForDate && !fetchMembersError && selectedTimeSlot && membersForSelectedDate.length > 0 && (
              <div className="scheduled-members-list">
                <h4>Bu tarihe kayıtlı üyeler ({selectedTimeSlot === 'morning' ? 'Sabah' : 'Akşam'}):</h4>
                <ul>
                  {membersForSelectedDate.map(member => (
                    <li key={member.id}>{member.name} {member.surname}</li>
                  ))}
                </ul>
              </div>
            )}
            {!loadingMembersForDate && !fetchMembersError && selectedTimeSlot && membersForSelectedDate.length === 0 && (
              <p>Seçilen tarih ve zaman dilimi için kayıtlı üye bulunmamaktadır.</p>
            )}
            {!selectedTimeSlot && (
              <p>Lütfen ders üyelerini görmek için bir zaman dilimi seçin.</p>
            )}
          </div>
        ) : (
          <p>Lütfen takvimden bir tarih seçin.</p>
        )}
      </div>
      <MemberSelectModal
        isVisible={showMemberSelectModal}
        onClose={handleCloseMemberSelectModal}
        onSave={handleSaveLesson}
        existingSelectedMemberIds={membersForSelectedDate.map(m => m.id)}
      />
    </div>
  );
};

export default CalendarManagement;