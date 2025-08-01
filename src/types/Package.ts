import { Timestamp } from 'firebase/firestore';

export interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  lessonCount?: number | null;
  durationDays?: number | null;
  isActive: boolean;
  createdAt: Timestamp;
}
