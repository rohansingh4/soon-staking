"use client";

import { useVestingContext } from "@/contexts/vestingContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import React, { useState } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";
import { DatePicker } from "@nextui-org/react";
import { now, parseAbsoluteToLocal } from "@internationalized/date";
import abi from "@/consts/abi.json";
import * as anchor from "@project-serum/anchor";

import {
  PublicKey,
  Transaction,
  SystemProgram,
  SendTransactionError,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  web3,
  Idl,
  Wallet,
  BN,
} from "@project-serum/anchor";
import {
  Keypair,
  sendAndConfirmTransaction,
  TransactionInstruction,
} from "@solana/web3.js";

const Vesting = () => {
  const steps = [
    "Connect Wallet",
    "Enter token address",
    "Add Vesting Details",
    "Create Contract",
  ];

  const cadence = [
    "Per second",
    "Per minute",
    "Per hour",
    "Per day",
    "Per week",
    "Per month",
    "Quaterly",
    "Annually",
  ];

  const dateShortcut = [
    { name: "+3M", value: 3 },
    { name: "+6M", value: 6 },
    { name: "+1Y", value: 12 },
    { name: "+2Y", value: 24 },
    { name: "+3Y", value: 36 },
    { name: "+4Y", value: 48 },
  ];
  const contract = new PublicKey(
    "3WNE2z7h6o5u5wpurRAskpRYeHbRx8v4S1TcYZvdk2Lc"
  ); //Program ID
  const { publicKey, sendTransaction } = useWallet();

  const tx = new Transaction();

  // Generate a new vesting account
  const vestingAccount = new web3.Keypair();
  const decimals = 9;

  // Load your wallet/keypair
  const payer = Keypair.generate(); // Replace with your actual wallet

  const { currentStep, setAddress, setCurrentStep } = useVestingContext();
  const { signTransaction } = useWallet();
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [cadencein, setCadence] = useState<string>("");

  const [isdropdown, setIsDropdown] = useState<boolean>(false);
  const [start, setStart] = useState<Date | null | any>(
    parseAbsoluteToLocal(new Date().toISOString())
  );
  const [cliff, setCliff] = useState<any | null>("");
  const [duration, setDuration] = useState<number>(0); // Duration in seconds
  const [slicePeriod, setSlicePeriod] = useState<number>(0); // Slice period in seconds
  // Define the RPC URL
  const rpcUrl = "https://rpc.testnet.soo.network/rpc";

  // Create a new connection using the custom RPC URL
  const connection = new Connection(rpcUrl, "confirmed");
  const [date, setDate] = useState<any>(
    parseAbsoluteToLocal(new Date().toISOString())
  );

  const [amount, setAmount] = useState<any>("");
  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  ); // Token program address
  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };
  const previousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const totalMonths =
    (date?.year - start?.year) * 12 + (date?.month - start?.month);

  const handleAddMonths = (months: number) => {
    const currentDate = new Date();
    const updatedDate = new Date(
      currentDate.setMonth(currentDate.getMonth() + months)
    );

    // Convert the date to ISO string
    const isoString = parseAbsoluteToLocal(updatedDate.toISOString());

    // Log or pass this ISO string to your function
    console.log(
      "Date in ISO format:",
      isoString,
      new Date().getSeconds() - start.second
    );

    // Example usage
    setDate(isoString);
  };
  const check = true;
  const params: any = {
    start:
      new Date().getDay() == start.day
        ? 0
        : new Date().getSeconds() - start.second, // Convert to seconds
    cliff: (cliff * 30.44 * 86400).toString(), // Convert to seconds
    duration: duration.toString(), // Already in seconds
    slice_period: slicePeriod.toString(), // Already in seconds
    amount,
    check,
  };

  const createVestingSchedule = async (
    wallet: Wallet, // Wallet object from the adapter
    connection: Connection, // Solana connection
    beneficiary: PublicKey, // Beneficiary's public key
    mint: PublicKey, // Token mint address
    vestingAmount: number, // Vesting amount
    ownerTokenAccount: PublicKey // Owner's token account
  ) => {
    if (!wallet.publicKey) {
      console.error("Wallet not connected");
      return;
    }

    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: "processed",
    });
    const program = new Program(abi as Idl, contract, provider);

    try {
      const ownerTokenAccount = new PublicKey(
        "QDq8qKjaYi6Zyv5PsvMrm5gYvEEXqCQWxMNkb1bLDJP"
      );
      // Derive PDA for the vesting
      // const vestingSchedule = Keypair.generate().publicKey;
      const escrowPublicKey = new PublicKey(
        "cgsSkooYqRCPfSfk2WqPaEdcdRL8ygg3XCpqG4K55sx"
      );
      const [vestingSchedule, bump] =
        await web3.PublicKey.findProgramAddressSync(
          [Buffer.from("vesting"), beneficiary.toBuffer()],
          program.programId
        );
      console.log(vestingSchedule, bump);

      // Create a new Keypair for escrow

      console.log("Payload", {
        owner: wallet.publicKey,
        beneficiary,
        mint,
        vestingSchedule,
        escrow: escrowPublicKey,
        ownerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor?.web3.SYSVAR_RENT_PUBKEY,
      });

      try {
        const { blockhash } = await connection.getLatestBlockhash();
        const tx = await program.methods
          .createVestingSchedule(
            new BN(vestingAmount),
            bump,
            new BN(Math.floor(Date.now() / 1000)),
            new BN(31536000),
            new BN(3 * 30 * 24 * 60 * 60)
          )
          .accounts({
            owner: wallet.publicKey.toString(),
            beneficiary,
            mint,
            vestingSchedule,
            escrow: escrowPublicKey,
            ownerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor?.web3.SYSVAR_RENT_PUBKEY,
          })
          .transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;
        const check = await wallet.signTransaction(tx);
        const transaction = await connection.sendRawTransaction(
          check.serialize(),
          {
            skipPreflight: true,
            preflightCommitment: "processed",
          }
        );
        const simulation = await connection.simulateTransaction(check);
        console.log(simulation.value.logs);
        console.log("Transaction successful:", transaction);
      } catch (error: any) {
        console.log("Transaction Error:", error);
      }

      console.log("Transaction successful:", tx);
    } catch (err) {
      console.error("Error creating vesting schedule:", err);
    }
  };
  const handleCreateVestingSchedule = async () => {
    const beneficiary = new PublicKey(
      "5F5iyvuEA7KeRwseuy8vA1miaNSajLMiyp2c9NeRgGGp"
    );
    const mint = new PublicKey("DnohjE7epPNSbLP9S6omUXn7JFrDznC98WLb2YWEKfdc");
    const ownerTokenAccount = new PublicKey(
      "QDq8qKjaYi6Zyv5PsvMrm5gYvEEXqCQWxMNkb1bLDJP"
    );

    const vestingAmount = 10; // Replace with the desired amount (smallest units)

    await createVestingSchedule(
      { publicKey, signTransaction } as Wallet,
      connection,
      beneficiary,
      mint,
      vestingAmount,
      ownerTokenAccount
    );
  };

  const handleInvokeContract = async () => {
    if (!publicKey) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      // Create Anchor provider
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction } as Wallet,
        {
          preflightCommitment: "processed",
        }
      );

      // Create a program instance using the IDL and program ID
      const program = new Program(abi as Idl, contract, provider);

      // Prepare parameters for the function call
      const params = {
        start: Math.floor(Date.now() / 1000) + 60, // Start in 60 seconds
        cliff: 3 * 30 * 24 * 60 * 60, // 3 months in seconds
        duration: 365 * 24 * 60 * 60, // 1 year in seconds
        slice_period: 24 * 60 * 60, // 1 day in seconds
        amount: 1000000000 * 10 ** 9, // Multiply with decimals (assuming 9 decimals)
        revocable: true,
      };

      // Transaction object for contract invocation
      const transaction = await program.methods
        .createVestingSchedule(params.amount)
        .accounts({
          vestingAccount: publicKey, // Example: Replace with the actual vesting account
          payer: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      if (!signTransaction) {
        throw new Error(
          "signTransaction is undefined. Ensure your wallet supports signing transactions."
        );
      }

      const signedTransaction = await signTransaction(transaction);

      // Sign the transaction using the wallet
      // const signedTransaction = await signTransaction(transaction);

      // Send the transaction
      const txid = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "processed",
        }
      );

      console.log("Transaction ID:", txid);
      alert(`Transaction successful! ID: ${txid}`);
    } catch (error: any) {
      console.error("Error invoking contract:", error);
      alert(`Transaction failed! Error: ${error?.message}`);
    }
  };

  if (typeof window === "undefined") return null;

  return (
    <div className="relative w-full h-[90%] flex flex-row space-x-4 items-start justify-center  p-8">
      <div className="w-[100%]  md:w-[50%] xl:w-[45%] h-[100%] bg-white shadow-sm py-8 px-10 rounded-xl border border-[#1597ff]/30 flex flex-col gap-y-6 ">
        {/* ****** Heading ******** */}
        <div className="text-black font-semibold text-xl  w-full relative ">
          Create Vesting Contract
        </div>
        {/* ****** Steps ******** */}
        <div className="flex flex-row">
          {steps.map((item: any, index: number) => (
            <div
              key={item}
              className="flex flex-row items-center justify-center"
            >
              <div
                className={`w-[100px] h-[60px] rounded-full border border-[#186dff]/20 flex items-center justify-center text-center text-xs text-black ${
                  (index == currentStep || index < currentStep) &&
                  " bg-[#186dff]"
                }`}
              >
                {item}
              </div>
              {item != "Create Contract" && (
                <div className="meter border border-[#186dff]/20">
                  <span className="w-[40px]">
                    <span
                      className={`${index < currentStep && "progress"}`}
                    ></span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Step 0 */}
        {currentStep == 0 && (
          <div className="w-full relative py-10 flex flex-col justify-between h-full">
            {!publicKey && (
              <div className="flex flex-col gap-3 mb-4 w-[42%] relative">
                <label
                  htmlFor="username"
                  className="text-black font-semibold text-base"
                >
                  Connect Wallet
                </label>
                <WalletMultiButton style={{ backgroundColor: "#1597ff" }} />
              </div>
            )}
            {publicKey && (
              <div className="flex flex-col gap-y-2  w-full relative">
                <label
                  htmlFor="address"
                  className="text-black font-semibold text-base mb-10"
                >
                  Wallet address
                </label>
                <input
                  autoFocus
                  id="username"
                  name="username"
                  value={publicKey?.toString()}
                  type="text"
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-[40px] px-2 w-full bg-transparent -translate-y-10 text-black border border-[#1597ff]/20 text-xsm rounded !outline-none placeholder:text-[#626262]"
                ></input>
              </div>
            )}
            <div className=" flex relative w-full items-center justify-end">
              <button
                disabled={!publicKey}
                className="flex px-6 py-2 text-white rounded-md bg-[#1597ff]  disabled:bg-gray-400"
                onClick={() => {
                  nextStep();
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {/* Step 1 */}
        {currentStep == 1 && (
          <>
            <div className="text-black font-semibold text-base">
              Token details
            </div>

            <div className="flex flex-col gap-1.5 mb-4 w-[80%] relative">
              <label htmlFor="address">Add Token Address</label>
              <input
                autoFocus
                id="address"
                name="address"
                type="text"
                value={tokenAddress}
                className="h-[40px] px-2 w-[full] bg-transparent text-black  border border-[#1597ff]/20 text-xsm rounded !outline-none placeholder:text-[#626262]"
                onChange={(e) => setTokenAddress(e.target.value)}
              ></input>
            </div>
            <div className=" flex relative w-full items-center justify-end mt-28">
              <button
                disabled={!tokenAddress}
                className="flex px-6 py-2 text-white rounded-md bg-[#1597ff]  disabled:bg-gray-400"
                onClick={() => {
                  nextStep();
                }}
              >
                Next
              </button>
            </div>
          </>
        )}
        {currentStep == 2 && (
          <div className="flex flex-col gap-y-2">
            <div className="text-black font-semibold text-base">
              Wallet details
            </div>
            <div className="relative w-full flex mb-2 flex-row items-center justify-start gap-x-8">
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative">
                <label htmlFor="username">Wallet address*</label>
                <input
                  autoFocus
                  id="username"
                  name="username"
                  type="text"
                  value={publicKey?.toString()}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-[40px] px-2 w-[full] bg-transparent text-black border border-[#1597ff]/20 text-xs rounded !outline-none placeholder:text-[#626262]"
                ></input>
              </div>
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative">
                <label htmlFor="username">Wallet nickname(optional)</label>
                <input
                  autoFocus
                  id="username"
                  name="username"
                  type="text"
                  // onChange={(e) => setUserName(e.target.value)}
                  className="h-[40px] px-2 w-full bg-transparent text-black border border-[#1597ff]/20 text-xsm rounded !outline-none placeholder:text-[#626262]"
                ></input>
              </div>
            </div>
            <div className="text-black font-semibold text-base">
              Schedule details
            </div>
            <div className="relative w-full flex flex-row mb-1 items-center justify-start gap-x-8">
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative">
                <label htmlFor="username">Number of tokens to vest*</label>
                <input
                  autoFocus
                  id="username"
                  name="username"
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-[40px] px-2 w-[full] bg-transparent text-black border border-[#1597ff]/20 text-xsm rounded !outline-none placeholder:text-[#626262]"
                ></input>
              </div>
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative">
                <label htmlFor="username">Vesting cadence*</label>
                <div className="h-[40px] px-2 w-full  text-black border border-[#1597ff]/20 text-xsm rounded flex justify-between items-center ">
                  <div>{cadencein}</div>
                  <button onClick={() => setIsDropdown(!isdropdown)}>
                    <MdKeyboardArrowDown className="text-black" />
                  </button>
                </div>
                {isdropdown && (
                  <div className="flex flex-col space-y-2 w-[220px] absolute top-[calc(100%+10px)] bg-white right-0.5 bg-prime-background-200 border border-[#1597ff]/20 p-2 rounded-md z-20">
                    {cadence?.map((item: any) => (
                      <div
                        key={item}
                        className=" text-black text-sm font-medium relative w-full hover:bg-slate-200 py-1 rounded-md px-2 "
                        onClick={() => {
                          setCadence(item);
                          setIsDropdown(false);
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="relative w-full flex flex-row mb-2 items-center justify-start gap-x-8  ">
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative">
                <label htmlFor="username">Start date & time (UTC)*</label>
                <DatePicker
                  className="max-w-sm max-h-full "
                  granularity="second"
                  value={start}
                  onChange={(date: any) => setStart(date)}
                  size="sm"
                  style={{ fontSize: "10px" }}
                  classNames={{
                    base: "border border-[#1597ff]/20 rounded-md h-[40px] text-[13px] relative bg-white flex items-center justify-center shadow-none ",

                    popoverContent:
                      "bg-white z-10  flex items-center justify-center w-[200px] border border-[#1597ff]/20 ",
                    calendarContent:
                      "bg-white z-10  w-[200px] relative  gap-2 border border-[#1597ff]/20",
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative translate-y-3">
                <label htmlFor="username">End date & time (UTC)*</label>
                <DatePicker
                  className="max-w-sm max-h-full "
                  granularity="second"
                  value={date}
                  onChange={(date: any) => setDate(date)}
                  size="sm"
                  style={{ fontSize: "10px" }}
                  classNames={{
                    base: "border border-[#1597ff]/20 rounded-md h-[40px] text-[13px] relative bg-white flex items-center justify-center shadow-none ",

                    popoverContent:
                      "bg-white z-10  flex items-center justify-center w-[200px] border border-[#1597ff]/20 ",
                    calendarContent:
                      "bg-white z-10  w-[200px] relative  gap-2 border border-[#1597ff]/20",
                  }}
                />
                <div
                  key="buttons"
                  className="flex flex-row gap-x-2 items-center justify-center"
                >
                  {dateShortcut.map((item: any) => (
                    <>
                      <button
                        key={item.name}
                        className=" flex justify-center items-center rounded-md bg-[#186dff]/20 text-[#186dff] p-1 text-xs font-semibold"
                        onClick={() => {
                          handleAddMonths(item?.value);
                        }}
                      >
                        {item?.name}
                      </button>
                    </>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative w-full flex flex-row mb-2 items-center justify-start gap-x-8  ">
              <div className="flex flex-col gap-1.5 mb-2 w-[42%] relative">
                <label htmlFor="username">Cliff Period(in months)</label>
                <input
                  autoFocus
                  id="cliff"
                  name="cliff"
                  type="text"
                  value={cliff}
                  onChange={(e) => {
                    {
                      setCliff(e.target.value);
                    }
                  }}
                  className="h-[40px] px-2 w-[full] bg-transparent text-black border border-[#1597ff]/20 text-xsm rounded !outline-none placeholder:text-[#626262]"
                ></input>
                {cliff > totalMonths && (
                  <div className="text-red-500 text-xs">
                    cliff period should be less than {totalMonths}
                  </div>
                )}
              </div>
              <div className=" flex relative w-full items-center justify-end mt-2">
                <button
                  disabled={
                    !publicKey || !cadence || !start || !date || !amount
                  }
                  className="flex px-6 py-2 text-white rounded-md bg-[#1597ff] disabled:bg-gray-400"
                  onClick={() => {
                    nextStep();
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        {currentStep == 3 && (
          <>
            <div className="flex relative w-full items-center justify-center mt-28">
              <button
                className="flex px-8 py-2 text-white rounded-md bg-[#186dff] shadow-sm"
                onClick={() => {
                  handleCreateVestingSchedule();
                }}
              >
                Create Contract
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Lock  */}
      <div className=" hidden md:flex items-center justify-center w-[40%] xl:w-[45%] h-[80%]">
        <img src="/locked.png" />
      </div>
    </div>
  );
};
export default Vesting;
// const now = Math.floor(Date.now() / 1000);
// await createVestingSchedule(
//     now + 86400,      // Starts tomorrow
//     7776000,          // 3 month cliff (90 days)
//     31536000,         // 1 year duration
//     2592000,          // Monthly slices (30 days)
//     1000000000,       // Amount (adjust decimals based on your token)
//     true,             // Revocable
//     // ... account public keys ...
// );
