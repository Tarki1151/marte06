// src/components/MemberDetailModal.tsx
import React, { useState, useEffect } from 'react';
import type { Member } from './MemberList.tsx'; // Import Member interface
import type { Package } from '../types/Package'; // Import Package interface
import { db } from '../firebaseConfig'; // Firestore db import
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, Timestamp, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore'; // Firestore functions
import './MemberDetailModal.css'; // CSS dosyası
import { formatDateToDDMMYY, formatDateToYYYYMMDD, formatPrice } from '../utils/formatters.ts'; // Date and Price formatters

interface AssignedPackage {
    id: string; // Document ID in the assignedPackages subcollection
    packageId: string; // Reference to the actual package
    packageName: string; // Denormalized name
    startDate: Timestamp;
    endDate: Timestamp | null; // Calculated, null olabilir
    lessonsRemaining?: number | null; // If applicable (initial from package, will be updated)
    assignedAt: Timestamp;
    totalLessonCount?: number; // Added: Total lessons from the package
    packagePrice?: number; // Added: Price from the package
    autoPaymentId?: string; // Added: ID of the automatically created payment, if any
    // Calculated values
    attendedLessons: number; // Calculated based on attendance
    calculatedRemainingLessons: number; // Calculated based on total and attended lessons
    outstandingBalance: number; // Calculated based on price, total lessons, and remaining lessons
}

interface Payment {
    id: string; // Document ID in the payments subcollection
    amount: number; // Amount paid
    date: Timestamp; // Date of payment
    recordedAt: Timestamp; // When the record was created
}

