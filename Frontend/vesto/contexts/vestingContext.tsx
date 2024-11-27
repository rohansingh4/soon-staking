"use client";

import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useState,
} from "react";

interface IVestingState {
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  address: string | null;
  setAddress: React.Dispatch<React.SetStateAction<string | null>>;
}

const VestingContext = createContext<IVestingState>({} as IVestingState);

export function useVestingContext() {
  return useContext(VestingContext);
}

export default function VestingProvider({ children }: PropsWithChildren) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [address, setAddress] = useState<string | null>(null);
  return (
    <VestingContext.Provider
      value={{ currentStep, setCurrentStep, address, setAddress }}
    >
      {children}
    </VestingContext.Provider>
  );
}
