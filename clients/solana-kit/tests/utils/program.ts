import {
  getFeeTierAddress,
  getInitializeConfigInstruction,
  getInitializeFeeTierInstruction,
} from "@orca-so/whirlpools-client";
import {
  generateKeyPairSigner,
  type Address,
  type IInstruction,
} from "@solana/kit";
import { SPLASH_POOL_TICK_SPACING } from "../../client/utils/constants";
import { sendTransaction, signer } from "./mockRpc";

export async function setupConfigAndFeeTiers(): Promise<Address> {
  const keypair = await generateKeyPairSigner();
  const instructions: IInstruction[] = [];

  instructions.push(
    getInitializeConfigInstruction({
      config: keypair,
      funder: signer,
      feeAuthority: signer.address,
      collectProtocolFeesAuthority: signer.address,
      rewardEmissionsSuperAuthority: signer.address,
      defaultProtocolFeeRate: 100,
    })
  );

  const splashFeeTierPda = await getFeeTierAddress(
    keypair.address,
    SPLASH_POOL_TICK_SPACING
  );
  instructions.push(
    getInitializeFeeTierInstruction({
      config: keypair.address,
      feeTier: splashFeeTierPda[0],
      funder: signer,
      feeAuthority: signer,
      tickSpacing: SPLASH_POOL_TICK_SPACING,
      defaultFeeRate: 1000,
    })
  );

  await sendTransaction(instructions);
  return keypair.address;
}
