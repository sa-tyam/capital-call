# capital-call

## Problem statement

Capital is needed for a deal on Credix, but we don’t have enough capital in our pool, 
so we have to launch a ‘capital call’. During a capital call, investors can deposit USDC for a specific duration. 
If the needed capital is raised during this timeframe, the investors can claim LP tokens. If the capital is not raised, 
they should be able to withdraw their initial USDC investment.

## Solution

- Initialize the pool with required amount of capital. We call it `lp_supply` in code. Use function `initialize_pool` for the same.
- User can deposit only when pool is active, i.e., `is_active` field of `poolState` is true. While initializing pool, it is set to true. Use function `enable_pool` for the same.
- User can withdraw from pool only if pool is disabled, i.e., `is_active` field of `poolState` is set to false. Use function `disable_pool` for the same.
- User can use `add_liquidity` function to add USDC tokens to the pool. (Code is generalized for any token. We specify the token to be used while initializing the pool). We create a new account called `transaction_account` to keep record of the amount of USDC deposited. We use this account later to transfer the tokens back to the user.
- User can ask for LP Token or get back their initial deposit of USDC by calling the function `ask_output`. If the required capital has been raised, LP Tokens are transferred to user, else the initial deposit of USDc is transferred back. Once the transfers have been made, the `transaction_account` is closed.

## Tests Added

- Test 1: initialize the pool with required capital as `120`.
- Test 2: user 1 adds `50` tokens to the pool.
- Test 3: user 2 adds `40` tokens to the pool.
- Test 4: disable the pool.
- Test 5: user 1 asks for output. It gets back USDC as total capital raised in less than 120, i.e., `(50 + 40 < 120)`
- Test 6: user 2 asks for output. It gets back USDC as total capital raised in less than 120, i.e., `(40 + 50 < 120)`
- test 7: enable the pool.
- Test 8: user 1 adds `70` tokens to the pool.
- Test 9: user 2 adds `60` tokens to the pool.
- Test 10: disable the pool.
- Test 11: user 1 asks for output. It gets back Pool Token as total capital raised in more than 120, i.e., `(70 + 60 > 120)`
- Test 12: user 2 asks for output. It gets back Pool Token as total capital raised in more than 120, i.e., `(60 + 70 > 120)`

## Commands
Use the commands from root directory.
- `anchor build`: to build the project.
- `anchor deploy`: to deploy the project on localnet.
- `anchor test`: to run the added tests.

## Note
Make sure to change the progam id in `lib.rs` and `Anchor.toml` with your own program id.
