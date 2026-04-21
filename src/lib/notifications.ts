// Email notification stubs — wire up Resend (or another provider) to activate.
// Every function is a no-op until connected. Internal logic is already in place:
// transaction_updates.email_sent_to_player tracks delivery state.

// Called after a transaction is created by the player.
// export async function notifyTransactionCreated(txId: string): Promise<void> {
//   const tx = await getTransactionDetail(txId);
//   await resend.emails.send({ to: tx.playerEmail, subject: "Transaction Received", ... });
// }

// Called after every clerk status change.
// export async function notifyStatusChanged(txId: string, newStatus: string): Promise<void> {
//   ...
// }

// Called when a transaction reaches "completed".
// export async function notifyTransactionCompleted(txId: string): Promise<void> {
//   ...
// }

// Called when a transaction reaches "denied".
// export async function notifyTransactionDenied(txId: string, reason: string): Promise<void> {
//   ...
// }

export {};
