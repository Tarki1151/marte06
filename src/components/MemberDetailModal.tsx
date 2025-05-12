// src/components/MemberDetailModal.tsx
import React, { useState, useEffect } from 'react';
import type { Member } from './MemberList.tsx'; // Import Member interface
import type { Package } from './PackageList.tsx'; // Import Package interface
import { db } from '../firebaseConfig'; // Firestore db import
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore'; // Firestore functions
import './MemberDetailModal.css'; // CSS dosyası
import { formatDateToDDMMYY, formatDateToYYYYMMDD, formatPrice } from '../utils/formatters.ts'; // Date and Price formatters

interface AssignedPackage {
    id: string; // Document ID in the assignedPackages subcollection
    packageId: string; // Reference to the actual package
    packageName: string; // Denormalized name
    startDate: Timestamp;
    endDate: Timestamp; // Calculated
    lessonsRemaining?: number | null; // If applicable
    assignedAt: Timestamp;
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
    // TODO: Add callbacks for package assignment and payment recording
}

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ isVisible, onClose, member }) => {
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
            const assignedPackagesData: AssignedPackage[] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as Omit<AssignedPackage, 'id'>
            }));
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
            // Sort by payment date

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
            };

            // Add to assignedPackages subcollection for the member
            const assignedPackagesRef = collection(db, 'members', member.id, 'assignedPackages');
            await addDoc(assignedPackagesRef, assignedPackageData);

            console.log('Paket atandı:', assignedPackageData);

            // Clear assignment form and refresh assigned packages list
            setSelectedPackageToAssign('');
            setAssignedPackageStartDate(formatDateToYYYYMMDD(new Date())); // Reset start date to today
            fetchAssignedPackages(); // Re-fetch assigned packages to update the list
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

    // TODO: Add logic for deleting an assigned package or payment

    // TODO: Add logic for calculating balance/remaining sessions

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
                                    {assignedPkg.packageName} ({formatDateToDDMMYY(assignedPkg.startDate)} - {formatDateToDDMMYY(assignedPkg.endDate)})
                                    {assignedPkg.lessonsRemaining != null && ` | Kalan Ders: ${assignedPkg.lessonsRemaining}`}
                                    {/* TODO: Add Delete button for assigned package */}
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

                        {assignError
&& <p style={{ color: 'red' }}>{assignError}</p>}

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

                {/* TODO: Balance/Remaining Sessions Info */}
                <div className="balance-info"> {/* CSS for styling */}
                    <h4>Durum</h4>
                    <p>Kalan Ders: Hesaplama yapılacak</p>
                    <p>Kalan Borç: Hesaplama yapılacak</p>
                </div>

                <button onClick={onClose} className="close-button">Kapat</button> {/* CSS for styling */}
            </div>
        </div>
    );
};

export default MemberDetailModal;