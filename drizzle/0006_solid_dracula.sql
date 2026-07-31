CREATE TABLE "split_repayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"split_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "split_repayments" ADD CONSTRAINT "split_repayments_split_id_transaction_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."transaction_splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_repayments" ADD CONSTRAINT "split_repayments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "split_repayments_split_tx_idx" ON "split_repayments" USING btree ("split_id","transaction_id");--> statement-breakpoint
CREATE INDEX "split_repayments_split_idx" ON "split_repayments" USING btree ("split_id");--> statement-breakpoint
CREATE INDEX "split_repayments_tx_idx" ON "split_repayments" USING btree ("transaction_id");