use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Src Balance less than LP Deposit Amount.")]
    NotEnoughBalance,
    #[msg("Pool still active")]
    PoolStillActive,
    #[msg("Pool not active")]
    PoolNotActive,
}