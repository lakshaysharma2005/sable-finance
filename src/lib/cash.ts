/** Client/API sentinel for paying with cash. */
export const CASH_PAY_FROM = "cash" as const;

export const CASH_PLAID_ITEM_ID = "local_cash_item";
export const CASH_PLAID_ACCOUNT_ID = "local_cash";

export function isLocalPlaidId(id: string): boolean {
  return id.startsWith("local_");
}
