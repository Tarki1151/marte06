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
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'morning' | 'evening' | null>(null); // Seçilen zaman dilimi state'i
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false);
  const [membersForSelectedDate, setMembersForSelectedDate] = useState<Member[]>([]);
  const [loadingMembersForDate, setLoadingMembersForDate] = useState(false);
  const [fetchMembersError, setFetchMembersError] = useState<string | null>(null);

  // --- Data Fetching Logic --- //
  const fetchMembersForDate = useCallback(async (date: Date, timeSlot: 'morning' | 'evening') => {
      setLoadingMembersForDate(true);
      setFetchMembersError(null);
      setMembersForSelectedDate([]); // Clear previous data

      try {
        // Calculate the specific time (10:00 or 16:00 UTC) for the selected date and time slot
        const lessonTimeUTC = new Date(Date.UTC(
            date.getFullYear(), 
            date.getMonth(), 
            date.getDate(), 
            timeSlot === 'morning' ? 10 : 16, // 10:00 UTC for morning, 16:00 UTC for evening
            0, 0, 0
        ));

        const lessonsRef = collection(db, 'lessons');
        // Query for the lesson entry matching the specific date and time slot
        const q = query(
          lessonsRef,
          where('date', '==', lessonTimeUTC), // Query for exact timestamp
          where('timeSlot', '==', timeSlot) // Query for time slot
        );

        const querySnapshot = await getDocs(q);

        let memberIdsForThisLesson: string[] = [];
        if (!querySnapshot.empty) {
          // Assuming only one lesson entry per date and time slot
          const lessonData = querySnapshot.docs[0].data();
          memberIdsForThisLesson = lessonData.memberIds || [];
        }

        if (memberIdsForThisLesson.length > 0) {
            const allMembersSnapshot = await getDocs(collection(db, 'members'));
            const allMembers: Member[] = allMembersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as Omit<Member, 'id'>
            }));
            const scheduledMembers = allMembers.filter(member => memberIdsForThisLesson.includes(member.id));
            scheduledMembers.sort((a, b) => a.name.localeCompare(b.name));
            setMembersForSelectedDate(scheduledMembers);

        } else {
          setMembersForSelectedDate([]); // No members scheduled for this time slot
        }

      } catch (error: any) {
        console.error('Üyeleri seçilen tarih ve zaman dilimi için çekme hatası:', error);
        setFetchMembersError('Ders üyeleri yüklenirken bir hata oluştu: ' + error.message);
        setMembersForSelectedDate([]);
      } finally {
        setLoadingMembersForDate(false);
      }
  }, [db]);
  // --- End Data Fetching Logic --- //


  // Automatically select today's date on initial load
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day for selectedDate state
    setSelectedDate(today);
    // Don't fetch here, wait for time slot selection or default
  }, []);

  // Fetch members when selectedDate or selectedTimeSlot changes
  useEffect(() => {
      // Only fetch if a date and time slot are selected
      if (selectedDate && selectedTimeSlot) {
          fetchMembersForDate(selectedDate, selectedTimeSlot);
      } else {
          setMembersForSelectedDate([]); // Clear list if date or time slot is not selected
      }
  }, [selectedDate, selectedTimeSlot, fetchMembersForDate]); // Dependencies


  // Calendar bileşeninden gelen tarih seçimini işleyen fonksiyon
  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
    console.log('Takvimde seçilen tarih:', date);
    // selectedTimeSlot will remain, triggering the useEffect to fetch if a slot is already selected
  };

  // Function to select a time slot and trigger fetch
  const handleTimeSlotSelect = (timeSlot: 'morning' | 'evening') => {
      setSelectedTimeSlot(timeSlot);
      console.log('Zaman dilimi seçildi:', timeSlot);
      // The useEffect watching selectedDate and selectedTimeSlot will handle fetching
  };


  // Function to open the member selection modal
  const handleAddLessonClick = () => {
    // Only allow adding lesson if a date and time slot are selected
    if (selectedDate && selectedTimeSlot) {
        setShowMemberSelectModal(true);
    } else {
        alert('Lütfen ders eklemek için önce bir tarih ve zaman dilimi seçin.');
    }
  };

  // Function to close the member selection modal
  const handleCloseMemberSelectModal = () => {
    setShowMemberSelectModal(false);
    // After closing modal, re-fetch the displayed list for the date and time slot
    if (selectedDate && selectedTimeSlot) {
         fetchMembersForDate(selectedDate, selectedTimeSlot); // Re-fetch members
    }
  };

  // Function to handle saving selected members to Firestore for the selected date and time slot
  const handleSaveLesson = async (selectedMemberIds: string[]) => {
       // Cannot save if no date or time slot is selected
       if (!selectedDate || !selectedTimeSlot) return;

       setLoadingMembersForDate(true);
       setFetchMembersError(null);

       try {
           // Calculate the specific time (10:00 or 16:00 UTC) for saving
           const lessonTimeUTC = new Date(Date.UTC(
               selectedDate.getFullYear(), 
               selectedDate.getMonth(), 
               selectedDate.getDate(), 
               selectedTimeSlot === 'morning' ? 10 : 16, 
               0, 0, 0
           ));

           const lessonsRef = collection(db, 'lessons');
           // Query to find the existing lesson document for this specific date and time slot
           const q = query(
             lessonsRef,
             where('date', '==', lessonTimeUTC), // Query for exact timestamp
             where('timeSlot', '==', selectedTimeSlot) // Query for time slot
           );

           const querySnapshot = await getDocs(q);

           let lessonDocRef;
           if (!querySnapshot.empty) {
               // If a lesson exists for this date and time slot, get its reference
               lessonDocRef = doc(db, 'lessons', querySnapshot.docs[0].id);
           } else {
               // If no lesson exists for this date and time slot, create a new document reference
               lessonDocRef = doc(collection(db, 'lessons'));
           }

           // Save or update the lesson document
           await setDoc(lessonDocRef, {
               date: lessonTimeUTC, // Save the specific timestamp (UTC)
               timeSlot: selectedTimeSlot, // Save the time slot
               memberIds: selectedMemberIds, // Save array of member IDs
               updatedAt: new Date(),
           }, { merge: true });

           console.log(\`Members saved for \${selectedDate.toLocaleDateString()} (\${selectedTimeSlot}):\`, selectedMemberIds);

           // Close modal and re-fetch
           handleCloseMemberSelectModal(); // This calls fetchMembersForDate(selectedDate, selectedTimeSlot);

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

      {/* Seçilen Tarih ve Zaman Dilimi Bilgisi ve Kontrolleri */}
      <div className="selected-date-info card"> {/* Added .card class */} 
        {selectedDate ? (
          <div className="date-details-container"> {/* Container for date/time details and list */} 
            <h3>Seçilen Tarih: {selectedDate.toLocaleDateString()}</h3>

            {/* Zaman Dilimi Seçimi Butonları */}
            <div className="time-slot-buttons"> {/* CSS için class */} 
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

            {/* Add Lesson Button (appears after loading and if no error and time slot is selected) */}
            {!loadingMembersForDate && !fetchMembersError && selectedTimeSlot && (
                 <button onClick={handleAddLessonClick} className="add-lesson-button">Ders Üyelerini Seç</button>
            )}

            {/* Loading or Error for members for date and time slot */}
            {loadingMembersForDate && <p>Üyeler yükleniyor...</p>}
            {fetchMembersError && <p style={{ color: 'red' }}>{fetchMembersError}</p>}

            {/* Display list of members already scheduled for the selected date and time slot */}
            {!loadingMembersForDate && !fetchMembersError && selectedTimeSlot && membersForSelectedDate.length > 0 && (
                <div className="scheduled-members-list"> {/* CSS class for scheduled members list */} 
                     <h4>Bu tarihe kayıtlı üyeler ({selectedTimeSlot === 'morning' ? 'Sabah' : 'Akşam'}):</h4>
                    <ul>
                        {membersForSelectedDate.map(member => (
                            <li key={member.id}>{member.name} {member.surname}</li>
                        ))}
                    </ul>
                </div>
            )}
             {!loadingMembersForDate && !fetchMembersError && selectedTimeSlot && membersForSelectedDate.length === 0 && selectedDate && (
                 <p>Seçilen tarih ve zaman dilimi için kayıtlı üye bulunmamaktadır.</p>
             )}
              {!selectedTimeSlot && (
                  <p>Lütfen ders üyelerini görmek için bir zaman dilimi seçin.</p>
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
          // Pass current selected members for this date and time slot to pre-select in the modal
          existingSelectedMemberIds={membersForSelectedDate.map(m => m.id)} 
          // Pass selected date and time slot to the modal (if needed for context in modal logic, though not strictly required for selection) 
          // selectedDate={selectedDate} 
          // selectedTimeSlot={selectedTimeSlot}
      />
    </div>
  );
};

export default CalendarManagement;
