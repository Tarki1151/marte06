// src/pages/CalendarManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Calendar from '../components/Calendar.tsx';
import './CalendarManagement.css';

// Import member interface
import type { Member } from '../components/MemberList.tsx';

import MemberSelectModal from '../components/MemberSelectModal.tsx';

// Firestore imports for data fetching and saving
import { collection, query, where, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CalendarManagement: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false);
  const [membersForSelectedDate, setMembersForSelectedDate] = useState<Member[]>([]);
  const [loadingMembersForDate, setLoadingMembersForDate] = useState(false);
  const [fetchMembersError, setFetchMembersError] = useState<string | null>(null);

  // --- Data Fetching Logic --- //
  const fetchMembersForDate = useCallback(async (date: Date) => {
      setLoadingMembersForDate(true);
      setFetchMembersError(null);
      try {
        // Use UTC date for querying to avoid timezone issues
        const startOfSelectedDayUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
        const startOfNextDayUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0));

        const lessonsRef = collection(db, 'lessons');
        const q = query(
          lessonsRef,
          where('date', '>=', startOfSelectedDayUTC),
          where('date', '<', startOfNextDayUTC) // Strictly less than the start of the next day
        );

        const querySnapshot = await getDocs(q);

        let memberIdsForThisDate: string[] = [];
        if (!querySnapshot.empty) {
          const lessonData = querySnapshot.docs[0].data();
          memberIdsForThisDate = lessonData.memberIds || [];
        }

        if (memberIdsForThisDate.length > 0) {
            const allMembersSnapshot = await getDocs(collection(db, 'members'));
            const allMembers: Member[] = allMembersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as Omit<Member, 'id'>
            }));
            const scheduledMembers = allMembers.filter(member => memberIdsForThisDate.includes(member.id));
            scheduledMembers.sort((a, b) => a.name.localeCompare(b.name));
            setMembersForSelectedDate(scheduledMembers);

        } else {
          setMembersForSelectedDate([]);
        }

      } catch (error: any) {
        console.error('Üyeleri seçilen tarih için çekme hatası:', error);
        setFetchMembersError('Ders üyeleri yüklenirken bir hata oluştu: ' + error.message);
        setMembersForSelectedDate([]);
      } finally {
        setLoadingMembersForDate(false);
      }
  }, [db]); // db is a dependency as it's used inside fetchMembersForDate
  // --- End Data Fetching Logic --- //


  // Automatically select today's date on initial load and fetch members for that date
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    setSelectedDate(today);
    // Initial fetch for today's date
    fetchMembersForDate(today);
  }, [fetchMembersForDate]); // fetchMembersForDate is a dependency

  // Fetch members for the selected date whenever selectedDate changes
  useEffect(() => {
    // Only fetch if selectedDate is not null and is different from the date already fetched
    // We can compare date strings or timestamps to avoid unnecessary re-fetches.
    if (selectedDate) {
        // Check if the currently displayed members correspond to the selected date
        // (This is a simplification; a robust check would involve comparing the date used for the last fetch)
         const currentDisplayedDate = membersForSelectedDate.length > 0 && membersForSelectedDate[0].hasOwnProperty('lessonDate') 
             ? new Date((membersForSelectedDate[0] as any).lessonDate.toDate()).toDateString() // Assuming lessonDate is added to member objects for display
             : null;

         if (!currentDisplayedDate || selectedDate.toDateString() !== currentDisplayedDate) {
             fetchMembersForDate(selectedDate);
         }

    } else {
        setMembersForSelectedDate([]);
    }
  }, [selectedDate, fetchMembersForDate]); // selectedDate and fetchMembersForDate are dependencies


  // Calendar bileşeninden gelen tarih seçimini işleyen fonksiyon
  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
    console.log('Takvimde seçilen tarih:', date);
    // The useEffect watching selectedDate will handle fetching members for the new date.
  };

  // Function to open the member selection modal
  const handleAddLessonClick = () => {
    if (selectedDate) {
        setShowMemberSelectModal(true);
    }
  };

  // Function to close the member selection modal
  const handleCloseMemberSelectModal = () => {
    setShowMemberSelectModal(false);
    // After closing modal, re-fetch the displayed list for the date to show saved changes
    if (selectedDate) {
         fetchMembersForDate(selectedDate); // Re-fetch members for the current selected date
    }
  };

  // Function to handle saving selected members to Firestore for the selected date
  const handleSaveLesson = async (selectedMemberIds: string[]) => {
       if (!selectedDate) return;

       setLoadingMembersForDate(true);
       setFetchMembersError(null);

       try {
           // Use UTC date for saving to ensure consistency
           const dateToSave = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0));

           const lessonsRef = collection(db, 'lessons');
           const q = query(
             lessonsRef,
             where('date', '>=', dateToSave),
             where('date', '<', new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1, 0, 0, 0, 0))) // Strictly less than next day UTC
           );

           const querySnapshot = await getDocs(q);

           let lessonDocRef;
           if (!querySnapshot.empty) {
               lessonDocRef = doc(db, 'lessons', querySnapshot.docs[0].id);
           } else {
               lessonDocRef = doc(collection(db, 'lessons'));
           }

           await setDoc(lessonDocRef, {
               date: dateToSave, // Save date as Timestamp (UTC)
               memberIds: selectedMemberIds,
               updatedAt: new Date(),
           }, { merge: true });

           console.log('Members saved for date:', selectedDate.toLocaleDateString(), ', IDs:', selectedMemberIds);

           // Close modal and re-fetch
           handleCloseMemberSelectModal(); // This calls fetchMembersForDate(selectedDate);

       } catch (error: any) {
           console.error('Ders üyelerini kaydetme hatası:', error);
           setFetchMembersError('Ders üyeleri kaydedilirken bir hata oluştu: ' + error.message);
       } finally {
           setLoadingMembersForDate(false);
       }

  };

  return (
    <div className="calendar-management-page"> {/* Ana konteyner */}
      <div className="page-header"> {/* Başlık için container */}
        <h2>Takvim Yönetimi</h2>
      </div>

      {/* Takvim Bileşeni */}
      <Calendar onDateSelect={handleDateSelect} selectedDate={selectedDate} /> {/* Pass selectedDate to Calendar */} 

      {/* Seçilen Tarih Bilgisi ve Üye Listesi Alanı */}
      <div className="selected-date-info card"> {/* Added .card class */} 
        {selectedDate ? (
          <div className="date-details-container"> {/* Container for date details and list */} 
            <h3>Seçilen Tarih: {selectedDate.toLocaleDateString()}</h3>

            {/* Loading or Error for members for date */}
            {loadingMembersForDate && <p>Üyeler yükleniyor...</p>}
            {fetchMembersError && <p style={{ color: 'red' }}>{fetchMembersError}</p>}

            {/* Add Lesson Button (appears after loading and if no error) */}
            {!loadingMembersForDate && !fetchMembersError && (
                 <button onClick={handleAddLessonClick} className="add-lesson-button">Ders Üyelerini Seç</button>
            )}

            {/* Display list of members already scheduled */}
            {!loadingMembersForDate && !fetchMembersError && membersForSelectedDate.length > 0 && (
                <div className="scheduled-members-list"> {/* CSS class for scheduled members list */} 
                     <h4>Bu tarihe kayıtlı üyeler:</h4>
                    <ul>
                        {membersForSelectedDate.map(member => (
                            <li key={member.id}>{member.name} {member.surname}</li>
                        ))}
                    </ul>
                </div>
            )}
             {!loadingMembersForDate && !fetchMembersError && membersForSelectedDate.length === 0 && selectedDate && (
                 <p>Bu tarihe kayıtlı üye bulunmamaktadır.</p>
             )}

          </div>
        ) : (
          <p>Lütfen takvimden bir tarih seçin.</p> /* Tarih seçilmediyse göster */
        )}
      </div>

      {/* MemberSelectModal component */} 
      <MemberSelectModal
          isVisible={showMemberSelectModal}
          onClose={handleCloseMemberSelectModal}
          onSave={handleSaveLesson}
          // Pass current selected members for this date to pre-select in the modal
          existingSelectedMemberIds={membersForSelectedDate.map(m => m.id)} // Pass existing members
      />
    </div>
  );
};

export default CalendarManagement;
