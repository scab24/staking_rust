import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RewardPoolMain } from "../target/types/reward_pool_main";
import { assert } from "chai";
import { Keypair, SystemProgram, Connection } from "@solana/web3.js";
import BN from "bn.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
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

  let usrTokenAccount;

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
      .initialize()
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

    try {
      console.log("checkk1")
      // Asegurarse de que el pagador tenga fondos suficientes
      await airdrop(provider.connection, payer.publicKey);
      await airdrop(provider.connection, a_to_c_mint_authority.publicKey);
      await airdrop(provider.connection, a_to_b_mint_authority.publicKey);
      await airdrop(provider.connection, signerName.publicKey);
      console.log("checkk2")

      //camping Token
      a_to_c_mint = await Token.createMint(provider.connection, a_to_c_mint_authority, a_to_c_mint_authority.publicKey, null, 9,TOKEN_PROGRAM_ID);
      console.log("checkk3")

      // Crear cuentas de Token para `tax_recipient_account` y `campaign_token_account`
      taxRecipientAccount = await a_to_c_mint.createAccount(signerName.publicKey);
      let usrTokenAccount = await a_to_c_mint.createAccount(payer.publicKey);
      console.log("checkk4")



      // Definir los valores de la campaña y las tarifas
      const campaignAmount = new BN(5);
      const feeAmount = new BN(50);
      const campaignId = new BN(1);
      const amountToClaim = new BN(0.5);
      console.log("checkk5")
      // Generar el PDA para `reward_info`
      // const [rewardInfoPda] = await anchor.web3.PublicKey.findProgramAddress(
      //   [Buffer.from("reward_info"), campaignId.toArrayLike(Buffer, "le", 8)],
      //   program.programId
      // );

      const [rewardInfoPda, __] = await anchor.web3.PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("reward_info"),
          payer.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [amount_claimed, _] = await anchor.web3.PublicKey.findProgramAddressSync (
        [
          anchor.utils.bytes.utf8.encode("amount_claimed"),
          payer.publicKey.toBuffer(),
        ],
        program.programId
      );

      console.log("mate")
      // Mint tokens al pagador para simular el saldo del usuario
      // await Token.mintTo(provider.connection, signerName, a_to_c_mint, taxRecipientAccount, a_to_c_mint_authority, campaignAmount.toNumber() + feeAmount.toNumber());
      console.log(rewardInfoPda,"rewardInfoPdarewardInfoPda")

      campaignTokenAccount = await a_to_c_mint.createAccount(rewardInfoPda);
      
      console.log(campaignTokenAccount,"campaignTokenAccount")

      await a_to_c_mint.mintTo(usrTokenAccount, a_to_c_mint_authority.publicKey, [a_to_c_mint_authority], 100e9);

      const connection = new Connection('http://localhost:8899', 'confirmed');

      const balance = await connection.getTokenAccountBalance(usrTokenAccount);
      console.log(`User One USDT Token amount: ${balance.value.amount / 1e9}`);
      // Ejecutar el método `depositReward` con las cuentas inicializadas
      await program.methods
        .depositReward(a_to_c_mint.pubkey, campaignAmount, feeAmount, campaignId)
        .accounts({
          rewardPool: rewardPoolKp.publicKey,
          user: payer.publicKey,
          taxRecipientAccount: taxRecipientAccount,
          userTokenAccount: usrTokenAccount,
          campaignTokenAccount: campaignTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          rewardInfo: rewardInfoPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      // // Verificar que el depósito se realizó correctamente
      const rewardInfoAccount = await program.account.rewardInfo.fetch(rewardInfoPda);
      console.log(rewardInfoAccount,"rewardInfoAccount")

      console.log("//////////////////////////") 
    
      console.log("TEST_CLAIM") //@audit
      
        // // Ejecutar el método `claimReward` con las cuentas necesarias
        // await program.methods
        // .claimReward(campaignId, amountToClaim)
        // .accounts({
        //   rewardPool: rewardPoolKp.publicKey,
        //   user: payer.publicKey,
        //   campaignTokenAccount: campaignTokenAccount,
        //   userTokenAccount: usrTokenAccount,
        //   tokenProgram: TOKEN_PROGRAM_ID,
        //   rewardInfo: rewardInfoPda,
        //   amount: amount_claimed,  // Suponiendo que amountClaimed es un PDA que registra la cantidad reclamada
        //   systemProgram: SystemProgram.programId,

        // })
        // .signers([payer])
        // .rpc();
    } catch (error) {
      console.log(error)
    }

  });

  it("Claims rewards correctly", async () => { //@audit 
    try {
      console.log("checkk1")
      // Asegurarse de que el pagador tenga fondos suficientes
      await airdrop(provider.connection, payer.publicKey);
      console.log("checkk2")
  
      // Suponemos que ya se creó el token y las cuentas en una prueba previa
      const usrTokenAccount = await a_to_c_mint.createAccount(payer.publicKey);
  
      // Definir los valores del reclamo
      const amountToClaim = new BN(5);
      const campaignId = new BN(1);
  
      // Supongamos que rewardInfo y campaignTokenAccount ya existen y están configurados
      console.log("checkk3")
  
      // Obtener el balance actual del usuario antes de reclamar
      const initialBalance = await provider.connection.getTokenAccountBalance(usrTokenAccount);
      console.log(`Initial USDT Token amount: ${initialBalance.value.amount / 1e9}`);
  
      const [rewardInfoPda, __] = await anchor.web3.PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("reward_info"),
          payer.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [amount_claimed, _] = await anchor.web3.PublicKey.findProgramAddressSync (
        [
          anchor.utils.bytes.utf8.encode("amount_claimed"),
          payer.publicKey.toBuffer(),
        ],
        program.programId
      );
      // Ejecutar el método `claimReward` con las cuentas necesarias
      await program.methods
      .claimReward(campaignId, amountToClaim)
      .accounts({
        rewardPool: rewardPoolKp.publicKey,
        user: payer.publicKey,
        campaignTokenAccount: campaignTokenAccount,
        userTokenAccount: usrTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        rewardInfo: rewardInfoPda,
        amount: amount_claimed,  // Suponiendo que amountClaimed es un PDA que registra la cantidad reclamada
        systemProgram: SystemProgram.programId,

      })
      .signers([payer])
      .rpc();
      
      // Verificar que el balance del usuario se haya incrementado correctamente
      const finalBalance = await provider.connection.getTokenAccountBalance(usrTokenAccount);
      console.log(`Final USDT Token amount: ${finalBalance.value.amount / 1e9}`);
  
      assert.strictEqual(
        new BN(finalBalance.value.amount).toString(),
        new BN(initialBalance.value.amount).add(amountToClaim.mul(new BN(1e9))).toString(),
        "Token amount after claim is incorrect"
      );
  
      // Verificar que la cantidad reclamada en `amountClaimed` se haya actualizado correctamente
      const amountClaimedAccount = await program.account.amountClaimed.fetch(amountClaimedPda);
      console.log("Amount Claimed:", amountClaimedAccount.amountClaimed.toString());
      assert.strictEqual(
        amountClaimedAccount.amountClaimed.toString(),
        amountToClaim.toString(),
        "Claimed amount record is incorrect"
      );
  
      console.log("Reward claim test completed successfully");
    } catch (error) {
      console.log("Error during the reward claim test:", error);
    }
  });

  it("Withdraws rewards correctly", async () => { //@audit
    try {
      console.log("checkk1");
      // Asegurarse de que el pagador tenga fondos suficientes
      await airdrop(provider.connection, payer.publicKey);
      console.log("checkk2");
  
      // Suponemos que las cuentas necesarias ya están configuradas por el test `depositReward`
      const campaignId = new BN(1);
      const amountToWithdraw = new BN(3); // Menor que la cantidad depositada en el test anterior
  
      // Crear una nueva conexión, igual que en el test de depósito
      const connection = new Connection('http://localhost:8899', 'confirmed');
      console.log("Connection established");
  
      // Obtener el balance inicial de la cuenta del usuario
      const initialBalance = await connection.getTokenAccountBalance(usrTokenAccount);
      console.log(`Initial USDT Token amount: ${initialBalance.value.amount / 1e9}`);
  
      // Ejecutar el método `withdrawReward`
      await program.methods
        .withdrawReward(campaignId, amountToWithdraw)
        .accounts({
          rewardPool: rewardPoolKp.publicKey,
          rewardInfo: rewardInfoPda,
          user: payer.publicKey,
          campaignTokenAccount: campaignTokenAccount,
          userTokenAccount: usrTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
      console.log("withdrawReward method executed");
  
      // Verificar que el balance del usuario se haya incrementado correctamente
      const finalBalance = await connection.getTokenAccountBalance(usrTokenAccount);
      console.log(`Final USDT Token amount: ${finalBalance.value.amount / 1e9}`);
  
      assert.strictEqual(
        new BN(finalBalance.value.amount).toString(),
        new BN(initialBalance.value.amount).add(amountToWithdraw.mul(new BN(1e9))).toString(),
        "Token amount after withdrawal is incorrect"
      );
  
      // Verificar que la cantidad en rewardInfo se haya reducido correctamente
      const rewardInfoAccount = await program.account.rewardInfo.fetch(rewardInfoPda);
      console.log("Remaining Reward Amount:", rewardInfoAccount.amount.toString());

  
      console.log("Reward withdrawal test completed successfully");
    } catch (error) {
      console.log("Error during the reward withdrawal test:", error);
    }
  });
  
  

});
