use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("4ocyDMLyze1f5QkzpNcizycQPanFjR6by5pLxEbmepZE");

#[program]
pub mod dreamwalk {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;
        Ok(())
    }

    pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
        // Verify the vault has enough balance
        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        require!(vault_balance >= amount, CustomError::InsufficientFunds);

        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? = vault_balance.checked_sub(amount).unwrap();
        **ctx.accounts.receiver.try_borrow_mut_lamports()? = ctx.accounts.receiver.lamports().checked_add(amount).unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump = vault.bump,
        constraint = vault.authority == authority.key()
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: This is the destination account that can receive SOL. We don't need to check anything about it.
    #[account(mut)]
    pub receiver: AccountInfo<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum CustomError {
    #[msg("Insufficient funds in the vault")]
    InsufficientFunds,
}
