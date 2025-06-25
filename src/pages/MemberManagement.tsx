// src/pages/MemberManagement.tsx
import React, { useState, useRef, useEffect } from 'react'; // useEffect eklendi
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

  // Form Scan States and Refs
  const [scanMethod, setScanMethod] = useState<'none' | 'file' | 'camera'>('none'); // 'none', 'file', 'camera'
  const [scannedMemberData, setScannedMemberData] = useState<ScannedFormData | null>(null); // Taranan form verisi state'i
  const [scanning, setScanning] = useState(false); // Tarama işlemi loading state'i
  const [scanError, setScanError] = useState<string | null>(null); // Tarama hatası state'i
  const fileInputRef = useRef<HTMLInputElement>(null); // Dosya inputu için ref
  const videoRef = useRef<HTMLVideoElement>(null); // Kamera video elementi için ref
  const canvasRef = useRef<HTMLCanvasElement>(null); // Fotoğraf çekmek için canvas ref
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null); // Kamera akışı state'i
  const [cameraEnabled, setCameraEnabled] = useState(false); // Kameranın etkin olup olmadığı state'i


  // Üye ekleme başarılı olunca tetiklenir
  const handleMemberAdded = () => {
    setShowAddForm(false); // Formu gizle
    setRefreshList(prev => !prev); // Listeyi yenile
    setEditingMember(null); // Düzenleme durumunu sıfırla
    setScannedMemberData(null); // Taranmış veriyi temizle
    setScanMethod('none'); // Tarama modunu sıfırla
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
    setScannedMemberData(null); // Düzenleme moduna geçerken taranmış veriyi temizle
    setScanMethod('none'); // Tarama modunu sıfırla
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

  // --- Form Scan İşlemleri ---

  // Dosya veya Kamera ile tarama seçeneğini başlat
  const startScan = (method: 'file' | 'camera') => {
      setScanMethod(method);
      setScanError(null);
      setScannedMemberData(null);
      setShowAddForm(false); // Tarama başladığında formu gizle
      setEditingMember(null); // Yeni kayıt modu için düzenleme durumunu sıfırla

      if (method === 'file') {
          // Dosya seçme penceresini tetikle
          fileInputRef.current?.click();
      } else if (method === 'camera') {
           startCamera(); // Kamerayı başlat
      }
  };

  // Kamera başlatma
  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); // Arka kamerayı tercih et
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setCameraStream(stream);
              setCameraEnabled(true);
              setScanning(false); // Kamera açılınca scanning state'ini false yap
          }
      } catch (err: any) {
          console.error('Kamera erişim hatası:', err);
          setScanError('Kamera başlatılamadı. Lütfen kamera izni verdiğinizden emin olun. Hata: ' + err.message);
          setCameraEnabled(false);
          setScanMethod('none'); // Hata olursa tarama modunu sıfırla
          setScanning(false); // Hata olursa scanning state'ini false yap
      }
  };

  // Kamera durdurma
  const stopCamera = () => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
          setCameraEnabled(false);
      }
  };

  // Component unmount olduğunda kamerayı kapat
   useEffect(() => {
       return () => {
           stopCamera();
       };
   }, [cameraStream]); // cameraStream değiştiğinde cleanup fonksiyonunu güncelle


  // Fotoğraf çekme
  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const context = canvasRef.current.getContext('2d');
          if (context) {
              // Canvas boyutunu video boyutuyla eşleştir
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;

              // Video karesini canvas'a çiz
              context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);

              // Canvas'tan Base64 formatında görsel verisini al
              const imageDataUrl = canvasRef.current.toDataURL('image/png');

              // Base64 verisini Blob objesine dönüştür (isteğe bağlı ama backend için daha uygun olabilir)
               fetch(imageDataUrl)
                   .then(res => res.blob())
                   .then(blob => {
                       const capturedFile = new File([blob], "scanned-form.png", { type: "image/png" });
                       console.log('Fotoğraf çekildi, Blob oluşturuldu.', capturedFile);
                       processScannedImageData(capturedFile); // İşleme fonksiyonunu çağır
                       stopCamera(); // Fotoğraf çekildikten sonra kamerayı kapat
                   });

          }
      }
  };

  // Dosya veya çekilen fotoğrafı işleme alacak fonksiyon (OCR placeholder)
  const processScannedImageData = async (imageData: File | Blob) => {
      setScanning(true);
      setScanError(null);
      setScannedMemberData(null);
      setShowAddForm(true); // Formu aç (tarama bitince doldurulacak)
      setEditingMember(null); // Yeni kayıt modu için düzenleme durumunu sıfırla

      console.log('Dosya veya fotoğraf işleniyor...', imageData);

      // TODO: Burada imageData (File veya Blob) objesini bir backend servisine (örneğin Cloud Function) yükleme
      // ve OCR/veri çıkarma işlemini GEMINI_API_KEY kullanarak tetikleme mantığı eklenecek.
      // Backend servisi, görseli işleyip ayıklanan veriyi HTTP response olarak dönecek.

      // Örnek: Dosyayı FormData ile gönderme konsepti (fetch API)
      // const formData = new FormData();
      // formData.append('formImage', imageData);
      // try {
      //     const response = await fetch('/your-cloud-function-endpoint/scan-form', {
      //         method: 'POST',
      //         body: formData,
      //     });
      //     if (!response.ok) {
      //         throw new Error(`HTTP error! status: ${response.status}`);
      //     }
      //     const scannedData = await response.json(); // Backend'den dönen veri bekleniyor
      //     setScannedMemberData(scannedData); // Taranan veriyi state'e kaydet
      // } catch (error: any) {
      //     console.error('Form işleme hatası:', error);
      //     setScanError('Form işlenirken bir hata oluştu: ' + error.message);
      //     setShowAddForm(false); // Hata olursa formu kapat
      // } finally {
      //     setScanning(false);
      // }

      // --- Geçici Yer Tutucu Veri Kullanımı (Backend yoksa) ---
       console.log('OCR ve veri çıkarma işlemi simüle ediliyor...');
       await new Promise(resolve => setTimeout(resolve, 2000)); // Simüle edilmiş bekleme

       const dummyScannedData: ScannedFormData = {
           name: 'Simge',
           surname: 'Can',
           birthDate: '1995-11-22', // YYYY-MM-DD formatı
           phone: '5559876543',
           email: 'simge.can@example.com',
           address: 'Yeni Mah. No: 456, Yeni İlçe / Yeni İl',
           healthIssues: 'Alerjiler mevcut',
           medications: 'Hayır',
           injuries: 'Hayır',
           packageChoice: "12'li Paket",
           otherPackageDetail: '',
       };

       setScannedMemberData(dummyScannedData);
       setScanning(false);
       alert('Tarama simülasyonu tamamlandı. Form verileri dolduruldu.');
       // --- Geçici Yer Tutucu Sonu ---

       // Dosya inputunu temizle (File methodu için)
       if (fileInputRef.current) {
           fileInputRef.current.value = '';
       }
  };

  // Tarama işlemini iptal et
  const cancelScan = () => {
      stopCamera(); // Kamerayı durdur
      setScanMethod('none');
      setScanning(false);
      setScanError(null);
      setScannedMemberData(null);
      // Form açıksa açık bırakılabilir veya kapatılabilir
      // setShowAddForm(false);
  };

  // File input'un onChange event'i bu fonksiyonu çağıracak
   const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (file) {
           processScannedImageData(file); // Seçilen dosyayı işleme fonksiyonuna gönder
       }
   };

  // --- Form Scan İşlemleri Sonu ---


  return (
    <div className="member-management-page">
      <div className="page-header">
        <h2>Üye Yönetimi</h2>
      </div>

      {/* Ana Kontroller: Yeni Üye Ekle, Form Scan Et seçenekleri veya Tarama Arayüzü */}
      <div className="controls">
          {/* Normal Butonlar (Tarama modu yoksa göster) */}
          {scanMethod === 'none' && !showAddForm && !editingMember && (
               <button onClick={() => {
                    setShowAddForm(true);
                    setScannedMemberData(null); // Manuel ekleme için taranmış veriyi temizle
                    setScanMethod('none'); // Manuel ekleme modu
               }}>Yeni Üye Ekle</button>
          )}

           {/* Formu Gizle Butonu (Form açıksa göster) */}
           {showAddForm && (
                <button onClick={() => {
                     setShowAddForm(false);
                     setEditingMember(null);
                     setScannedMemberData(null);
                     setScanMethod('none'); // Form kapatıldığında tarama modunu sıfırla
                }}>Formu Gizle</button>
           )}

           {/* Form Scan Et Seçenekleri (Tarama modu yoksa göster) */}
           {scanMethod === 'none' && !showAddForm && !editingMember && (
               <>
                   <button onClick={() => startScan('file')}>Dosyadan Scan Et</button>
                   <button onClick={() => startScan('camera')}>Kameradan Scan Et</button>
               </>
           )}

           {/* Tarama Modu Arayüzü (scanMethod 'file' veya 'camera' ise göster) */}
           {(scanMethod === 'file' || scanMethod === 'camera') && !scanning && (
               <button onClick={cancelScan}>Tarama İptal</button>
           )}

            {/* Gizli dosya inputu */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*,application/pdf"
                onChange={handleFileInputChange} // Yeni handler kullan
            />

             {scanError && <p style={{ color: 'red' }}>{scanError}</p>}
             {scanning && <p>Tarama İşlemi Sürüyor...</p>}
      </div>

      {/* Kamera Görüntüsü Alanı (scanMethod 'camera' ve kamera etkinse göster) */}
       {scanMethod === 'camera' && cameraEnabled && !scanning && (
           <div className="camera-view-container"> {/* CSS ile boyutlandırılacak */}
               <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: 'auto' }}></video>
               <button onClick={capturePhoto}>Fotoğraf Çek</button>
               {/* Hidden canvas for capturing photo */}
               <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
           </div>
       )}

      {/* Yeni Üye Ekle / Düzenle Formu (showAddForm true ise gösterilecek) */}
      {showAddForm && (
        <div className="add-member-form-container card"> {/* .card class'ı eklendi */} 
          <AddMemberForm 
            onMemberAdded={handleMemberAdded} 
            // TODO: onMemberUpdated ve editingMember prop'ları AddMemberForm componentine eklenecek
            // onMemberUpdated={handleMemberUpdated}
            editingMember={editingMember} // Düzenleme modunda mevcut üye verisi
            initialData={scannedMemberData} // Tarama modunda taranan veri
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
