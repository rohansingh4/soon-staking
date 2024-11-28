const {anchor, AnchorProvider, Wallet, setProvider, Program, web3, BN} = require('@project-serum/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, Token, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

(async() => {
    try {
        const connection = new Connection('https://rpc.testnet.soo.network/rpc', 'confirmed');
        const wallet = new Wallet(Keypair.fromSecretKey(Uint8Array.from([
            123, 89, 57, 148, 75, 113, 197, 72, 224, 125, 118, 72, 158, 29, 81, 62, 49, 201, 249, 126, 226, 205, 128, 83, 132, 50, 199, 137, 80, 139, 118, 54, 63, 10, 56, 99, 197, 40, 246, 23, 173, 72, 43, 93, 152, 149, 106, 21, 97, 30, 72, 37, 16, 104, 145, 135, 54, 132, 163, 194, 153, 159, 126, 169,
        ])));

        const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
        setProvider(provider);

        const idlPath = './target/idl/staking_contract.json';
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

        // Load the program
        const programId = new PublicKey('66rNZNDufxtoJwGEFkQ9T6rm3P1Ex5Wd4V7MF6os1SVG');
        const program = new Program(idl, programId, provider);

        // Define the token mint
        const stakeTokenMint = new PublicKey('DnohjE7epPNSbLP9S6omUXn7JFrDznC98WLb2YWEKfdc');
        
        // Find the PDA for config account
        const [configPDA, _] = await PublicKey.findProgramAddress(
            [Buffer.from("config")],
            programId
        );

        console.log("Config PDA:", configPDA.toString());

        // Initialize the contract with APY
        const apy = 10; // 10% APY

        await program.methods
            .initializeContract(new BN(apy))
            .accounts({
                config: configPDA,
                admin: wallet.publicKey,
                realTokenMint: new PublicKey("11111111111111111111111111111111"), // Native SOL
                stakeTokenMint: stakeTokenMint,
                systemProgram: web3.SystemProgram.programId,
                rent: web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log('Contract initialized successfully');
        console.log('Config Account:', configPDA.toString());
        console.log('APY:', apy);
        
    } catch (error) {
        console.error('Error initializing contract:', error);
        // Print more detailed error information
        if (error.logs) {
            console.log('\nProgram Logs:', error.logs);
        }
    }
})();