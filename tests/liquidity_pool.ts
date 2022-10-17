import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { LiquidityPool } from "../target/types/liquidity_pool";

import { assert, use } from "chai";
import * as token from "@solana/spl-token";
import * as web3 from "@solana/web3.js";

interface Pool {
  auth: web3.Keypair,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  poolVault: web3.PublicKey,
  poolMint: web3.PublicKey,
  poolState: web3.PublicKey,
  poolAuth: web3.PublicKey,
}

interface LPProvider {
  signer: web3.Keypair,
  user_ata: web3.PublicKey, 
  user_pool_ata: web3.PublicKey
}

describe("liquidity_pool", () => {

  // Configure the client to use the local cluster.
  let provider = anchor.AnchorProvider.env();
  let connection = provider.connection;
  anchor.setProvider(provider);
  
  const program = anchor.workspace.LiquidityPool as Program<LiquidityPool>;

  let pool: Pool;
  let n_decimals = 9;

  it("Initialize pool", async () => {

    // initialize new signer and airdrop sols
    let auth = web3.Keypair.generate();
    let sig = await connection.requestAirdrop(auth.publicKey, 100 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);

    // We are using new token to test (we can use USDC as well)
    let mint = await token.createMint(
      connection, 
      auth, 
      auth.publicKey, 
      auth.publicKey, 
      n_decimals, 
    );

    // address of poolState
    let [poolState, poolState_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("state"), mint.toBuffer()], 
      program.programId,
    );

    // pool authority
    let [authority, authority_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("authority"), poolState.toBuffer()], 
      program.programId,
    );

    // account address for token
    let [vault, vault_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("vault"), poolState.toBuffer()], 
      program.programId,
    );

    // mint for LP Token
    let [poolMint, poolMint_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("mint"), poolState.toBuffer()], 
      program.programId,
    );

    // lp supply required
    let lp_supply = new anchor.BN(120 * web3.LAMPORTS_PER_SOL);
    let duration_in_minute = new anchor.BN(1);

    // Call the function to test
    const tx = await program.rpc.initializePool(
      lp_supply,
      duration_in_minute,
      {
        accounts: {
          mint: mint, 
          poolAuthority: authority,
          poolVault: vault,
          poolMint: poolMint,
          poolState: poolState,
          // the rest 
          authority: provider.wallet.publicKey, 
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        }
      }
    );
    console.log("transaction signature", tx);

    // save pool data for uses in other test cases
    pool = {
      auth: auth,
      payer: auth,
      mint: mint,
      poolVault: vault,
      poolMint: poolMint,
      poolState: poolState,
      poolAuth: authority, 
    }
  });

  // helper function 
  async function setup_lp_provider(lp_user: web3.PublicKey, amount: number) {

    // user account for token
    let user_ata = await token.createAssociatedTokenAccount(
      connection, pool.payer, pool.mint, lp_user);

    // user account for LP Token
    let user_pool_ata = await token.createAssociatedTokenAccount(
      connection, pool.payer, pool.poolMint, lp_user);

    // setup initial balance of token
    await token.mintTo(connection, 
      pool.payer, 
      pool.mint, 
      user_ata, 
      pool.auth, 
      amount * 10 ** n_decimals
    );

    // return the associated token accounts
    return [user_ata, user_pool_ata]
  }

  // helper function: returns the balance of token account
  async function get_token_balance(pk) {
    return (await connection.getTokenAccountBalance(pk)).value.uiAmount;
  }

  // return byte array of amount
  function lp_amount(n) {
    return new anchor.BN(n * 10 ** n_decimals)
  }

  // to be saved and used in other test cases
  let lp_user0: LPProvider;

  it("add initial liquidity to the pool", async () => {

    // create a new Liquidity Pool signer
    let lp_user_signer = web3.Keypair.generate();
    let sig = await connection.requestAirdrop(lp_user_signer.publicKey, 100 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);

    let lp_user = lp_user_signer.publicKey;
    let [user_ata, user_pool_ata] = await setup_lp_provider(lp_user, 100);

    // save LP signer for use in other test cases
    lp_user0 = {
      signer: lp_user_signer,
      user_ata: user_ata, 
      user_pool_ata: user_pool_ata
    };

    // initial amount of token to be added
    let amount_in = lp_amount(50);

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user_signer.publicKey.toBuffer()], 
      program.programId,
    );

    // call the addLiquidity function to test
    const tx = await program.rpc.addLiquidity(
      amount_in,
      {
        accounts: {
          mint: pool.mint, 
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          poolState: pool.poolState,
          userAta: user_ata,
          transactionAccount: transaction_account,
          // the rest 
          owner: lp_user, 
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user_signer]
      }
    );
    
    console.log("transaction signature", tx);

    // assert the user balance has been deducted
    let user_balance = await get_token_balance(user_ata);
    assert(user_balance <= 50);
  });

  // to be saved and used in other test cases
  let lp_user1: LPProvider;

  it("add second liquidity to the pool", async () => {

    // create a new Liquidity Pool signer
    let lp_user_signer = web3.Keypair.generate();
    let sig = await connection.requestAirdrop(lp_user_signer.publicKey, 100 * web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);

    let lp_user = lp_user_signer.publicKey;
    let [user_ata, user_pool_ata] = await setup_lp_provider(lp_user, 100);

    // save LP signer for use in other test cases
    lp_user1 = {
      signer: lp_user_signer,
      user_ata: user_ata, 
      user_pool_ata: user_pool_ata
    };

    // initial amount of token to be deposited
    let amount_in = lp_amount(40);

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user_signer.publicKey.toBuffer()], 
      program.programId,
    );

    // call the addLiquidity function to test
    const tx = await program.rpc.addLiquidity(
      amount_in,
      {
        accounts: {
          mint: pool.mint, 
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          poolState: pool.poolState,
          userAta: user_ata,
          transactionAccount: transaction_account,
          // the rest 
          owner: lp_user, 
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user_signer]
      }
    );

    console.log("transaction signature", tx);

    // assert user balance has been deducted
    let user_balance = await get_token_balance(user_ata);
    assert(user_balance <= 60);
    
    // sleep for 1 miute
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    await sleep(60000);
  });

  // case: required capital amount was not raised
  // token (USDC) shall be transferred back
  // No new LP Token should be minted
  it("ask output from pool for lp_user0", async () => {

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user0.signer.publicKey.toBuffer()], 
      program.programId,
    );

    const tx = await program.rpc.askOutput(
      {
        accounts : {
          owner: lp_user0.signer.publicKey,
          mint: pool.mint,
          poolState: pool.poolState,
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          userAta: lp_user0.user_ata,
          userPoolAta: lp_user0.user_pool_ata,
          transactionAccount: transaction_account,

          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user0.signer]
      }
    );

    console.log("transaction signature", tx);

    let user_balance = await get_token_balance(lp_user0.user_ata);
    let user_pool_balance = await get_token_balance(lp_user0.user_pool_ata);
    console.log("user balances: ", user_balance.toString(), user_pool_balance.toString());

    // assert the token (USDC) is transferred back
    // assert no LP Token has been transferred
    assert(user_balance > 50);
    assert(user_pool_balance == 0);
  });

  // case: required capital amount was not raised
  // token (USDC) shall be transferred back
  // No new pool token should be minted
  it("ask output from pool for lp_user1", async () => {

    // transaction
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user1.signer.publicKey.toBuffer()], 
      program.programId,
    );

    const tx = await program.rpc.askOutput(
      {
        accounts : {
          owner: lp_user1.signer.publicKey,
          mint: pool.mint,
          poolState: pool.poolState,
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          userAta: lp_user1.user_ata,
          userPoolAta: lp_user1.user_pool_ata,
          transactionAccount: transaction_account,

          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user1.signer]
      }
    );

    console.log("transaction signature", tx);

    let user_balance = await get_token_balance(lp_user1.user_ata);
    let user_pool_balance = await get_token_balance(lp_user1.user_pool_ata);
    console.log("user balances: ", user_balance.toString(), user_pool_balance.toString());

    // assert the token (USDC) is transferred back
    // assert no LP Token has been transferred
    assert(user_balance > 60);
    assert(user_pool_balance == 0);
  });

  // enable the pool again to test other cases
  it("enable the pool to receive funds", async () => {
    const tx = await program.rpc.enablePool(
      {
        accounts: {
          mint: pool.mint,
          poolState: pool.poolState,

          authority: provider.wallet.publicKey, 
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        }
      }
    );

    console.log("transaction signature", tx);

    let poolState = await program.account.poolState.fetch(pool.poolState);
    let poolIsActive = poolState.isActive;
    assert(poolIsActive == true)
  });

  it("add liquidity to the pool for lp_user0", async () => {

    // amount of token to be deposited
    let amount_in = lp_amount(70);

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user0.signer.publicKey.toBuffer()], 
      program.programId,
    );

    // call the addLiquidity function to test
    const tx = await program.rpc.addLiquidity(
      amount_in,
      {
        accounts: {
          mint: pool.mint, 
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          poolState: pool.poolState,
          userAta: lp_user0.user_ata,
          transactionAccount: transaction_account,
          // the rest 
          owner: lp_user0.signer.publicKey, 
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user0.signer]
      }
    );
    
    console.log("transaction signature", tx);

    // assert user balance has been deducted
    let user_balance = await get_token_balance(lp_user0.user_ata);
    assert(user_balance <= 30);
  });

  it("add second liquidity to the pool", async () => {

    // amount of token to be deposited
    let amount_in = lp_amount(60);

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user1.signer.publicKey.toBuffer()], 
      program.programId,
    );

    // call the addLiquidity function to test
    const tx = await program.rpc.addLiquidity(
      amount_in,
      {
        accounts: {
          mint: pool.mint, 
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          poolState: pool.poolState,
          userAta: lp_user1.user_ata,
          transactionAccount: transaction_account,
          // the rest 
          owner: lp_user1.signer.publicKey, 
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user1.signer]
      }
    );

    console.log("transaction signature", tx);

    // assert user balance has been deducted
    let user_balance = await get_token_balance(lp_user1.user_ata);
    assert(user_balance <= 40);

     // sleep for 1 miute
     const sleep = (ms) => new Promise(r => setTimeout(r, ms));
     await sleep(60000);
  });

  // case: required capital has been raised
  // LP Tokens are transferred
  // USDC tokens are not transferred back
  it("ask output from pool for lp_user0", async () => {

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user0.signer.publicKey.toBuffer()], 
      program.programId,
    );

    const tx = await program.rpc.askOutput(
      {
        accounts : {
          owner: lp_user0.signer.publicKey,
          mint: pool.mint,
          poolState: pool.poolState,
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          userAta: lp_user0.user_ata,
          userPoolAta: lp_user0.user_pool_ata,
          transactionAccount: transaction_account,

          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user0.signer]
      }
    );

    console.log("transaction signature", tx);

    let user_balance = await get_token_balance(lp_user0.user_ata);
    let user_pool_balance = await get_token_balance(lp_user0.user_pool_ata);
    console.log("user balances: ", user_balance.toString(), user_pool_balance.toString());

    // assert USDC tokens are not transferred back
    // assert LP Tokens are transferred to user
    assert(user_balance <= 30);
    assert(user_pool_balance >= 0);
  });

  // case: required capital has been raised
  // LP Tokens are transferred
  // USDC tokens are not transferred back
  it("ask output from pool for lp_user1", async () => {

    // transaction account
    let [transaction_account, transaction_account_b] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("transaction"), lp_user1.signer.publicKey.toBuffer()], 
      program.programId,
    );

    const tx = await program.rpc.askOutput(
      {
        accounts : {
          owner: lp_user1.signer.publicKey,
          mint: pool.mint,
          poolState: pool.poolState,
          poolAuthority: pool.poolAuth,
          poolVault: pool.poolVault,
          poolMint: pool.poolMint,
          userAta: lp_user1.user_ata,
          userPoolAta: lp_user1.user_pool_ata,
          transactionAccount: transaction_account,

          systemProgram: web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID, 
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID, 
          rent: web3.SYSVAR_RENT_PUBKEY
        },
        signers: [lp_user1.signer]
      }
    );

    console.log("transaction signature", tx);

    let user_balance = await get_token_balance(lp_user1.user_ata);
    let user_pool_balance = await get_token_balance(lp_user1.user_pool_ata);
    console.log("user balances: ", user_balance.toString(), user_pool_balance.toString());

    // assert USDC tokens are not transferred back
    // assert LP Tokens are transferred to user
    assert(user_balance <= 40);
    assert(user_pool_balance >= 0);
  });
});
