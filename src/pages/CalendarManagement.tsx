import React, { useState, useEffect, useCallback } from 'react';
import Calendar from '../components/Calendar';
import './CalendarManagement.css';
import type { Member } from '../components/MemberList';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CalendarManagement: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
    const [membersForSelectedDate, setMembersForSelectedDate] = useState<Member[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [loadingLessons, setLoadingLessons] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]);

    // Fetch all members on component mount
    useEffect(() => {
        const fetchAllMembers = async () => {
            setLoadingMembers(true);
            try {
                const membersCollection = collection(db, 'members');
                const membersSnapshot = await getDocs(membersCollection);
                const membersList: Member[] = membersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data() as Omit<Member, 'id'>,
                }));
                setMembers(membersList);
            } catch (error: any) {
                console.error('Error fetching members:', error);
                setSaveError('Üyeler yüklenirken bir hata oluştu: ' + error.message);
            } finally {
                setLoadingMembers(false);
            }
        };

        fetchAllMembers();
    }, []);


    // Fetch members for selected date and time slot
    const fetchMembersForDate = useCallback(async (date: Date, timeSlot: string) => {
        setLoadingLessons(true);
        setSaveError(null);
        setMembersForSelectedDate([]);

        try {
            // Convert selectedDate to UTC
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
            const memberIds: string[] = [];

            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.memberIds && Array.isArray(data.memberIds)) {
                    memberIds.push(...data.memberIds);
                }
            });

            const scheduledMembers = members.filter(member => memberIds.includes(member.id));
            setMembersForSelectedDate(scheduledMembers);

        } catch (error: any) {
            console.error('Ders üyelerini çekerken hata oluştu:', error);
            setSaveError('Ders üyelerini çekerken bir hata oluştu: ' + error.message);
            setMembersForSelectedDate([]);
        } finally {
            setLoadingLessons(false);
        }
    }, [members]);

    // Run fetchMembersForDate when selectedDate or selectedTimeSlot changes
    useEffect(() => {
        if (selectedDate && selectedTimeSlot) {
            fetchMembersForDate(selectedDate, selectedTimeSlot);
        }
    }, [selectedDate, selectedTimeSlot, fetchMembersForDate]);

    // Handle date selection
    const handleDateSelect = (date: Date | null) => {
        if (date) {
            setSelectedDate(date);
        }
    };

    // Handle time slot selection
    const handleTimeSlotSelect = (timeSlot: string) => {
        setSelectedTimeSlot(timeSlot);
    };

    // Handle saving lesson
    const handleSaveLesson = async (selectedMemberIds: string[]) => {
        if (!selectedDate || !selectedTimeSlot) {
            setSaveError('Lütfen bir tarih ve zaman dilimi seçin.');
            return;
        }

        setLoadingLessons(true);
        setSaveError(null);

        try {
            // Convert selectedDate to UTC
            const lessonTimeUTC = new Date(Date.UTC(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                selectedTimeSlot === 'morning' ? 10 : 16,
                0, 0, 0
            ));

            const lessonsRef = collection(db, 'lessons');

            // Check if a lesson already exists for this date and time slot
            const q = query(
                lessonsRef,
                where('date', '==', lessonTimeUTC),
                where('timeSlot', '==', selectedTimeSlot)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // A lesson already exists, so update it instead of creating a new one
                const lessonDoc = querySnapshot.docs[0];
                await setDoc(doc(db, 'lessons', lessonDoc.id), {
                    date: lessonTimeUTC,
                    timeSlot: selectedTimeSlot,
                    memberIds: selectedMemberIds,
                    updatedAt: serverTimestamp(),
                });
                console.log('Ders güncellendi');
            } else {
                // No lesson exists, so create a new one
                await setDoc(doc(lessonsRef), {
                    date: lessonTimeUTC,
                    timeSlot: selectedTimeSlot,
                    memberIds: selectedMemberIds,
                    createdAt: serverTimestamp(),
                });
                console.log('Ders kaydedildi');
            }

            // Refresh the member list after saving
            fetchMembersForDate(selectedDate, selectedTimeSlot);

        } catch (error: any) {
            console.error('Ders kaydetme hatası:', error);
            setSaveError('Ders kaydedilirken bir hata oluştu: ' + error.message);
        } finally {
            setLoadingLessons(false);
        }
    };

    // Toggle member selection. This could be improved for larger lists
    const toggleMemberSelection = (memberId: string) => {
        setMembersForSelectedDate(prev => {
            if (prev.find(m => m.id === memberId)) {
                return prev.filter(m => m.id !== memberId);
            } else {
                const memberToAdd = members.find(m => m.id === memberId);
                return memberToAdd ? [...prev, memberToAdd] : prev;
            }
        });
    };

    // Check if a member is selected for UI indication
    const isMemberSelected = (memberId: string) => {
        return membersForSelectedDate.some(member => member.id === memberId);
    };


    return (
        <div className="calendar-management-page">
            <div className="page-header">
                <h2>Takvim Yönetimi</h2>
            </div>
            <Calendar onDateSelect={handleDateSelect} selectedDate={selectedDate} />
            <div className="selected-date-info card">
                <h3>Seçilen Tarih: {selectedDate.toLocaleDateString()}</h3>
                <div className="time-slot-buttons">
                    <button
                        onClick={() => handleTimeSlotSelect('morning')}
                        disabled={loadingLessons}
                        className={selectedTimeSlot === 'morning' ? 'selected' : ''}
                    >
                        Sabah (10:00)
                    </button>
                    <button
                        onClick={() => handleTimeSlotSelect('evening')}
                        disabled={loadingLessons}
                        className={selectedTimeSlot === 'evening' ? 'selected' : ''}
                    >
                        Akşam (16:00)
                    </button>
                </div>

                {selectedTimeSlot && (
                    <>
                        <h4>Üyeler:</h4>
                        {loadingMembers ? (
                            <p>Üyeler yükleniyor...</p>
                        ) : saveError ? (
                            <p style={{ color: 'red' }}>{saveError}</p>
                        ) : (
                            <ul className="member-list">
                                {members.map(member => (
                                    <li key={member.id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                value={member.id}
                                                checked={isMemberSelected(member.id)}
                                                onChange={() => toggleMemberSelection(member.id)}
                                                disabled={loadingLessons}
                                            />
                                            {member.name} {member.surname}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button onClick={() => handleSaveLesson(membersForSelectedDate.map(m => m.id))}
                            disabled={loadingLessons || !selectedTimeSlot}
                        >
                            {loadingLessons ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </>
                )}

                {saveError && <p style={{ color: 'red' }}>{saveError}</p>}
            </div>
        </div>
    );
};

export default CalendarManagement;