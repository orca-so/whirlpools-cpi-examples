use anchor_lang::prelude::*;
declare_id!("23WKGEsTRVZiVuwg8eyXByPq2xkzTR8v6TW4V1WiT89g");

pub mod instructions;
use instructions::*;

#[program]
pub mod whirlpool_cpi {
    use super::*;

    pub fn graduate_token_to_orca(
        ctx: Context<GraduateTokenToOrca>,
        tick_spacing: u16,
        initial_sqrt_price: u128,
        start_tick_index_lower: i32,
        start_tick_index_upper: i32,
        tick_lower_index: i32,
        tick_upper_index: i32,
        with_token_metadata_extension: bool,
        liquidity_amount: u128,
        token_max_a: u64,
        token_max_b: u64,
    ) -> Result<()> {
        instructions::graduate_token_to_orca::handler(
            ctx,
            tick_spacing,
            initial_sqrt_price,
            start_tick_index_lower,
            start_tick_index_upper,
            tick_lower_index,
            tick_upper_index,
            with_token_metadata_extension,
            liquidity_amount,
            token_max_a,
            token_max_b,
        )
    }
}

#[derive(Accounts)]
pub struct TestCpi {}
