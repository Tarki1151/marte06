// src/components/MonthlyAttendanceReport.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Member } from './MemberList.tsx'; // Member interface'ini import et
import './MonthlyAttendanceReport.css'; // CSS dosyası

// Helper function to format Date to YYYY-MM-DD string for input type='date'
const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper function to get the start of the current month in YYYY-MM-DD format
const getStartOfCurrentMonth = (): string => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return formatDateToYYYYMMDD(startOfMonth);
};

// Helper function to get the end of the current month in YYYY-MM-DD format
const getEndOfCurrentMonth = (): string => {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return formatDateToYYYYMMDD(endOfMonth);
};

// Helper function to format Timestamp to a readable date string
const formatTimestampToDateString = (timestamp: Timestamp): string => {
    if (!timestamp || !timestamp.toDate) return 'Geçersiz Tarih';
    const date = timestamp.toDate();
    return date.toLocaleDateString(); // Veya istediğiniz başka bir format
};

const MonthlyAttendanceReport: React.FC = () => {
  const [viewMode, setViewMode] = useState<'monthly' | 'range'>('monthly'); // Varsayılan olarak aylık rapor

  // Aylık rapor için ay ve yıl state'leri
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Tarih aralığı state'leri (string olarak)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [attendanceData, setAttendanceData] = useState<{ member: Member; attendanceCount: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<{ member: Member; attendanceCount: number } | null>(null); // Detay için seçilen üye state'i
  const [memberAttendanceDetails, setMemberAttendanceDetails] = useState<{ date: Timestamp }[]>([]); // Seçilen üyenin katılım detayları
  const [loadingMemberDetails, setLoadingMemberDetails] = useState(false);
  const [memberDetailsError, setMemberDetailsError] = useState<string | null>(null);

   // Helper function to generate years for selection
  const generateReportYears = () => {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let i = currentYear; i >= currentYear - 10; i--) {
          years.push(i);
      }
      return years;
  };

   const years = generateReportYears();
    const months = [
        { value: 1, label: 'Ocak' }, { value: 2, label: 'Şubat' }, { value: 3, label: 'Mart' },
        { value: 4, label: 'Nisan' }, { value: 5, label: 'Mayıs' }, { value: 6, label: 'Haziran' },
        { value: 7, label: 'Temmuz' }, { value: 8, label: 'Ağustos' }, { value: 9, label: 'Eylül' },
        { value: 10, label: 'Ekim' }, { value: 11, label: 'Kasım' }, { value: 12, label: 'Aralık' },
    ];

  // Ana rapor verisini çekme fonksiyonu (tarih aralığına göre)
  const fetchAttendanceReport = async (start: string, end: string) => {
      if (!start || !end) {
          setAttendanceData([]);
           setSelectedMemberForDetail(null); // Tarih aralığı temizlenince detay görünümünü kapat
           setMemberAttendanceDetails([]);
          return;
      }

      setLoading(true);
      setError(null);
      setAttendanceData([]);
       setSelectedMemberForDetail(null); // Yeni rapor çekilirken detay görünümünü kapat
       setMemberAttendanceDetails([]);

      try {
          const startDateObj = new Date(start);
          const endDateObj = new Date(end);

          const startOfStartDateUTC = new Date(Date.UTC(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), 0, 0, 0, 0));
          const startOfNextDayOfEndDateUTC = new Date(Date.UTC(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate() + 1, 0, 0, 0, 0));

          const lessonsRef = collection(db, 'lessons');
          const q = query(
              lessonsRef,
              where('date', '>=', startOfStartDateUTC),
              where('date', '<', startOfNextDayOfEndDateUTC)
          );

          const querySnapshot = await getDocs(q);

          const attendanceCounts: { [memberId: string]: number } = {};
          const memberIdsInDateRange: string[] = [];

          querySnapshot.docs.forEach(doc => {
              const lessonData = doc.data();
              const attendingMemberIds: string[] = lessonData.memberIds || [];
              attendingMemberIds.forEach(memberId => {
                  attendanceCounts[memberId] = (attendanceCounts[memberId] || 0) + 1;
                  if (!memberIdsInDateRange.includes(memberId)) {
                      memberIdsInDateRange.push(memberId);
                  }
              });
          });

          let membersWithAttendance: { member: Member; attendanceCount: number }[] = [];
          if (memberIdsInDateRange.length > 0) {
               const allMembersSnapshot = await getDocs(collection(db, 'members'));
               const allMembers: Member[] = allMembersSnapshot.docs.map(doc => ({
                   id: doc.id,
                   ...doc.data() as Omit<Member, 'id'>
               }));

               membersWithAttendance = memberIdsInDateRange.map(memberId => {
                   const member = allMembers.find(m => m.id === memberId);
                   return member ? { member: member, attendanceCount: attendanceCounts[memberId] } : null;
               }).filter(item => item !== null) as { member: Member; attendanceCount: number }[];

               membersWithAttendance.sort((a, b) => a.member.name.localeCompare(b.member.name));
          }

          setAttendanceData(membersWithAttendance);

      } catch (error: any) {
          console.error('Katılım raporu çekme hatası:', error);
          setError('Katılım verileri yüklenirken bir hata oluştu: ' + error.message);
          setAttendanceData([]);
      } finally {
          setLoading(false);
      }
  };

    // Seçilen üye için katılım detaylarını çekme fonksiyonu
    const fetchMemberAttendanceDetails = async (memberId: string, start: string, end: string) => {
        if (!memberId || !start || !end) {
            setMemberAttendanceDetails([]);
            return;
        }

        setLoadingMemberDetails(true);
        setMemberDetailsError(null);
        setMemberAttendanceDetails([]);

        try {
             const startDateObj = new Date(start);
            const endDateObj = new Date(end);

            const startOfStartDateUTC = new Date(Date.UTC(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), 0, 0, 0, 0));
            const startOfNextDayOfEndDateUTC = new Date(Date.UTC(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate() + 1, 0, 0, 0, 0));

            // Firestore'dan ilgili üyenin ve tarih aralığının kesişimindeki ders kayıtlarını çek
            const lessonsRef = collection(db, 'lessons');
             const q = query(
                 lessonsRef,
                 where('date', '>=', startOfStartDateUTC),
                 where('date', '<', startOfNextDayOfEndDateUTC),
                 where('memberIds', 'array-contains', memberId) // memberIds dizisi memberId'yi içeriyor mu?
             );

             const querySnapshot = await getDocs(q);

             const attendanceDates: { date: Timestamp }[] = querySnapshot.docs.map(doc => ({
                 date: doc.data().date as Timestamp // Sadece tarih bilgisini al
             }));

             // Tarihleri sırala (isteğe bağlı)
             attendanceDates.sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());

            setMemberAttendanceDetails(attendanceDates);

        } catch (error: any) {
            console.error('Üye katılım detayları çekme hatası:', error);
            setMemberDetailsError('Üye katılım detayları yüklenirken bir hata oluştu: ' + error.message);
            setMemberAttendanceDetails([]);
        } finally {
            setLoadingMemberDetails(false);
        }
    };

  // Veriyi çekme: viewMode veya ilgili tarih state'leri değiştiğinde
  useEffect(() => {
      if (viewMode === 'monthly') {
          const calculatedStartOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
          const calculatedEndOfMonth = new Date(selectedYear, selectedMonth, 0);

          fetchAttendanceReport(formatDateToYYYYMMDD(calculatedStartOfMonth), formatDateToYYYYMMDD(calculatedEndOfMonth));

      } else if (viewMode === 'range') {
          fetchAttendanceReport(startDate, endDate);
      }
       // ViewMode veya tarih aralığı değiştiğinde detay görünümünü kapat
        setSelectedMemberForDetail(null);
        setMemberAttendanceDetails([]);

  }, [viewMode, selectedMonth, selectedYear, startDate, endDate]); // Tüm ilgili state'ler dependency array'inde

    // Seçilen üye veya tarih aralığı değiştiğinde üye katılım detaylarını çek
    useEffect(() => {
        if (selectedMemberForDetail && (startDate || (viewMode === 'monthly' && selectedMonth))) { // Eğer üye seçiliyse ve bir tarih aralığı (veya ay/yıl) belirlenmişse

             let startFetchDate = startDate;
             let endFetchDate = endDate;

             if (viewMode === 'monthly') {
                 const calculatedStartOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
                 const calculatedEndOfMonth = new Date(selectedYear, selectedMonth, 0);
                 startFetchDate = formatDateToYYYYMMDD(calculatedStartOfMonth);
                 endFetchDate = formatDateToYYYYMMDD(calculatedEndOfMonth);
             }

            if (startFetchDate && endFetchDate) { // Tarihler geçerliyse çek
                fetchMemberAttendanceDetails(selectedMemberForDetail.member.id, startFetchDate, endFetchDate);
            }
        } else {
             setMemberAttendanceDetails([]); // Üye seçilmediyse veya tarih aralığı yoksa detayları temizle
        }
    }, [selectedMemberForDetail, startDate, endDate, selectedMonth, selectedYear, viewMode]); // İlgili state'ler dependency array'inde

  // View mode değiştirme fonksiyonu
  const toggleViewMode = () => {
      setViewMode(viewMode === 'monthly' ? 'range' : 'monthly');
       // Görünüm değiştiğinde tarih aralığı inputlarını temizle ve aylık varsayılanı ayarla
       setStartDate('');
       setEndDate('');
        setSelectedMonth(new Date().getMonth() + 1);
        setSelectedYear(new Date().getFullYear());
        // Detay görünümünü kapat
       setSelectedMemberForDetail(null);
       setMemberAttendanceDetails([]);
  };

    // Ana katılım listesindeki bir üyeye tıklama handler'ı
    const handleMemberClick = (item: { member: Member; attendanceCount: number }) => {
        setSelectedMemberForDetail(item); // Tıklanan üyeyi detay için kaydet
        // useEffect, selectedMemberForDetail değişince detayları çekecek
    };

    // Detay görünümünü kapatma butonu handler'ı
    const handleCloseDetail = () => {
        setSelectedMemberForDetail(null); // Detay için seçilen üyeyi temizle
        setMemberAttendanceDetails([]); // Detay listesini temizle
    };

  return (
    <div className="monthly-attendance-report card"> {/* .card class'ı kullanıldı */} 
      <h3>Katılım Raporu</h3> {/* Başlık genel yapıldı */} 

      {/* Rapor Kontrolleri (Ay/Yıl veya Tarih Aralığı ve Mod Seçimi) */}
      <div className="report-controls"> {/* CSS için class */}

        {viewMode === 'monthly' ? (
          <> {/* Aylık görünümde ay ve yıl seçimi */}
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
              {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </>
        ) : (
          <> {/* Tarih aralığı görünümünde başlangıç ve bitiş tarihi inputları */}
            <div>
                <label htmlFor="startDate">Başlangıç:</label>
                <input 
                    type="date" 
                    id="startDate" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="endDate">Bitiş:</label>
                <input 
                    type="date" 
                    id="endDate" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                />
            </div>
          </>
        )}

        {/* Görünüm Modu Değiştirme Düğmesi */}
        <button onClick={toggleViewMode} className="toggle-view-button"> {/* CSS için class */} 
            {viewMode === 'monthly' ? 'Özel Aralık Seç' : 'Aylık Rapora Dön'}
        </button>

      </div>

      {/* Ana Katılım Listesi veya Üye Detay Görünümü */}
      {!selectedMemberForDetail ? (
          <> {/* Üye seçilmediyse ana katılım listesini göster */}
              {/* Loading veya Hata Mesajları */}
              {loading && <p>Rapor yükleniyor...</p>}
              {error && <p style={{ color: 'red' }}>{error}</p>}

              {/* Katılım Listesi veya Veri Yok Mesajı */}
              {!loading && !error && (
                  attendanceData.length > 0 ? (
                    <div className="attendance-list"> {/* CSS için class */}
                      <h4>Katılım Detayları:</h4>
                      <ul>
                        {/* Her li elementini tıklanabilir yap ve handleMemberClick'i bağla */} 
                        {attendanceData.map(item => (
                          <li key={item.member.id} onClick={() => handleMemberClick(item)} className="attendance-list-item clickable"> {/* Class eklendi */} 
                            {item.member.name} {item.member.surname}: {item.attendanceCount} Ders
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                      // Veri yok mesajı (hangi moda göre gösterileceği ayarlanabilir)
                      viewMode === 'monthly' && (selectedMonth && selectedYear) ? (
                          <p>Seçilen ay için katılım verisi bulunmamaktadır.</p>
                      ) : viewMode === 'range' && (startDate && endDate) ? (
                           <p>Seçilen tarih aralığı için katılım verisi bulunmamaktadır.</p>
                      ) : (
                           <p>Lütfen raporlamak istediğiniz dönemi seçin.</p>
                      )
                  )
              )}
          </>
      ) : (
          <> {/* Üye seçildiyse detay görünümünü göster */}
            <div className="member-detail-report"> {/* CSS için class */}
                <h4>{selectedMemberForDetail.member.name} {selectedMemberForDetail.member.surname} - Katılım Detayları</h4>
                 <p>Seçilen Tarih Aralığı: {startDate || formatDateToYYYYMMDD(new Date(selectedYear, selectedMonth -1, 1))} - {endDate || formatDateToYYYYMMDD(new Date(selectedYear, selectedMonth, 0))}</p> {/* Tarih aralığını göster */} 

                {/* Loading veya Hata Mesajları (Detay) */}
                {loadingMemberDetails && <p>Katılım detayları yükleniyor...</p>}
                {memberDetailsError && <p style={{ color: 'red' }}>{memberDetailsError}</p>}

                {/* Katılım Tarihleri Listesi */}
                {!loadingMemberDetails && !memberDetailsError && memberAttendanceDetails.length > 0 ? (
                    <div className="attendance-dates-list"> {/* CSS için class */}
                        <h5>Katıldığı Ders Tarihleri:</h5>
                        <ul>
                            {memberAttendanceDetails.map((detail, index) => (
                                <li key={index}>{formatTimestampToDateString(detail.date)}</li>
                            ))}
                        </ul>
                    </div>
                ) : !loadingMemberDetails && !memberDetailsError && (
                    <p>Seçilen tarih aralığında bu üyeye ait katılım detayı bulunmamaktadır.</p>
                )}

                <button onClick={handleCloseDetail} className="close-detail-button">Listeye Geri Dön</button> {/* CSS için class */}
            </div>
          </>
      )}


    </div>
  );
};

export default MonthlyAttendanceReport;
