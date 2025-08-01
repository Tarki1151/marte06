// src/types/Branch.ts
import type { Timestamp } from 'firebase/firestore';

export interface Branch {
  id: string;
  name: string;
  description?: string;
  createdAt?: Timestamp;
}