interface MemberDetailModalProps {
    isVisible: boolean;
    onClose: () => void;
    member: Member; // The member whose details are being shown
    onEdit: (member: Member) => void; // Callback to trigger editing
    onDelete: (member: Member) => void; // Callback to trigger deletion
}

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ isVisible, onClose, member, onEdit, onDelete }) => {
    const [assignedPackages, setAssignedPackages] = useState<AssignedPackage[]>([]);
    const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
    const [loadingAssignedPackages, setLoadingAssignedPackages] = useState(false);
    const [loadingAvailablePackages, setLoadingAvailablePackages] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // State for assigning a new package
    const [selectedPackageToAssign, setSelectedPackageToAssign] = useState<string>('');
    const [assignedPackageStartDate, setAssignedPackageStartDate] = useState<string>(formatDateToYYYYMMDD(new Date())); // Start date for assignment (default to today)
    const [assigningPackage, setAssigningPackage] = useState(false); // Loading state for assignment
    const [assignError, setAssignError] = useState<string | null>(null); // Error state for assignment

    // State for recording a new payment
    const [paymentAmount, setPaymentAmount] = useState<string>(''); // Amount of payment
    const [paymentDate, setPaymentDate] = useState<string>(formatDateToDDMMYY(new Date())); // Date of payment (default to today)
    const [recordingPayment, setRecordingPayment] = useState(false); // Loading state for payment recording
    const [paymentError, setPaymentError] = useState<string | null>(null); // Error state for payment recording

    // State for payment history
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);

    // --- Fetch Assigned Packages ---
    const fetchAssignedPackages = async () => {
        setLoadingAssignedPackages(true);
        setFetchError(null); // Clear previous errors
        try {
            const assignedPackagesRef = collection(db, 'members', member.id, 'assignedPackages');
            const querySnapshot = await getDocs(assignedPackagesRef);
            const assignedPackagesData: AssignedPackage[] = [];

            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                const assignedPackage: AssignedPackage = {
                    id: docSnap.id,
                    packageId: data.packageId,
                    packageName: data.packageName,
                    startDate: data.startDate,
                    endDate: data.endDate || null, // Null kontrolü
                    lessonsRemaining: data.lessonsRemaining || null,
                    assignedAt: data.assignedAt,
                    autoPaymentId: data.autoPaymentId || undefined, // Include autoPaymentId
                    totalLessonCount: undefined,
                    packagePrice: undefined,
                    attendedLessons: 0, // Varsayılan değer
                    calculatedRemainingLessons: 0, // Varsayılan değer
                    outstandingBalance: 0, // Varsayılan değer
                };

                // Fetch package details to get total lesson count and price
                try {
                    const packageRef = doc(db, 'packages', assignedPackage.packageId);
                    const packageDocSnap = await getDoc(packageRef);

                    if (packageDocSnap.exists()) {
                        const packageData = packageDocSnap.data() as Package;
                        assignedPackage.totalLessonCount = packageData.lessonCount ?? undefined;
                        assignedPackage.packagePrice = packageData.price;
                    } else {
                        console.warn(`Package with ID ${assignedPackage.packageId} not found.`);
                    }
                } catch (packageError: any) {
                    console.error(`Error fetching package ${assignedPackage.packageId}:`, packageError);
                }

                // --- Fetch attendance records for this member and this package's start date ---
                let attendedLessonsCount = 0;
                if (assignedPackage.startDate) {
                    try {
                        const lessonsRef = collection(db, 'lessons');
                        const attendanceQuery = query(
                            lessonsRef,
                            where('memberIds', 'array-contains', member.id),
                            where('date', '>=', assignedPackage.startDate) // Lessons on or after package start date
                            // TODO: Add filter for end date if applicable and desired
                        );
                        const attendanceSnapshot = await getDocs(attendanceQuery);
                        attendedLessonsCount = attendanceSnapshot.size;
                    } catch (attendanceError: any) {
                        console.error(`Error fetching attendance for package ${assignedPackage.id}:`, attendanceError);
                    }
                }
                assignedPackage.attendedLessons = attendedLessonsCount;
                // --- End Fetch attendance records ---

                // --- Calculate remaining lessons ---
                assignedPackage.calculatedRemainingLessons =
                    assignedPackage.totalLessonCount !== undefined
                        ? Math.max(0, assignedPackage.totalLessonCount - assignedPackage.attendedLessons)
                        : assignedPackage.lessonsRemaining !== null && assignedPackage.lessonsRemaining !== undefined
                        ? assignedPackage.lessonsRemaining
                        : 0; // Fallback to lessonsRemaining if totalLessonCount is missing
                // --- End Calculate remaining lessons ---

                // --- Calculate outstanding balance ---
                if (
                    assignedPackage.packagePrice != null &&
                    assignedPackage.totalLessonCount != null &&
                    assignedPackage.totalLessonCount > 0
                ) {
                    const pricePerLesson = assignedPackage.packagePrice / assignedPackage.totalLessonCount;
                    assignedPackage.outstandingBalance = pricePerLesson * assignedPackage.calculatedRemainingLessons;
                } else {
                    assignedPackage.outstandingBalance = 0; // If price or total lessons are unknown, balance is 0
                }
                // --- End Calculate outstanding balance ---

                assignedPackagesData.push(assignedPackage);
            }

            // Sort by assigned date (optional)
            assignedPackagesData.sort((a, b) => b.assignedAt.toDate().getTime() - a.assignedAt.toDate().getTime());
            setAssignedPackages(assignedPackagesData);
        } catch (error: any) {
            console.error('Atanmış paketleri çekme hatası:', error);
            setFetchError('Atanmış paketler yüklenirken bir hata oluştu: ' + error.message);
            setAssignedPackages([]); // Clear list on error
        } finally {
            setLoadingAssignedPackages(false);
        }
    };

    // --- Fetch Available Packages ---
    const fetchAvailablePackages = async () => {
        setLoadingAvailablePackages(true);
        try {
            const packagesRef = collection(db, 'packages');
            const querySnapshot = await getDocs(packagesRef);
            const availablePackagesData: Package[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as Omit<Package, 'id'>
            }));
            // Filter active packages if needed
            const activePackages = availablePackagesData.filter(pkg => pkg.isActive);
            setAvailablePackages(activePackages);
        } catch (error: any) {
            console.error('Mevcut paketleri çekme hatası:', error);
            setFetchError('Mevcut paketler yüklenirken bir hata oluştu: ' + error.message); // Use main error state
            setAvailablePackages([]);
        } finally {
            setLoadingAvailablePackages(false);
        }
    };

    // --- Fetch Payment History ---
    const fetchPaymentHistory = async () => {
        setLoadingPaymentHistory(true);
        try {
            const paymentsRef = collection(db, 'members', member.id, 'payments');
            const querySnapshot = await getDocs(paymentsRef);
            const paymentHistoryData: Payment[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as Omit<Payment, 'id'>
            }));
            // Sort by payment date (most recent first)
            paymentHistoryData.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
            setPaymentHistory(paymentHistoryData);
        } catch (error: any) {
            console.error('Ödeme geçmişini çekme hatası:', error);
            setFetchError('Ödeme geçmişi yüklenirken bir hata oluştu: ' + error.message); // Use main error state
            setPaymentHistory([]);
        } finally {
            setLoadingPaymentHistory(false);
        }
    };

    // Fetch assigned packages, available packages, and payment history when modal opens or member changes
    useEffect(() => {
        if (!isVisible || !member) return; // Only fetch when modal is visible and member is provided

        fetchAssignedPackages();
        fetchAvailablePackages();
        fetchPaymentHistory();
    }, [isVisible, member]); // Re-fetch when modal visibility or member changes

    // Handle assigning a new package
    const handleAssignPackage = async () => {
        if (!selectedPackageToAssign || !assignedPackageStartDate) {
            setAssignError('Lütfen bir paket ve başlangıç tarihi seçin.');
            return;
        }

        setAssigningPackage(true);
        setAssignError(null);

        try {
            // Find the selected package details
            const packageToAssign = availablePackages.find(pkg => pkg.id === selectedPackageToAssign);

            if (!packageToAssign) {
                setAssignError('Seçilen paket bulunamadı.');
                setAssigningPackage(false);
                return;
            }

            // Calculate end date based on durationDays (if applicable)
            let endDate: Date | null = null;
            if (packageToAssign.durationDays !== null && packageToAssign.durationDays !== undefined) {
                const startDateObj = new Date(assignedPackageStartDate);
                endDate = new Date(startDateObj);
                endDate.setDate(startDateObj.getDate() + packageToAssign.durationDays);
            }

            // Prepare assigned package data
            const assignedPackageData = {
                packageId: packageToAssign.id,
                packageName: packageToAssign.name, // Denormalized name
                startDate: Timestamp.fromDate(new Date(assignedPackageStartDate)), // Save start date as Timestamp
                endDate: endDate ? Timestamp.fromDate(endDate) : null, // Save end date as Timestamp or null
                lessonsRemaining: packageToAssign.lessonCount !== null && packageToAssign.lessonCount !== undefined ? packageToAssign.lessonCount : null, // Initial remaining lessons
                assignedAt: serverTimestamp(), // Record assignment timestamp
                totalLessonCount: packageToAssign.lessonCount,
                packagePrice: packageToAssign.price,
                // autoPaymentId will be added after payment is created
            };

            // Add to assignedPackages subcollection for the member
            const assignedPackagesRef = collection(db, 'members', member.id, 'assignedPackages');
            const newAssignedPackageRef = await addDoc(assignedPackagesRef, assignedPackageData);

            console.log('Paket atandı:', assignedPackageData);

            // --- Automatically Record Payment for the Package ---
            let autoPaymentId: string | undefined = undefined;
            if (packageToAssign.price !== null && packageToAssign.price !== undefined && packageToAssign.price > 0) {
                try {
                    const paymentData = {
                        amount: packageToAssign.price,
                        date: Timestamp.fromDate(new Date(assignedPackageStartDate)), // Payment date is the package start date
                        recordedAt: serverTimestamp(), // Record creation timestamp
                        // Optionally link payment to assigned package if needed for other logic
                        // assignedPackageId: newAssignedPackageRef.id,
                    };

                    const paymentsRef = collection(db, 'members', member.id, 'payments');
                    const newPaymentRef = await addDoc(paymentsRef, paymentData);
                    autoPaymentId = newPaymentRef.id;

                    console.log('Paket ödemesi otomatik kaydedildi:', paymentData);
                } catch (paymentError: any) {
                    console.error('Otomatik ödeme kaydetme hatası:', paymentError);
                    // Decide how to handle payment recording errors during package assignment
                }
            }
            // --- End Automatic Payment Recording ---

            // Update the assigned package document with the autoPaymentId if a payment was created
            if (autoPaymentId) {
                try {
                    const assignedPackageDocRef = doc(db, 'members', member.id, 'assignedPackages', newAssignedPackageRef.id);
                    await updateDoc(assignedPackageDocRef, {
                        autoPaymentId: autoPaymentId,
                    });
                    console.log('Assigned package updated with autoPaymentId:', autoPaymentId);
                } catch (updateError: any) {
                    console.error('Error updating assigned package with payment ID:', updateError);
                }
            }

            // Clear assignment form and refresh assigned packages list and payment history
            setSelectedPackageToAssign('');
            setAssignedPackageStartDate(formatDateToYYYYMMDD(new Date())); // Reset start date to today
            fetchAssignedPackages(); // Re-fetch assigned packages to update the list with payment ID and calculations
            fetchPaymentHistory(); // Re-fetch payment history to update the list
        } catch (error: any) {
            console.error('Paket atama hatası:', error);
            setAssignError('Paket atanırken bir hata oluştu: ' + error.message);
        } finally {
            setAssigningPackage(false);
        }
    };

    // Handle recording a new payment
    const handleRecordPayment = async () => {
        if (paymentAmount === '' || Number(paymentAmount) <= 0 || !paymentDate) {
            setPaymentError('Lütfen geçerli bir ödeme miktarı ve tarihi girin.');
            return;
        }

        setRecordingPayment(true);
        setPaymentError(null);

        try {
            // DD.MM.YYYY formatındaki paymentDate'i YYYY-MM-DD'ye çevir
            const [day, month, year] = paymentDate.split('.');
            const formattedPaymentDate = `${year}-${month}-${day}`;

            const paymentData = {
                amount: Number(paymentAmount),
                date: Timestamp.fromDate(new Date(formattedPaymentDate)), // Düzeltilmiş tarih dönüşümü
                recordedAt: serverTimestamp(), // Record creation timestamp
            };

            // Add to payments subcollection for the member
            const paymentsRef = collection(db, 'members', member.id, 'payments');
            await addDoc(paymentsRef, paymentData);

            console.log('Ödeme kaydedildi:', paymentData);

            // Clear payment form and refresh payment history list
            setPaymentAmount('');
            setPaymentDate(formatDateToDDMMYY(new Date())); // Reset date to today
            fetchPaymentHistory(); // Re-fetch payment history to update the list
        } catch (error: any) {
            console.error('Ödeme kaydetme hatası:', error);
            setPaymentError('Ödeme kaydedilirken bir hata oluştu: ' + error.message);
        } finally {
            setRecordingPayment(false);
        }
    };

    // Handle deleting an assigned package
    const handleDeleteAssignedPackage = async (assignedPackageId: string) => {
        if (!window.confirm('Bu paketi silmek istediğinize emin misiniz? Bu pakete ait otomatik ödeme kaydı da silinecektir.')) {
            return;
        }

        setLoadingAssignedPackages(true); // Show loading while deleting
        setFetchError(null); // Clear previous errors
        try {
            const assignedPackageRef = doc(db, 'members', member.id, 'assignedPackages', assignedPackageId);
            const assignedPackageDoc = await getDoc(assignedPackageRef);

            if (assignedPackageDoc.exists()) {
                const assignedPackageData = assignedPackageDoc.data() as AssignedPackage;
                const autoPaymentId = assignedPackageData.autoPaymentId;

                // Delete the assigned package document
                await deleteDoc(assignedPackageRef);
                console.log('Assigned package deleted:', assignedPackageId);

                // If there was an automatically created payment, delete it as well
                if (autoPaymentId) {
                    try {
                        const paymentRef = doc(db, 'members', member.id, 'payments', autoPaymentId);
                        await deleteDoc(paymentRef);
                        console.log('Associated automatic payment deleted:', autoPaymentId);
                    } catch (paymentDeleteError: any) {
                        console.error('Otomatik ödeme silme hatası:', paymentDeleteError);
                    }
                }

                // Refresh the assigned packages list and payment history
                fetchAssignedPackages();
                fetchPaymentHistory();
            } else {
                console.warn('Assigned package not found for deletion:', assignedPackageId);
                setFetchError('Silinmek istenen atanmış paket bulunamadı.');
                fetchAssignedPackages();
                fetchPaymentHistory();
            }
        } catch (error: any) {
            console.error('Atanmış paket silme hatası:', error);
            setFetchError('Atanmış paket silinirken bir hata oluştu: ' + error.message);
        } finally {
            // Loading will be set to false by fetchAssignedPackages
        }
    };

    if (!isVisible || !member) return null; // Don't render if not visible or no member

    return (
        <div className="modal-overlay"> {/* Overlay için CSS (ConfirmModal.css kullanılabilir) */}
            <div className="modal-content"> {/* Modal içeriği için CSS */}
                <h3>Üye Detayları: {member.name} {member.surname}</h3>

                {/* Member basic info */}
                <div className="member-basic-info"> {/* CSS for styling */}
                    <p><strong>Email:</strong> {member.email}</p>
                    <p><strong>Telefon:</strong> {member.phone || 'Yok'}</p>
                    {member.birthDate && <p><strong>Doğum Tarihi:</strong> {formatDateToDDMMYY(member.birthDate)}</p>}  {/* Format date */}
                    {member.notes && <p><strong>Notlar:</strong> {member.notes}</p>}
                </div>

                {/* Assigned Packages Section */}
                <div className="assigned-packages"> {/* CSS for styling */}
                    <h4>Atanmış Paketler</h4>
                    {loadingAssignedPackages && <p>Atanmış paketler yükleniyor...</p>}
                    {!loadingAssignedPackages && fetchError && <p style={{ color: 'red' }}>{fetchError}</p>}
                    {!loadingAssignedPackages && !fetchError && assignedPackages.length > 0 ? (
                        <ul>
                            {assignedPackages.map(assignedPkg => (
                                <li key={assignedPkg.id}> {/* Use assigned package ID */}
                                    <div> {/* Use a div to structure the package info and delete button */}
                                        <span> {/* Wrap main text content in a span */}
                                            {assignedPkg.packageName} ({formatDateToDDMMYY(assignedPkg.startDate)} - {assignedPkg.endDate ? formatDateToDDMMYY(assignedPkg.endDate) : 'Belirsiz'}) {/* Handle potentially null end date */}
                                        </span>
                                        <br /> {/* Add a line break for details */}
                                        {assignedPkg.totalLessonCount != null && `Toplam Ders: ${assignedPkg.totalLessonCount}`}
                                        {assignedPkg.packagePrice != null && ` | Fiyat: ${formatPrice(assignedPkg.packagePrice)} TL`}
                                        {/* Display calculated values */}
                                        {assignedPkg.attendedLessons != null && ` | Geldiği Ders: ${assignedPkg.attendedLessons}`}
                                        {assignedPkg.calculatedRemainingLessons != null && ` | Kalan Ders: ${assignedPkg.calculatedRemainingLessons}`}
                                        {assignedPkg.outstandingBalance != null && ` | Kalan Borç: ${formatPrice(assignedPkg.outstandingBalance)} TL`}
                                    </div>
                                    <button
                                        className="delete-package-button"
                                        onClick={() => handleDeleteAssignedPackage(assignedPkg.id)}
                                        aria-label={`Delete package ${assignedPkg.packageName}`}
                                    >
                                        X
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : !loadingAssignedPackages && !fetchError && <p>Bu üyeye atanmış paket bulunmamaktadır.</p>}

                    {/* Assign New Package Form/Controls */}
                    <div className="assign-package-controls"> {/* CSS for styling */}
                        <h5>Yeni Paket Ata</h5>
                        <div className="form-group"> {/* Reuse general form group style */}
                            <label htmlFor="packageSelect">Paket Seç:</label>
                            <select
                                id="packageSelect"
                                value={selectedPackageToAssign}
                                onChange={(e) => setSelectedPackageToAssign(e.target.value)}
                                required
                                disabled={loadingAvailablePackages} /* Disable while available packages are loading */
                            >
                                <option value="">-- Paket Seçin --</option>
                                {availablePackages.map(pkg => (
                                    <option key={pkg.id} value={pkg.id}>{pkg.name} ({formatPrice(pkg.price)} TL)</option> /* Format price */
                                ))}
                            </select>
                            {loadingAvailablePackages && <p style={{ fontSize: '0.8rem', color: '#555' }}>Paketler yükleniyor...</p>}
                        </div>

                        <div className="form-group"> {/* Reuse general form group style */}
                            <label htmlFor="startDate">Başlangıç Tarihi:</label>
                            <input
                                type="date"
                                id="startDate"
                                value={assignedPackageStartDate}
                                onChange={(e) => setAssignedPackageStartDate(e.target.value)}
                                required
                            />
                        </div>

                        {assignError && <p style={{ color: 'red' }}>{assignError}</p>}

                        <button onClick={handleAssignPackage} disabled={assigningPackage || !selectedPackageToAssign || !assignedPackageStartDate}> {/* Disable if assigning or fields are empty */}
                            {assigningPackage ? 'Atanıyor...' : 'Paket Ata'}
                        </button>
                    </div>
                </div>

                {/* Payment History Section */}
                <div className="payment-history"> {/* CSS for styling */}
                    <h4>Ödeme Geçmişi</h4>
                    {loadingPaymentHistory && <p>Ödeme geçmişi yükleniyor...</p>}
                    {!loadingPaymentHistory && fetchError && <p style={{ color: 'red' }}>{fetchError}</p>}
                    {!loadingPaymentHistory && !fetchError && paymentHistory.length > 0 ? (
                        <ul>
                            {paymentHistory.map(payment => (
                                <li key={payment.id}>{formatDateToDDMMYY(payment.date)}: {formatPrice(payment.amount)} TL</li>
                            ))}
                            {/* Format date and price */}
                        </ul>
                    ) : !loadingPaymentHistory && !fetchError && <p>Bu üyeye ait ödeme kaydı bulunmamaktadır.</p>}

                    {/* Form/Controls to record a new payment */}
                    <div className="record-payment-controls"> {/* CSS for styling */}
                        <h5>Yeni Ödeme Kaydet</h5>
                        <div className="form-group"> {/* Reuse general form group style */}
                            <label htmlFor="paymentAmount">Miktar (TL):</label>
                            <input
                                type="number"
                                id="paymentAmount"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                required
                                min="0"
                            />
                        </div>
                        <div className="form-group"> {/* Reuse general form group style */}
                            <label htmlFor="paymentDate">Ödeme Tarihi:</label>
                            <input
                                type="date"
                                id="paymentDate"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                required
                            />
                        </div>

                        {paymentError && <p style={{ color: 'red' }}>{paymentError}</p>}

                        <button onClick={handleRecordPayment} disabled={recordingPayment || paymentAmount === '' || Number(paymentAmount) <= 0 || !paymentDate}> {/* Disable if recording or fields are empty/invalid */}
                            {recordingPayment ? 'Kaydediliyor...' : 'Ödeme Kaydet'}
                        </button>
                    </div>
                </div>

                {/* TODO: Balance/Remaining Sessions Info - This section might become less necessary if displayed per package */}
                {/* 
                <div className="balance-info"> 
                    <h4>Durum</h4>
                    <p>Kalan Ders: Hesaplama yapılacak</p>
                    <p>Kalan Borç: Hesaplama yapılacak</p>
                </div>
                */}

                <div className="modal-main-actions">
                    <button onClick={() => onEdit(member)} className="edit-button">Düzenle</button>
                    <button onClick={() => onDelete(member)} className="delete-button">Sil</button>
                    <button onClick={onClose} className="close-button">Kapat</button>
                </div>
            </div>
        </div>
    );
};

export default MemberDetailModal;