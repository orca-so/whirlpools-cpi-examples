import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { signer, connection } from "./mockConnection";

export async function setupMint2022(config: { decimals?: number }) {
  const mintKeypair = Keypair.generate();
  const tx = new Transaction();
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: signer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: 1e8,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );
  tx.add(
    createInitializeMint2Instruction(
      mintKeypair.publicKey,
      config.decimals ?? 6,
      signer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(signer, mintKeypair);
  await connection.sendTransaction(tx);

  return mintKeypair.publicKey;
}

export async function setupAta2022(
  mint: PublicKey,
  config: { owner?: PublicKey; amount?: number | bigint }
) {
  const tx = new Transaction();
  const ata = getAssociatedTokenAddressSync(
    mint,
    config.owner ?? signer.publicKey,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  tx.add(
    createAssociatedTokenAccountInstruction(
      signer.publicKey,
      ata,
      config.owner ?? signer.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID
    )
  );
  tx.add(
    createMintToInstruction(
      mint,
      ata,
      signer.publicKey,
      config.amount ?? 1e12,
      [],
      TOKEN_2022_PROGRAM_ID)
  );
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(signer);
  await connection.sendTransaction(tx);

  return ata;
}
