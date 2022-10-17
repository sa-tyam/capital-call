use anchor_lang::prelude::*;

pub mod errors; 
pub mod states; 
pub mod instructions;
pub mod constants;

use instructions::*;


declare_id!("94WfDh24f8Z3WK2Yr63K86cv9pHPUUqB5SWsZNKLk3FM");

#[program]
pub mod liquidity_pool {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>, 
        lp_supply: u64,
        duration_in_minutes: u64,
    ) -> Result<()> {
        pool::initialize_pool(ctx, lp_supply, duration_in_minutes)
    }

    pub fn disable_pool(
        ctx: Context<DisablePool>, 
    ) -> Result<()> {
        pool::disable_pool(ctx)
    }

    pub fn enable_pool(
        ctx: Context<EnablePool>, 
    ) -> Result<()> {
        pool::enable_pool(ctx)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>, 
        amount_in: u64,
    ) -> Result<()> {
        transaction::add_liquidity(ctx, amount_in)
    }

    pub fn ask_output(
        ctx: Context<AskOutput>, 
    ) -> Result<()> {
        transaction::ask_output(ctx)
    }
}
