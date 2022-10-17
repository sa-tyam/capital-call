use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct PoolState {
    pub lp_supply: u64,
    pub duration_in_minutes: u64,
    pub credit_outstanding: u64,
    pub is_active: bool,
    pub activation_time: u64
}

#[account]
#[derive(Default)]
pub struct TransactionAccount {
    pub authority: Pubkey, 
    pub amount: u64, 
}
