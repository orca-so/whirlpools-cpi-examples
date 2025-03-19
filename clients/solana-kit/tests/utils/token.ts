import {
  getCreateAccountInstruction,
  getTransferSolInstruction,
} from "@solana-program/system";
import {
  getMintSize,
  getInitializeMint2Instruction,
  TOKEN_PROGRAM_ADDRESS,
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  getMintToInstruction,
  getSyncNativeInstruction,
} from "@solana-program/token";
import {
  address,
  generateKeyPairSigner,
  type Address,
  type IInstruction,
} from "@solana/kit";
import { signer, sendTransaction } from "./mockRpc";

const NATIVE_MINT = address("So11111111111111111111111111111111111111112");

export async function setupAta(
  mint: Address,
  config: { amount?: number | bigint; owner?: Address } = {}
): Promise<Address> {
  const ata = await findAssociatedTokenPda({
    mint,
    owner: config.owner ?? signer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const instructions: IInstruction[] = [];

  instructions.push(
    getCreateAssociatedTokenIdempotentInstruction({
      mint,
      owner: config.owner ?? signer.address,
      ata: ata[0],
      payer: signer,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
  );

  if (config.amount) {
    if (mint === NATIVE_MINT) {
      instructions.push(
        getTransferSolInstruction({
          source: signer,
          destination: ata[0],
          amount: config.amount,
        })
      );
      instructions.push(
        getSyncNativeInstruction({
          account: ata[0],
        })
      );
    } else {
      instructions.push(
        getMintToInstruction({
          mint,
          token: ata[0],
          mintAuthority: signer,
          amount: config.amount,
        })
      );
    }
  }

  await sendTransaction(instructions);

  return ata[0];
}

export async function setupMint(
  config: { decimals?: number } = {}
): Promise<Address> {
  const keypair = await generateKeyPairSigner();
  const instructions: IInstruction[] = [];

  instructions.push(
    getCreateAccountInstruction({
      payer: signer,
      newAccount: keypair,
      lamports: 1e8,
      space: getMintSize(),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    })
  );

  instructions.push(
    getInitializeMint2Instruction({
      mint: keypair.address,
      mintAuthority: signer.address,
      freezeAuthority: null,
      decimals: config.decimals ?? 6,
    })
  );

  await sendTransaction(instructions);

  return keypair.address;
}
