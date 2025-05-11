// src/utils/formatters.ts
import { Timestamp } from 'firebase/firestore';

// Formats a number as currency with thousands separators (Turkish Lira format)
export const formatPrice = (price: number): string => {
  if (isNaN(price) || price === null || price === undefined) {
    return '';
  }
  // Use Turkish locale for thousands separator (dot) and currency symbol (optional)
  return price.toLocaleString('tr-TR');
};

// Formats a Date or Timestamp object to dd/mm/yy string
export const formatDateToDDMMYY = (date: Date | Timestamp | null | undefined): string => {
  if (!date) return '';

  let jsDate: Date;
  if (date instanceof Timestamp) {
    jsDate = date.toDate();
  } else if (date instanceof Date) {
    jsDate = date;
  } else {
      return ''; // Handle other potential input types
  }

  const day = jsDate.getDate().toString().padStart(2, '0');
  const month = (jsDate.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const year = jsDate.getFullYear().toString().slice(-2); // Get last two digits of the year

  return `${day}/${month}/${year}`;
};
