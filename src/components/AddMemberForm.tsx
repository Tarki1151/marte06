// src/components/AddMemberForm.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import type { Member } from '../components/MemberList';
import { Timestamp } from 'firebase/firestore'; // Timestamp import eklendi

interface InitialMemberData {
    id?: string;
    name?: string;
    surname?: string;
    birthDate?: string | Date | Timestamp;
    phone?: string;
    email?: string;
    address?: string;
    healthIssues?: string;
    medications?: string;
    injuries?: string;
    packageChoice?: string;
    otherPackageDetail?: string;
    parentName?: string;
    parentPhone?: string;
    notes?: string;
}

interface AddMemberFormProps {
    onMemberAdded: () => void;
    onMemberUpdated?: () => void;
    editingMember?: Member | null;
    initialData?: InitialMemberData | null;
}

const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 100; i--) {
        years.push(i);
    }
    return years;
};

const generateDays = (year: number | '', month: number | '') => {
    if (year === '' || month === '') return [];
    const date = new Date(year as number, month as number, 0);
    const daysInMonth = date.getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }
    return days;
};

const AddMemberForm: React.FC<AddMemberFormProps> = ({ onMemberAdded, onMemberUpdated, editingMember, initialData }) => {
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDay, setBirthDay] = useState<number | ''>('');
    const [birthMonth, setBirthMonth] = useState<number | ''>('');
    const [birthYear, setBirthYear] = useState<number | ''>('');
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const dataToFill = editingMember || initialData;

        if (dataToFill) {
            setName(dataToFill.name || '');
            setSurname(dataToFill.surname || '');
            setEmail(dataToFill.email || '');
            setPhone(dataToFill.phone || '');

            if (dataToFill.birthDate) {
                let dateObj: Date | null = null;
                if (dataToFill.birthDate instanceof Timestamp) {
                    dateObj = dataToFill.birthDate.toDate();
                } else if (dataToFill.birthDate instanceof Date) {
                    dateObj = dataToFill.birthDate;
                } else if (typeof dataToFill.birthDate === 'string') {
                    try {
                        const parts = dataToFill.birthDate.split('-');
                        if (parts.length === 3) {
                            dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        } else {
                            console.warn('Invalid birth date format:', dataToFill.birthDate);
                        }
                    } catch (e) {
                        console.error('Birth date parse error:', e);
                    }
                }

                if (dateObj && !isNaN(dateObj.getTime())) {
                    setBirthDay(dateObj.getDate());
                    setBirthMonth(dateObj.getMonth() + 1);
                    setBirthYear(dateObj.getFullYear());
                } else {
                    console.warn('Invalid birth date:', dataToFill.birthDate);
                    setBirthDay('');
                    setBirthMonth('');
                    setBirthYear('');
                }
            } else {
                setBirthDay('');
                setBirthMonth('');
                setBirthYear('');
            }

            setParentName(dataToFill.parentName || '');
            setParentPhone(dataToFill.parentPhone || '');
            setNotes(dataToFill.notes || '');
        } else {
            setName('');
            setSurname('');
            setEmail('');
            setPhone('');
            setBirthDay('');
            setBirthMonth('');
            setBirthYear('');
            setParentName('');
            setParentPhone('');
            setNotes('');
        }
    }, [initialData, editingMember]);

    const isMinor = (() => {
        if (birthDay === '' || birthMonth === '' || birthYear === '') return false;
        const today = new Date();
        const birthDate = new Date(birthYear as number, (birthMonth as number) - 1, birthDay as number);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age < 18;
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (birthDay === '' || birthMonth === '' || birthYear === '') {
            if (!(editingMember?.birthDate || initialData?.birthDate)) {
                setError('Please enter the full birth date (Day, Month, Year).');
                setLoading(false);
                return;
            }
        }

        if (isMinor && (!parentName || !parentPhone)) {
            setError('Parent name and phone are required for members under 18.');
            setLoading(false);
            return;
        }

        let birthDateObj: Date | null = null;
        if (birthDay !== '' && birthMonth !== '' && birthYear !== '') {
            birthDateObj = new Date(birthYear as number, (birthMonth as number) - 1, birthDay as number);
            if (isNaN(birthDateObj.getTime())) {
                setError('Invalid birth date entered.');
                setLoading(false);
                return;
            }
        }

        try {
            const memberDataToSave = {
                name,
                surname,
                email,
                phone,
                birthDate: birthDateObj,
                parentName: isMinor ? parentName : null,
                parentPhone: isMinor ? parentPhone : null,
                notes,
            };

            if (editingMember) {
                const memberRef = doc(db, 'members', editingMember.id);
                await updateDoc(memberRef, {
                    ...memberDataToSave,
                    updatedAt: Timestamp.now(),
                });
                console.log('Member updated, Document ID:', editingMember.id);
                onMemberUpdated?.();
            } else {
                const docRef = await addDoc(collection(db, 'members'), {
                    ...memberDataToSave,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                console.log('New member added, Document ID:', docRef.id);
                onMemberAdded();
            }

            setName('');
            setSurname('');
            setEmail('');
            setPhone('');
            setBirthDay('');
            setBirthMonth('');
            setBirthYear('');
            setParentName('');
            setParentPhone('');
            setNotes('');
        } catch (error: any) {
            console.error(editingMember ? 'Member update error:' : 'Member add error:', error);
            setError(editingMember ? `Error updating member: ${error.message}` : `Error adding member: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const years = generateYears();
    const days = generateDays(birthYear, birthMonth);
    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' },
    ];

    return (
        <form onSubmit={handleSubmit}>
            <h3>{editingMember ? 'Edit Member' : initialData ? 'Add Member from Scanned Data' : 'Add New Member'}</h3>
            <div>
                <label htmlFor="name">Name:</label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="surname">Surname:</label>
                <input
                    type="text"
                    id="surname"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="phone">Phone:</label>
                <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
            </div>
            <div>
                <label>Birth Date:</label>
                <div className="birthdate-selects">
                    <select
                        value={birthDay}
                        onChange={(e) => setBirthDay(parseInt(e.target.value) || '')}
                        required
                    >
                        <option value="">Day</option>
                        {days.map((day) => (
                            <option key={day} value={day}>
                                {day}
                            </option>
                        ))}
                    </select>
                    <select
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(parseInt(e.target.value) || '')}
                        required
                    >
                        <option value="">Month</option>
                        {months.map((month) => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={birthYear}
                        onChange={(e) => setBirthYear(parseInt(e.target.value) || '')}
                        required
                    >
                        <option value="">Year</option>
                        {years.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label htmlFor="notes">Notes:</label>
                <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {isMinor && (
                <>
                    <h4>Parent Information</h4>
                    <div>
                        <label htmlFor="parentName">Parent Name:</label>
                        <input
                            type="text"
                            id="parentName"
                            value={parentName}
                            onChange={(e) => setParentName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="parentPhone">Parent Phone:</label>
                        <input
                            type="tel"
                            id="parentPhone"
                            value={parentPhone}
                            onChange={(e) => setParentPhone(e.target.value)}
                            required
                        />
                    </div>
                </>
            )}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button type="submit" disabled={loading}>
                {loading ? (editingMember ? 'Updating...' : 'Adding...') : editingMember ? 'Update Member' : 'Save'}
            </button>
            {editingMember && (
                <button type="button" onClick={() => onMemberUpdated?.()} disabled={loading}>
                    Cancel
                </button>
            )}
        </form>
    );
};

export default AddMemberForm;