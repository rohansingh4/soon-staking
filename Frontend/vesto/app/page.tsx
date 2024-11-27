"use client";

import Header from "@/components/Header";
import Vesting from "@/components/vesting";
import VestingProvider from "@/contexts/vestingContext";
import { useEffect, useState } from "react";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null;

  return (
    <div className="relative w-full h-full flex flex-col  bg-[#20272C]/5">
      <Header />
      <Vesting />
    </div>
  );
}
