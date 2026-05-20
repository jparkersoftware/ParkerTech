import type { Timestamp } from 'firebase/firestore';

export type Contact = {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type Client = {
  id: string;
  name: string;
  notes?: string;
  contacts: Contact[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
