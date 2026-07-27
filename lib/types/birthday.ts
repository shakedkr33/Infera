export interface Birthday {
  id: string;
  name: string;
  /** Actual given name when supplied by a contact/profile source. */
  firstName?: string | null;
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
