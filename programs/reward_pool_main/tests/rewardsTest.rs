// // tests/reward_pool_initialize_test.rs

// use anchor_lang::prelude::*;
// use solana_program_test::*;
// use solana_sdk::{
//     signature::{Keypair, Signer},
//     transaction::Transaction,
//     instruction::{Instruction, AccountMeta},
//     system_program,
// };
// use std::str::FromStr;
// use reward_pool_main::instruction::Initialize; // Importa directamente `Initialize`

// fn get_initialize_instruction(
//     program_id: Pubkey,
//     reward_pool: Pubkey,
//     initializer: Pubkey,
// ) -> Instruction {
//     // Usa la estructura pública `Initialize`
//     let data = Initialize { initializer };
//     let mut serialized_data = vec![];
//     data.serialize(&mut serialized_data).unwrap();

//     // Construye la instrucción con las cuentas necesarias y los datos serializados
//     Instruction {
//         program_id,
//         accounts: vec![
//             AccountMeta::new(reward_pool, false), // `reward_pool` no necesita firmar
//             AccountMeta::new(initializer, true),  // `initializer` es el firmante
//             AccountMeta::new_readonly(system_program::ID, false),
//         ],
//         data: serialized_data, // Inserta los datos serializados correctamente
//     }
// }

// #[tokio::test]
// async fn test_initialize_reward_pool() {
//     // Configura un entorno de prueba
//     let program_id = Pubkey::from_str("44cUoDQ2V5GH5zgaYD7A3EMgRCnWXRGvfCgGkEUxxYWS").unwrap();
//     let mut program_test = ProgramTest::new("reward_pool_main", program_id, None);

//     // Crea la cuenta `user` como el propietario y pagador
//     let user = Keypair::new();
//     let reward_pool_keypair = Keypair::new();

//     // Añade `user` como una cuenta con suficiente saldo
//     program_test.add_account(
//         user.pubkey(),
//         solana_sdk::account::Account {
//             lamports: 10_000_000,
//             data: vec![],
//             owner: system_program::ID,
//             executable: false,
//             rent_epoch: 0,
//         },
//     );

//     println!("User Pubkey: {}", user.pubkey());
//     println!("Reward Pool Pubkey: {}", reward_pool_keypair.pubkey());

//     // Inicia el entorno de prueba
//     let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

//     // Crea la transacción de inicialización
//     let mut transaction = Transaction::new_with_payer(
//         &[get_initialize_instruction(
//             program_id,
//             reward_pool_keypair.pubkey(),
//             user.pubkey(),
//         )],
//         Some(&payer.pubkey()),
//     );

//     // Firma la transacción con las claves necesarias
//     transaction.sign(&[&payer, &reward_pool_keypair, &user], recent_blockhash);

//     // Procesa la transacción en el entorno de prueba
//     match banks_client.process_transaction(transaction).await {
//         Ok(_) => println!("Transaction succeeded"),
//         Err(err) => {
//             eprintln!("Transaction failed: {:?}", err);
//             assert!(false, "Transaction failed");
//         }
//     }

//     // Comprueba si la cuenta `reward_pool` se creó correctamente
//     let reward_pool_account: solana_sdk::account::Account = banks_client
//         .get_account(reward_pool_keypair.pubkey())
//         .await
//         .expect("Account should exist")
//         .expect("Account not found");

//     // Valida que el `reward_pool` se creó con el propietario correcto
//     assert_eq!(reward_pool_account.owner, program_id);
// }
