import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Server-only Plaid client. Never import from client components.

const env = process.env.PLAID_ENV ?? "production";

const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
