CREATE TABLE "user_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '📁' NOT NULL,
	"color" text DEFAULT '#8A8594' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_categories_name_unique" UNIQUE("name")
);
