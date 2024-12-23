use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("66rNZNDufxtoJwGEFkQ9T6rm3P1Ex5Wd4V7MF6os1SVG");

#[program]
pub mod staking_contract {
    use super::*;

    pub fn initialize_contract(
        ctx: Context<InitializeContract>,
        apy: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.real_token_mint = ctx.accounts.real_token_mint.key();
        config.stake_token_mint = ctx.accounts.stake_token_mint.key();
        config.apy = apy;
        config.total_pool_size = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        // Perform transfer before mutably borrowing accounts
        token::transfer(
            ctx.accounts
                .transfer_ctx()
                .with_signer(&[&[b"config", &[ctx.accounts.config.bump]]]),
            amount,
        )?;

        // Now mutably borrow accounts
        let user = &mut ctx.accounts.user;
        let config = &mut ctx.accounts.config;

        user.stake_info.amount += amount;
        user.stake_info.timestamp = Clock::get()?.unix_timestamp as u64;
        config.total_pool_size += amount;

        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let bump = ctx.accounts.config.bump;
        let current_time = Clock::get()?.unix_timestamp as u64;

        // Do token operations before mutable borrows
        token::transfer(
            ctx.accounts
                .transfer_ctx()
                .with_signer(&[&[b"config", &[bump]]]),
            amount,
        )?;

        token::mint_to(
            ctx.accounts
                .mint_ctx()
                .with_signer(&[&[b"config", &[bump]]]),
            amount,
        )?;

        // Now do mutable operations
        let user = &mut ctx.accounts.user;
        let config = &mut ctx.accounts.config;

        user.stake_info.amount += amount;
        user.stake_info.timestamp = current_time;
        config.total_pool_size += amount;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        // Ensure the user has enough tokens staked
        require!(ctx.accounts.user.stake_info.amount >= amount, StakingError::InsufficientStake);
        
        // Get the bump and perform token operations before mutable borrows
        let bump = ctx.accounts.config.bump;
        
        token::burn(
            ctx.accounts
                .burn_ctx()
                .with_signer(&[&[b"config", &[bump]]]),
            amount,
        )?;

        token::transfer(
            ctx.accounts
                .transfer_ctx()
                .with_signer(&[&[b"config", &[bump]]]),
            amount,
        )?;

        // Now do the mutable operations
        let user = &mut ctx.accounts.user;
        let config = &mut ctx.accounts.config;
        
        user.stake_info.amount -= amount;
        if user.stake_info.amount == 0 {
            user.stake_info.timestamp = 0;
        }
        config.total_pool_size -= amount;

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp as u64;
        let bump = ctx.accounts.config.bump;
        
        // Calculate rewards based on time staked and APY
        let duration = current_time - ctx.accounts.user.stake_info.timestamp;
        let rewards = (ctx.accounts.user.stake_info.amount as u128)
            .checked_mul(ctx.accounts.config.apy as u128)
            .unwrap()
            .checked_mul(duration as u128)
            .unwrap()
            / (100u128 * 365u128 * 24u128 * 3600u128);

        let rewards = rewards as u64;

        // Mint the rewards to the user
        token::mint_to(
            ctx.accounts
                .mint_ctx()
                .with_signer(&[&[b"config", &[bump]]]),
            rewards,
        )?;

        // Update timestamp after minting
        let user = &mut ctx.accounts.user;
        user.stake_info.timestamp = current_time;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(apy: u64)]
pub struct InitializeContract<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: This is not dangerous because we don't need to read or write data from this account
    pub real_token_mint: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't need to read or write data from this account
    pub stake_token_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Account<'info, User>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        constraint = user_real_token_account.mint == config.real_token_mint
    )]
    pub user_real_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = contract_real_token_account.mint == config.real_token_mint
    )]
    pub contract_real_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Deposit<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_real_token_account.to_account_info(),
                to: self.contract_real_token_account.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user_stake_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub contract_stake_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub stake_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Stake<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_stake_token_account.to_account_info(),
                to: self.contract_stake_token_account.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }

    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            token::MintTo {
                mint: self.stake_token_mint.to_account_info(),
                to: self.user_stake_token_account.to_account_info(),
                authority: self.config.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user_real_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub contract_real_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub stake_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Unstake<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.contract_real_token_account.to_account_info(),
                to: self.user_real_token_account.to_account_info(),
                authority: self.config.to_account_info(),
            },
        )
    }

    pub fn burn_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Burn<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            token::Burn {
                mint: self.stake_token_mint.to_account_info(),
                from: self.user_real_token_account.to_account_info(),
                authority: self.config.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub stake_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Claim<'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            token::MintTo {
                mint: self.stake_token_mint.to_account_info(),
                to: self.user.to_account_info(),
                authority: self.config.to_account_info(),
            },
        )
    }
}

#[account]
pub struct Config {
    pub real_token_mint: Pubkey,
    pub stake_token_mint: Pubkey,
    pub apy: u64,
    pub total_pool_size: u64,
    pub bump: u8,
}

impl Config {
    const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

#[account]
#[derive(Default)]
pub struct User {
    pub stake_info: StakeInfo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct StakeInfo {
    pub amount: u64,
    pub timestamp: u64,
}

#[error_code]
pub enum StakingError {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
}
