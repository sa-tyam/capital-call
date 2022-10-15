use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::states::PoolState;
use crate::constants::*;

pub fn initialize_pool(
    ctx: Context<InitializePool>, 
    lp_supply: u64,
) -> Result<()> {

    let pool_state = &mut ctx.accounts.pool_state;

    pool_state.lp_supply = lp_supply;
    pool_state.credit_outstanding = 7348028;
    pool_state.is_active = true;

    Ok(())
}

pub fn disable_pool(
    ctx: Context<DisablePool>,
) -> Result<()> {

    let pool_state = &mut ctx.accounts.pool_state;

    pool_state.is_active = false;

    Ok(())
}

pub fn enable_pool(
    ctx: Context<EnablePool>,
) -> Result<()> {

    let pool_state = &mut ctx.accounts.pool_state;

    pool_state.is_active = true;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {

    #[account(mut)]
    pub authority: Signer<'info>,

    // mint for USDC
    pub mint: Account<'info, Mint>,
    
    // pool state of the pool
    #[account(
        init, 
        payer=authority, 
        seeds=[POOL_STATE_TAG, mint.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<PoolState>(),
    )]
    pub pool_state: Box<Account<'info, PoolState>>,

    // authority so 1 account passed in can derive all other pdas 
    /// CHECK: safe
    #[account(
        seeds=[POOL_AUTHORITY_TAG, pool_state.key().as_ref()], 
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    // account to hold USDC
    #[account(
        init, 
        payer=authority, 
        seeds=[POOL_VAULT_TAG, pool_state.key().as_ref()], 
        bump,
        token::mint = mint,
        token::authority = pool_authority
    )]
    pub pool_vault: Box<Account<'info, TokenAccount>>,

    // pool mint : used for pool token
    #[account(
        init, 
        payer=authority,
        seeds=[POOL_MINT_TAG, pool_state.key().as_ref()], 
        bump, 
        mint::decimals = 9,
        mint::authority = pool_authority
    )] 
    pub pool_mint: Box<Account<'info, Mint>>, 
   
    // accounts required to init a new mint
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DisablePool<'info> {

    #[account(mut)]
    pub authority: Signer<'info>,

    // mint for USDC
    pub mint: Account<'info, Mint>,
    
    // pool state of the pool
    #[account(
        mut, 
        seeds=[POOL_STATE_TAG, mint.key().as_ref()],
        bump,
    )]
    pub pool_state: Box<Account<'info, PoolState>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct EnablePool<'info> {

    #[account(mut)]
    pub authority: Signer<'info>,

    // mint for USDC
    pub mint: Account<'info, Mint>,
    
    // pool state of the pool
    #[account(
        mut, 
        seeds=[POOL_STATE_TAG, mint.key().as_ref()],
        bump,
    )]
    pub pool_state: Box<Account<'info, PoolState>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
