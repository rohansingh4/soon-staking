const {anchor, AnchorProvider, Wallet, setProvider, Program, web3, BN} = require('@project-serum/anchor');
const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
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

        const programId = new PublicKey('66rNZNDufxtoJwGEFkQ9T6rm3P1Ex5Wd4V7MF6os1SVG');
        const program = new Program(JSON.parse(fs.readFileSync('./target/idl/staking_contract.json', 'utf8')), programId, provider);

        // Get Config PDA (already initialized)
        const [configPDA, _] = await PublicKey.findProgramAddress(
            [Buffer.from("config")],
            programId
        );

        // Get User PDA
        const [userPDA, userBump] = await PublicKey.findProgramAddress(
            [Buffer.from("user"), wallet.publicKey.toBuffer()],
            programId
        );

        // Define token accounts
        const stakeTokenMint = new PublicKey('QDq8qKjaYi6Zyv5PsvMrm5gYvEEXqCQWxMNkb1bLDJP');
        
        // Get user's associated token account
        const userStakeTokenAccount = await getAssociatedTokenAddress(
            stakeTokenMint,
            wallet.publicKey
        );

        // Contract's token account
        const contractStakeTokenAccount = new PublicKey("5F5iyvuEA7KeRwseuy8vA1miaNSajLMiyp2c9NeRgGGp");

        // Initialize user account
        console.log('Initializing user account...');
        try {
            await program.methods
                .initializeUser()
                .accounts({
                    user: userPDA,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('User account initialized successfully');
        } catch (initError) {
            if (initError.message.includes('already in use')) {
                console.log('User account already initialized');
            } else {
                throw initError;
            }
        }

        // Amount to stake (1 SOL)
        const amount = new BN(1 * web3.LAMPORTS_PER_SOL);

        console.log('Starting stake operation...');
        console.log('Amount to stake:', amount.toString(), 'lamports (1 SOL)');
        console.log('User PDA:', userPDA.toString());
        console.log('Config PDA:', configPDA.toString());
        console.log('User Stake Token Account:', userStakeTokenAccount.toString());
        console.log('Contract Stake Token Account:', contractStakeTokenAccount.toString());

        // Call the stake function
        const tx = await program.methods
            .stake(amount)
            .accounts({
                user: userPDA,
                config: configPDA,
                authority: wallet.publicKey,
                userStakeTokenAccount: userStakeTokenAccount,
                contractStakeTokenAccount: contractStakeTokenAccount,
                stakeTokenMint: stakeTokenMint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log('Transaction successful!');
        console.log('Signature:', tx);
        console.log('Successfully staked 1 SOL');

        // Check balances after staking
        const userTokenBalance = await connection.getTokenAccountBalance(userStakeTokenAccount);
        console.log('User stake token balance:', userTokenBalance.value.uiAmount);
        
    } catch (error) {
        console.error('Error:', error);
        if (error.logs) {
            console.log('\nProgram Logs:', error.logs);
        }
    }
})();