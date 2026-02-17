import type React from 'react';
import { createContext, useContext, useState } from 'react';

// הגדרת סוגי הנתונים שנאסוף מהמסכים שעיצבת
interface OnboardingData {
  spaceType?: 'personal' | 'couple' | 'family' | 'business'; // שלב 1
  childCount?: number; // שלב מותנה
  challenges?: string[]; // שלב 2
  sources?: string[]; // שלב 3
  fullName?: string; // שלב 4
  profileColor?: string; // שלב 4
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (newData: Partial<OnboardingData>) => void;
  resetData: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<OnboardingData>({});

  const updateData = (newData: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const resetData = () => setData({});

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
}

// פונקציה קלה לשימוש בכל מסך
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
