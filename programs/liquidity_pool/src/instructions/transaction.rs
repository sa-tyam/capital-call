use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token,
    token::{Mint, MintTo, Token, TokenAccount, Transfer},
};


use crate::states::*;
use crate::errors::ErrorCode;
use crate::constants::*;

pub fn add_liquidity (
    ctx: Context<AddLiquidity>, 
    amount_in: u64,
) -> Result<()> {

    // check if pool is active
    let pool_state = &mut ctx.accounts.pool_state;
    require!(pool_state.is_active, ErrorCode::PoolNotActive);

    // check if user have enough balance
    let user_balance = ctx.accounts.user_ata.amount;
    require!(amount_in <= user_balance, ErrorCode::NotEnoughBalance);

    // transfer tokens
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.user_ata.to_account_info(), 
                to: ctx.accounts.pool_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(), 
            }
        ), 
        amount_in
    )?;

    // update the transaction account values
    let transaction_account = &mut ctx.accounts.transaction_account;
    transaction_account.authority = ctx.accounts.owner.key();
    transaction_account.amount = amount_in;

    Ok(())
}

pub fn ask_output (
    ctx: Context<AskOutput>, 
) -> Result<()> {

    // check if pool is active
    let pool_state = &mut ctx.accounts.pool_state;
    require!(!pool_state.is_active, ErrorCode::PoolStillActive);

    let transaction_account = &mut ctx.accounts.transaction_account;

    let bump = *ctx.bumps.get("pool_authority").unwrap();
    let pool_key = pool_state.key();
    let pda_sign = &[POOL_AUTHORITY_TAG, pool_key.as_ref(), &[bump]];

    let pool_vault = &mut ctx.accounts.pool_vault;
    // if pool amount > lp supply or not
    if pool_vault.amount >= pool_state.lp_supply {

        // mint pool tokens
        let mint_amount = 10;

        // transfer pool token to user account
        let mint_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(), 
            MintTo {
                to: ctx.accounts.user_pool_ata.to_account_info(),
                mint: ctx.accounts.pool_mint.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            }
        );

        token::mint_to(
            mint_ctx.with_signer(&[pda_sign]), 
            mint_amount
        )?;

    } else {

        // transfer back usdc tokens
        // transfer output amount from pool vault to user account
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(), 
            Transfer {
                from: ctx.accounts.pool_vault.to_account_info(), 
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(), 
            }
        ).with_signer(&[pda_sign]), transaction_account.amount as u64)?;
    }

    Ok(())
}


#[derive(Accounts)]
pub struct AddLiquidity<'info> {

    #[account(mut)]
    pub owner: Signer<'info>,

    // mint for USDC
    pub mint: Account<'info, Mint>,
    
    // pool state of the pool
    #[account(
        mut, 
        seeds=[POOL_STATE_TAG, mint.key().as_ref()],
        bump,
    )]
    pub pool_state: Box<Account<'info, PoolState>>,

    // pda to sign transactions 
    /// CHECK: safe
    #[account(
        seeds=[POOL_AUTHORITY_TAG, pool_state.key().as_ref()], 
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    // account to hold USDC
    #[account(
        mut, 
        seeds=[POOL_VAULT_TAG, pool_state.key().as_ref()], 
        bump,
    )]
    pub pool_vault: Box<Account<'info, TokenAccount>>,

    // pool mint : used for pool token
    #[account(
        mut, 
        seeds=[POOL_MINT_TAG, pool_state.key().as_ref()], 
        bump, 
    )] 
    pub pool_mint: Box<Account<'info, Mint>>, 

    // user accounts
    // user usdc ata
    #[account(
        mut, 
        has_one = owner
    )]
    pub user_ata: Box<Account<'info, TokenAccount>>,

    // transaction account
    #[account(
        init, 
        payer=owner, 
        seeds=[TRANSACTION_TAG, owner.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<TransactionAccount>(),
    )]
    pub transaction_account: Box<Account<'info, TransactionAccount>>,
   
    // accounts required to init a new mint
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AskOutput<'info> {

    #[account(mut)]
    pub owner: Signer<'info>,

    // mint for USDC
    pub mint: Account<'info, Mint>,
    
    // pool state of the pool
    #[account(
        mut, 
        seeds=[POOL_STATE_TAG, mint.key().as_ref()],
        bump,
    )]
    pub pool_state: Box<Account<'info, PoolState>>,

    // pda to sign transactions 
    /// CHECK: safe
    #[account(
        seeds=[POOL_AUTHORITY_TAG, pool_state.key().as_ref()], 
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    // account to hold USDC
    #[account(
        mut, 
        constraint = pool_vault.mint == user_ata.mint,
        seeds=[POOL_VAULT_TAG, pool_state.key().as_ref()], 
        bump,
    )]
    pub pool_vault: Box<Account<'info, TokenAccount>>,

    // pool mint : used for pool token
    #[account(
        mut, 
        constraint = user_pool_ata.mint == pool_mint.key(),
        seeds=[POOL_MINT_TAG, pool_state.key().as_ref()], 
        bump, 
    )] 
    pub pool_mint: Box<Account<'info, Mint>>, 

    // user account for USDC
    #[account(
        mut, 
        has_one = owner
    )]
    pub user_ata: Box<Account<'info, TokenAccount>>, 

    // user account for pool token
    #[account(
        mut, 
        has_one = owner
    )]
    pub user_pool_ata: Box<Account<'info, TokenAccount>>,  

    // transaction account
    #[account(
        mut, 
        close = owner,
        seeds=[TRANSACTION_TAG, owner.key().as_ref()],
        bump,
    )]
    pub transaction_account: Box<Account<'info, TransactionAccount>>,
   
    // accounts required to init a new mint
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}