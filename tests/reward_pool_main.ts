import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RewardPoolMain } from "../target/types/reward_pool_main";
import { assert } from "chai";
import { createMint, createAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import * as token from '@solana/spl-token';
// Función para realizar el airdrop
async function airdrop(connection, pubkey) {
  const airdropSignature = await connection.requestAirdrop(pubkey, 1e9); // 1 SOL
  await connection.confirmTransaction(airdropSignature, "confirmed");
}

describe("reward_pool_main", () => {
  const provider = anchor.AnchorProvider.local("http://127.0.0.1:8899");
  anchor.setProvider(provider);

  // const connection = provider.connection;
  const wallet = provider.wallet;
  const program = anchor.workspace.RewardPoolMain as Program<RewardPoolMain>;

  const rewardPoolKp = anchor.web3.Keypair.generate();
  // const taxRecipientKp = anchor.web3.Keypair.generate();
  // const campaignTokenKp = anchor.web3.Keypair.generate();

  const a_to_b_mint_authority = anchor.web3.Keypair.generate();
  const a_to_c_mint_authority = anchor.web3.Keypair.generate();

  const payer = anchor.web3.Keypair.generate();
  const payer2 = anchor.web3.Keypair.generate();
  const signerName = anchor.web3.Keypair.generate();


  let a_to_c_mint;
  let a_to_b_mint;

  let taxRecipientAccount;
  let campaignTokenAccount;

  // const taxRecipientAccount = anchor.web3.Keypair.generate();
  // const campaignTokenAccount = anchor.web3.Keypair.generate();

  // let campaignMint;
  // let campaignTokenAccount;
  // let taxRecipientAccount;


  //========================
  // ititialize
  //========================
  it("Initializes the reward pool", async () => {
    // Asegurarse de que el `wallet` tiene fondos suficientes
    await airdrop(provider.connection, wallet.publicKey);
    await airdrop(provider.connection, signerName.publicKey);
  
    // Ejecutar la transacción de inicialización para crear la cuenta de Reward Pool
    await program.methods
      .initialize(signerName.publicKey)
      .accounts({
        rewardPool: rewardPoolKp.publicKey, // Nueva cuenta de Reward Pool
        user: signerName.publicKey, // Firmante principal
        systemProgram: SystemProgram.programId,
      })
      .signers([rewardPoolKp, signerName]) // Firmar para inicializar la cuenta
      .rpc();
  
    // Recuperar la cuenta recién creada para verificar su estado
    const rewardPoolAccount = await program.account.rewardPoolState.fetch(rewardPoolKp.publicKey);
  
    // Verificar que la cuenta tenga los valores correctos
    assert.strictEqual(
      rewardPoolAccount.owner.toBase58(),
      signerName.publicKey.toBase58(),
      "Propietario incorrecto"
    );
    assert.strictEqual(
      rewardPoolAccount.taxRecipient.toBase58(),
      signerName.publicKey.toBase58(),
      "Beneficiario de impuestos incorrecto"
    );
  
    // Verificar que el campo `authorized_signer` esté inicializado correctamente
    assert.strictEqual(
      rewardPoolAccount.authorizedSigner.toBase58(),
      signerName.publicKey.toBase58(), // El authorized_signer inicial debe coincidir con el owner
      "El authorized_signer debería ser igual al owner"
    );
  
    // Verificar que el campo `paused` esté inicializado correctamente
    assert.isFalse(
      rewardPoolAccount.paused,
      "El estado pausado debería ser falso por defecto"
    );
  });
  

  //========================
  // pause
  //========================
  it("Pauses the reward pool", async () => {
    // Pausar el Reward Pool
    await program.methods
      .pause()
      .accounts({
        rewardPool: rewardPoolKp.publicKey,
        owner: signerName.publicKey, // Dueño original como firmante
      })
      .signers([signerName]) // Firmar para inicializar la cuenta
      .rpc(); // El wallet firmará automáticamente

    // Verificar que el Reward Pool esté pausado
    const rewardPoolAccount = await program.account.rewardPoolState.fetch(rewardPoolKp.publicKey);
    assert.isTrue(rewardPoolAccount.paused, "El estado pausado debería ser verdadero");
  });

  //========================
  // unpause
  //========================
  it("Unpauses the reward pool", async () => {
    // Reactivar el Reward Pool
    await program.methods
      .unpause()
      .accounts({
        rewardPool: rewardPoolKp.publicKey,
        owner: signerName.publicKey, // Dueño original como firmante
      })
      .signers([signerName]) // Firmar para inicializar la cuenta
      .rpc(); // El wallet firmará automáticamente

    // Verificar que el Reward Pool esté activo nuevamente
    const rewardPoolAccount = await program.account.rewardPoolState.fetch(rewardPoolKp.publicKey);
    assert.isFalse(rewardPoolAccount.paused, "El estado pausado debería ser falso nuevamente");
  });

  //========================
  // setAuthorizedSigner
  //========================
  it("Sets a new authorized signer for the reward pool", async () => {
    // Generar un nuevo Keypair para el nuevo `authorized_signer`
    const newAuthorizedSigner = Keypair.generate();
  
    // Establecer el nuevo `authorized_signer`
    await program.methods
      .setAuthorizedSigner(newAuthorizedSigner.publicKey)
      .accounts({
        rewardPool: rewardPoolKp.publicKey,
        owner: signerName.publicKey, // El dueño original que debe autorizar el cambio
      })
      .signers([signerName]) // Firmar para inicializar la cuenta
      .rpc(); // El wallet firmará automáticamente
  
    // Verificar que el nuevo `authorized_signer` esté correctamente configurado
    const updatedRewardPoolAccount = await program.account.rewardPoolState.fetch(rewardPoolKp.publicKey);
    assert.strictEqual(
      updatedRewardPoolAccount.authorizedSigner.toBase58(),
      newAuthorizedSigner.publicKey.toBase58(),
      "El authorized_signer no se ha actualizado correctamente"
    );
  });

  //========================
  // setTaxRecipient
  //========================
  it("Sets a new tax recipient for the reward pool", async () => {
    // Generar un nuevo Keypair para el nuevo `tax_recipient`
    const newTaxRecipient = Keypair.generate();
  
    // Verificar que el `reward_pool` esté correctamente inicializado con el `owner`
    const rewardPoolAccount = await program.account.rewardPoolState.fetch(rewardPoolKp.publicKey);
    assert.strictEqual(
      rewardPoolAccount.owner.toBase58(),
      signerName.publicKey.toBase58(),
      "El propietario debería ser el owner correcto"
    );
  
    // Ejecutar la transacción `set_tax_recipient` para cambiar el beneficiario de impuestos
    await program.methods
      .setTaxRecipient(newTaxRecipient.publicKey)
      .accounts({
        rewardPool: rewardPoolKp.publicKey,
        owner: signerName.publicKey, // El propietario debe firmar el cambio
      })
      .signers([signerName]) // Firmar para inicializar la cuenta
      .rpc(); // Firmar automáticamente con `wallet`
  
    // Verificar que el nuevo `tax_recipient` esté correctamente configurado
    const updatedRewardPoolAccount = await program.account.rewardPoolState.fetch(rewardPoolKp.publicKey);
    assert.strictEqual(
      updatedRewardPoolAccount.taxRecipient.toBase58(),
      newTaxRecipient.publicKey.toBase58(),
      "El tax_recipient no se ha actualizado correctamente"
    );
  });

  //========================
  // depositReward
  //========================
  //@audit => Fail
  // Depósito de recompensas en el Reward Pool
  it("Deposits rewards correctly", async () => {
  
    // Asegurarse de que el pagador tenga fondos suficientes
    await airdrop(provider.connection, payer.publicKey);
    await airdrop(provider.connection, a_to_c_mint_authority.publicKey);
    await airdrop(provider.connection, a_to_b_mint_authority.publicKey);
    await airdrop(provider.connection, signerName.publicKey);
    await airdrop(provider.connection, rewardPoolKp.publicKey);
  
    // Crear un mint para la campaña usando el Keypair del pagador
    a_to_c_mint = await token.createMint(provider.connection, a_to_c_mint_authority, a_to_c_mint_authority.publicKey, null, 9);
    a_to_b_mint = await token.createMint(provider.connection, a_to_b_mint_authority, a_to_b_mint_authority.publicKey, null, 9);
  
    // Crear cuentas de token para `tax_recipient_account` y `campaign_token_account`
    taxRecipientAccount = await token.createAccount(provider.connection, signerName, a_to_c_mint, signerName.publicKey);
    campaignTokenAccount = await token.createAccount(provider.connection, signerName, a_to_b_mint, signerName.publicKey);
  
    
    // Definir los valores de la campaña y las tarifas
    const campaignAmount = new BN(500);
    const feeAmount = new BN(50);
    const campaignId = new BN(1);
    
    // Generar el PDA para `reward_info`
    const [rewardInfoPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("reward_info"), new anchor.BN(campaignId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    // Mint tokens al pagador para simular el saldo del usuario
    await token.mintTo(provider.connection, signerName, a_to_c_mint, taxRecipientAccount, a_to_c_mint_authority, campaignAmount.toNumber() + feeAmount.toNumber());
  

    // Ejecutar el método `depositReward` con las cuentas inicializadas
    await program.methods
      .depositReward(campaignTokenAccount, campaignAmount, feeAmount, campaignId)
      .accounts({
        rewardPool: rewardPoolKp.publicKey,
        user: signerName.publicKey,
        taxRecipientAccount: taxRecipientAccount,
        campaignTokenAccount: campaignTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        rewardInfo: rewardInfoPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([signerName]) 
      .rpc();
      console.log(`Generated Reward Info PDA: ${rewardInfoPda.toBase58()}`);

  
    // // Verificar que el depósito se realizó correctamente
    // const rewardInfoAccount = await program.account.rewardInfo.fetch(rewardInfoPda);
    // assert.strictEqual(rewardInfoAccount.amount.toNumber(), campaignAmount.toNumber(), "El monto no coincide");
    // assert.strictEqual(rewardInfoAccount.tokenAddress.toBase58(), campaignTokenAccount.toBase58(), "La cuenta de la campaña no coincide");
    // assert.strictEqual(rewardInfoAccount.ownerAddress.toBase58(), wallet.publicKey.toBase58(), "El propietario no coincide");
  });
  
});
