import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Birthday } from '@/lib/types/birthday';

const STORAGE_KEY = 'inyomi_birthdays_v1';

export async function loadPersistedBirthdays(): Promise<Birthday[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Birthday[];
  } catch {
    return null;
  }
}

export async function persistBirthdays(birthdays: Birthday[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(birthdays));
}
