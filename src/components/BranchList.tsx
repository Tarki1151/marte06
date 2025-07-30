// src/components/BranchList.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
//import type { DocumentData } from 'firebase/firestore'; // Belge verisi tipi - KULLANILMIYOR

export interface Branch {
    id: string;
    name: string;
    address: string;
    phone: string;
    description: string; // Added description
}

interface BranchListProps {
  refreshTrigger: boolean;
  onBranchDeleted?: () => void;
  onBranchEdited?: (branch: Branch) => void;
}

const BranchList: React.FC<BranchListProps> = ({ refreshTrigger }) => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBranches = async () => {
            setLoading(true);
            setError(null);

            try {
                const branchesCollection = collection(db, 'branches');
                const querySnapshot = await getDocs(branchesCollection);
                const branchesData: Branch[] = querySnapshot.docs.map(doc => ({
                    ...doc.data() as Branch,
                }));
                setBranches(branchesData);
            } catch (e: any) {
                console.error('Error fetching branches:', e.message);
                setError('Failed to load branches: ' + e.message);
                setBranches([]);
            } finally {
                setLoading(false);
            }
        };

        fetchBranches();
    }, [refreshTrigger]);

    const handleDeleteBranch = async (branchId: string) => {
        try {
            const branchDocRef = doc(db, 'branches', branchId);
            await deleteDoc(branchDocRef);
            // Silme başarılıysa listeyi güncelle
            setBranches(prevBranches => prevBranches.filter(branch => branch.id !== branchId));
        } catch (e: any) {
            console.error('Error deleting branch:', e.message);
            setError('Failed to delete branch: ' + e.message);
        }
    };

    if (loading) {
        return <p>Loading branches...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div className="branch-list">
            <h3>Branch List</h3>
            {branches.length > 0 ? (
                <ul>
                    {branches.map(branch => (
                        <li key={branch.id}>
                            {branch.name} - {branch.address} - {branch.phone}
                            <button onClick={() => handleDeleteBranch(branch.id)}>Delete</button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No branches found.</p>
            )}
        </div>
    );
};

export default BranchList;
