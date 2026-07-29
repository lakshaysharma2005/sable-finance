import type { AssetCategory } from "@/db/schema";

const CC_PAYMENT_DETAILED = "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT";

export interface CreditCardAccount {
  id: number;
  displayName: string;
}

export interface TxDisplayNameInput {
  name: string;
  merchantName: string | null;
  pfcPrimary: string | null;
  pfcDetailed: string | null;
  assetCategory: AssetCategory;
  accountDisplayName: string;
  creditCardAccounts?: CreditCardAccount[];
}

export function isCreditCardPayment(
  pfcPrimary: string | null,
  pfcDetailed: string | null,
  assetCategory: AssetCategory,
): boolean {
  if (pfcDetailed === CC_PAYMENT_DETAILED) return true;
  return pfcPrimary === "LOAN_PAYMENTS" && assetCategory === "cc";
}

function nameTokens(displayName: string): string[] {
  return displayName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function matchCreditCard(
  haystack: string,
  creditCardAccounts: CreditCardAccount[],
): CreditCardAccount | null {
  let best: CreditCardAccount | null = null;
  let bestScore = 0;

  for (const cc of creditCardAccounts) {
    const tokens = nameTokens(cc.displayName);
    const matched = tokens.filter((t) => haystack.includes(t));
    if (matched.length === 0) continue;

    // Prefer more token matches, then longer display names for specificity.
    const score = matched.length * 100 + cc.displayName.length;
    if (score > bestScore) {
      bestScore = score;
      best = cc;
    }
  }

  return best;
}

export function resolveTxDisplayName(input: TxDisplayNameInput): string {
  const raw = input.merchantName ?? input.name;

  if (!isCreditCardPayment(input.pfcPrimary, input.pfcDetailed, input.assetCategory)) {
    return raw;
  }

  if (input.assetCategory === "cc") {
    return `${input.accountDisplayName} Payment`;
  }

  const cards = input.creditCardAccounts ?? [];
  if (cards.length > 0) {
    const match = matchCreditCard(raw.toLowerCase(), cards);
    if (match) return `${match.displayName} Payment`;
  }

  return "Credit card Payment";
}
