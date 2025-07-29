import React, { useState, useEffect, useCallback } from 'react';
import './Reports.css'; // Sayfaya özgü stiller için
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Member } from '../components/MemberList';

const Reports: React.FC = () => {
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [attendanceData, setAttendanceData] = useState<{
        date: Date;
        timeSlot: string;
    }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]); // Tüm üyeleri tutacak state

    // New state variables for month and year selection
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-indexed
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
     // New state variables for date range selection
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [useDateRange, setUseDateRange] = useState(false);
    const [totalLessons, setTotalLessons] = useState<number>(0); // Toplam ders sayısı

    // Options for month selection
    const monthOptions = [
        { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
        { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
        { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
        { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' },
    ];

    // Generate years for the select dropdown (e.g., last 10 years)
    const generateYearOptions = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear; i >= currentYear - 10; i--) {
            years.push(i);
        }
        return years;
    };

    const yearOptions = generateYearOptions();


    useEffect(() => {
        const fetchAllMembers = async () => {
            setLoading(true);
            setError(null);
            try {
                const membersCollection = collection(db, 'members');
                const membersSnapshot = await getDocs(membersCollection);
                const membersList: Member[] = membersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data() as Omit<Member, 'id'>,
                }));
                setMembers(membersList);
            } catch (e: any) {
                console.error('Üyeleri çekerken hata oluştu:', e.message);
                setError('Üyeleri yüklerken bir hata oluştu: ' + e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAllMembers();
    }, []);


    const fetchAttendanceData = useCallback(async (memberId: string, month: number, year: number, startDate: string | null = null, endDate: string | null = null) => {
        setLoading(true);
        setError(null);
        setAttendanceData([]);
        setTotalLessons(0);

        try {
            const lessonsRef = collection(db, 'lessons');
            let q = query(lessonsRef, where('memberIds', 'array-contains', memberId));

            if (useDateRange && startDate && endDate) {
                // Use date range
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);

                q = query(
                    lessonsRef,
                    where('memberIds', 'array-contains', memberId),
                    where('date', '>=', Timestamp.fromDate(startDateObj)),
                    where('date', '<=', Timestamp.fromDate(endDateObj))
                );
            } else {
                // Use month and year
                const startDateUTC = new Date(Date.UTC(year, month - 1, 1)); // Month is 0-indexed in Date
                const endDateUTC = new Date(Date.UTC(year, month, 1)); // First day of the next month

                q = query(
                    lessonsRef,
                    where('memberIds', 'array-contains', memberId),
                    where('date', '>=', Timestamp.fromDate(startDateUTC)),
                    where('date', '<', Timestamp.fromDate(endDateUTC))
                );
            }

            const querySnapshot = await getDocs(q);
            const attendanceList: { date: Date; timeSlot: string }[] = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    date: (data.date as any)?.toDate(), // Firestore Timestamp'i Date objesine çevir
                    timeSlot: data.timeSlot,
                };
            });

            setAttendanceData(attendanceList);
            setTotalLessons(attendanceList.length);

        } catch (e: any) {
            console.error('Katılım verisi çekme hatası:', e.message);
            setError('Katılım verisi yüklenirken bir hata oluştu: ' + e.message);
            setAttendanceData([]);
            setTotalLessons(0);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleMemberSelect = (member: Member) => {
        setSelectedMember(member);
        // Fetch attendance data for the selected member and month/year
        fetchAttendanceData(member.id, selectedMonth, selectedYear, startDate, endDate);
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const month = parseInt(e.target.value);
        setSelectedMonth(month);
        if (selectedMember) {
            fetchAttendanceData(selectedMember.id, month, selectedYear, startDate, endDate);
        }
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const year = parseInt(e.target.value);
        setSelectedYear(year);
        if (selectedMember) {
            fetchAttendanceData(selectedMember.id, selectedMonth, year, startDate, endDate);
        }
    };

     const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
        if (selectedMember) {
            fetchAttendanceData(selectedMember.id, selectedMonth, selectedYear, e.target.value, endDate);
        }
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(e.target.value);
        if (selectedMember) {
            fetchAttendanceData(selectedMember.id, selectedMonth, selectedYear, startDate, e.target.value);
        }
    };

    const handleUseDateRangeToggle = () => {
        setUseDateRange(!useDateRange);
        // Clear month and year selections and fetch data based on date range (if available)
        setSelectedMonth(new Date().getMonth() + 1);
        setSelectedYear(new Date().getFullYear());

        if (selectedMember) {
            fetchAttendanceData(selectedMember.id, selectedMonth, selectedYear, startDate, endDate);
        }
    };

    // Function to format date and time slot
    const formatAttendance = (date: Date, timeSlot: string) => {
        const formattedDate = date.toLocaleDateString();
        const timeSlotDisplay = timeSlot === 'morning' ? 'SBH' : 'AKS';
        return `${formattedDate} (${timeSlotDisplay})`;
    };

    return (
        <div className="reports-page"> {/* Ana konteyner */}
            <div className="page-header"> {/* Başlık için container */}
                <h2>Raporlama</h2>
            </div>

            {/* Üye Seçim Alanı */}
            <div className="member-selection card"> {/* .card class'ı eklendi */} 
                <h3>Üye Seç</h3>
                <select
                    onChange={(e) => {
                        const selectedId = e.target.value;
                        const member = members.find(m => m.id === selectedId);
                        if (member) {
                            handleMemberSelect(member);
                        }
                    }}
                    value={selectedMember ? selectedMember.id : ''}
                >
                    <option value="">-- Üye Seçin --</option>
                    {members.map(member => (
                        <option key={member.id} value={member.id}>
                            {member.name} {member.surname}
                        </option>
                    ))}
                </select>
                {loading && <p>Üyeler yükleniyor...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
            </div>

             {/* Tarih Aralığı Seçim Alanı */}
            <div className="date-range-selection card"> {/* .card class'ı eklendi */} 
                <h3>Tarih Aralığı Seç</h3>
                 <label>
                    <input
                        type="checkbox"
                        checked={useDateRange}
                        onChange={handleUseDateRangeToggle}
                    />
                    Özel Tarih Aralığı Kullan
                </label>

                {useDateRange ? (
                     <>
                        <label htmlFor="startDate">Başlangıç Tarihi:</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate || ''}
                            onChange={handleStartDateChange}
                        />

                        <label htmlFor="endDate">Bitiş Tarihi:</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDate || ''}
                            onChange={handleEndDateChange}
                        />
                    </>
                ) : (
                    <div className="month-year-selection"> {/* .card class'ı eklendi */} 
                        <label htmlFor="month">Ay:</label>
                        <select 
                            id="month" 
                            value={selectedMonth} 
                            onChange={handleMonthChange}
                            disabled={useDateRange} // Disable when using date range
                        >
                            {monthOptions.map(month => (
                                <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                        </select>

                        <label htmlFor="year">Yıl:</label>
                        <select 
                            id="year" 
                            value={selectedYear} 
                            onChange={handleYearChange}
                            disabled={useDateRange} // Disable when using date range
                        >
                            {yearOptions.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Katılım Verisi Alanı */}
            {selectedMember && (
                <div className="attendance-data card"> {/* .card class'ı eklendi */} 
                    <h4>{selectedMember.name} {selectedMember.surname} Katılım Geçmişi ({useDateRange ? `${startDate} - ${endDate}` : `${monthOptions.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}):</h4>
                    <p>Toplam Ders Sayısı: {totalLessons}</p>
                    {loading ? (
                        <p>Katılım verisi yükleniyor...</p>
                    ) : error ? (
                        <p style={{ color: 'red' }}>{error}</p>
                    ) : attendanceData.length > 0 ? (
                        <ul>
                            {attendanceData.map((attendance, index) => (
                                <li key={index}>{formatAttendance(attendance.date, attendance.timeSlot)}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>Bu üyenin bu ay içinde katılım verisi bulunmamaktadır.</p>
                    )}
                </div>
            )}

            {/* MonthlyAttendanceReport bileşeni kaldırıldı */}        
        </div>
    );
};

export default Reports;