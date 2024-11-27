"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import React from "react";

const Header = () => {
  if (typeof window === "undefined") return null;
  return (
    <div className="relative flex w-full h-[10%] items-center justify-between py-2 px-16 text-black font-extrabold text-4xl">
      <div>Vesto.</div>
      <WalletMultiButton style={{ backgroundColor: "#1597ff" }} />
    </div>
  );
};
export default Header;
