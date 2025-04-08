import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Dreamwalk } from "../target/types/dreamwalk";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

describe("dreamwalk", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Dreamwalk as Program<Dreamwalk>;
  
  // We'll use this vault throughout our tests
  let vaultPDA: PublicKey;
  let vaultBump: number;

  // Test wallet for receiving transfers
  const receiver = new PublicKey("DLdhcvq1fRkps9fVZG3cdQ9Q9wFdeNeG51gpGXh8eDn5");
  console.log("Receiver public key", receiver.toString());

  // before(async () => {
  //   // Airdrop some SOL to our receiver for rent exemption
  //   const signature = await provider.connection.requestAirdrop(
  //     receiver.publicKey,
  //     LAMPORTS_PER_SOL
  //   );
  //   await provider.connection.confirmTransaction(signature);
  // });
  const [vaultKey, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );
  vaultPDA = vaultKey;
  vaultBump = bump;
    
  console.log("Vault PDA", vaultPDA.toString());
  console.log("Vault Bump", vaultBump);

  it("Initialize the vault", async () => {
  
    
    const tx = await program.methods
      .initialize()
      .accounts({
        vault: vaultPDA,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialization transaction signature", tx);
    console.log("Public key", provider.wallet.publicKey.toString());
    // Verify the vault was created
    const vaultAccount = await program.account.vault.fetch(vaultPDA);
    expect(vaultAccount.authority.toString()).to.equal(
      provider.wallet.publicKey.toString()
    );
    expect(vaultAccount.bump).to.equal(vaultBump);
  });

  it("Deposit funds to the vault", async () => {
    const depositAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
    
    // Get initial balances
    const initialUserBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    const initialVaultBalance = await provider.connection.getBalance(vaultPDA);

    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        vault: vaultPDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Deposit transaction signature", tx);

    // Verify the balances
    const finalUserBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    const finalVaultBalance = await provider.connection.getBalance(vaultPDA);

    console.log("Final user balance", finalUserBalance);
    console.log("Initial user balance", initialUserBalance);
    console.log("Deposit amount", depositAmount.toNumber());
    console.log("Final vault balance", finalVaultBalance);

    expect(finalUserBalance).to.be.below(initialUserBalance - depositAmount.toNumber());
    expect(finalVaultBalance).to.equal(initialVaultBalance + depositAmount.toNumber());
  });

  it("Transfer funds from vault to receiver", async () => {
    const transferAmount = new anchor.BN(0.2 * LAMPORTS_PER_SOL); // 0.2 SOL

    // Get initial balances
    const initialReceiverBalance = await provider.connection.getBalance(receiver);
    const initialVaultBalance = await provider.connection.getBalance(vaultPDA);

    const tx = await program.methods
      .transfer(transferAmount)
      .accounts({
        vault: vaultPDA,
        receiver: receiver,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Transfer transaction signature", tx);

    // Verify the balances
    const finalReceiverBalance = await provider.connection.getBalance(receiver);
    const finalVaultBalance = await provider.connection.getBalance(vaultPDA);

    expect(finalReceiverBalance).to.equal(initialReceiverBalance + transferAmount.toNumber());
    expect(finalVaultBalance).to.equal(initialVaultBalance - transferAmount.toNumber());
  });

  it("Should fail when non-authority tries to transfer", async () => {
    const transferAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    
    // Create a new keypair to act as unauthorized user
    const unauthorizedUser = anchor.web3.Keypair.fromSecretKey(new Uint8Array([231,162,143,170,145,114,108,69,40,48,25,208,51,159,183,89,50,122,6,194,228,208,48,103,98,149,114,108,198,58,234,210,245,193,240,10,16,237,196,252,165,148,72,156,13,5,29,213,203,212,101,165,137,49,62,201,236,122,87,204,192,55,42,173]));

    console.log("Unauthorized user public key", unauthorizedUser.publicKey.toString());
    console.log("Receiver public key", unauthorizedUser.secretKey.toString());
    // Airdrop some SOL to unauthorized user for transaction fee
    // const signature = await provider.connection.requestAirdrop(
    //   unauthorizedUser.publicKey,
    //   LAMPORTS_PER_SOL
    // );
    // await provider.connection.confirmTransaction(signature);

    try {
      await program.methods
        .transfer(transferAmount)
        .accounts({
          vault: vaultPDA,
          receiver: receiver,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      
      // If we reach here, the test should fail
      expect.fail("Expected transaction to fail");
    } catch (error) {
      // Transaction should fail
      console.log("Error", error);
      expect(error).to.be.an("error");
    }
  });
});
