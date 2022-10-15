use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct PoolState {
    pub lp_supply: u64,
    pub credit_outstanding: u64,
    pub is_active: bool,
}

#[account]
#[derive(Default)]
pub struct TransactionAccount {
    pub authority: Pubkey, 
    pub amount: u64, 
    pub is_paid: bool,
}
