import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  SPLASH_POOL_TICK_SPACING,
  WhirlpoolContext,
  WhirlpoolIx,
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { MockConnection } from "./mockConnection";

export const WHIRLPOOL_CPI_PROGRAM_ID = new PublicKey(
  "23WKGEsTRVZiVuwg8eyXByPq2xkzTR8v6TW4V1WiT89g"
);

export async function setupConfigAndFeeTiers(
  connection: MockConnection,
  signer: Keypair
): Promise<PublicKey> {
  const whirlpoolsConfigKeypair = Keypair.generate();
  const ctx = WhirlpoolContext.from(
    connection,
    new Wallet(signer),
    ORCA_WHIRLPOOL_PROGRAM_ID
  );

  const tx = new Transaction();
  tx.add(
    WhirlpoolIx.initializeConfigIx(ctx.program, {
      whirlpoolsConfigKeypair,
      funder: signer.publicKey,
      feeAuthority: signer.publicKey,
      collectProtocolFeesAuthority: signer.publicKey,
      rewardEmissionsSuperAuthority: signer.publicKey,
      defaultProtocolFeeRate: 100,
    }).instructions[0],
    WhirlpoolIx.initializeFeeTierIx(ctx.program, {
      defaultFeeRate: 100,
      feeAuthority: signer.publicKey,
      feeTierPda: PDAUtil.getFeeTier(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        whirlpoolsConfigKeypair.publicKey,
        SPLASH_POOL_TICK_SPACING
      ),
      funder: signer.publicKey,
      tickSpacing: 64,
      whirlpoolsConfig: whirlpoolsConfigKeypair.publicKey,
    }).instructions[0]
  );
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(signer, whirlpoolsConfigKeypair);

  await connection.sendTransaction(tx);

  return whirlpoolsConfigKeypair.publicKey;
}
