export interface Birthday {
  id: string;
  name: string;
  day: number;
  month: number;
  year?: number | null;
  photoUri?: string | null;
  contactId?: string | null;
  source?: 'manual' | 'contact';
  phoneNumber?: string | null;
  createdAt: number;
  updatedAt: number;
}
