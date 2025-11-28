CREATE TABLE "meta_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"meta_chat_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_chat_messages" ADD CONSTRAINT "meta_chat_messages_meta_chat_id_meta_chats_id_fk" FOREIGN KEY ("meta_chat_id") REFERENCES "public"."meta_chats"("id") ON DELETE cascade ON UPDATE no action;
