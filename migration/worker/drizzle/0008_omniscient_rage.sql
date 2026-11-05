CREATE TABLE `tamiran_user_session_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer,
	`user_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`session_hash` text,
	`request_id` text NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tamiran_user_session_events_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_user_session_events_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_user_session_events_user_id_integer" CHECK(typeof("user_id") = 'integer' AND "user_id" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "tamiran_user_session_events_public_id" CHECK(length("public_id") BETWEEN 1 AND 26),
	CONSTRAINT "tamiran_user_session_events_type" CHECK("event_type" IN ('login','logout','revoked','expired','password_changed')),
	CONSTRAINT "tamiran_user_session_events_hash" CHECK("session_hash" IS NULL OR (length("session_hash") = 64 AND "session_hash" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "tamiran_user_session_events_request_id" CHECK(length("request_id") BETWEEN 1 AND 80),
	CONSTRAINT "tamiran_user_session_events_ip_address" CHECK(length("ip_address") <= 45),
	CONSTRAINT "tamiran_user_session_events_user_agent" CHECK("user_agent" IS NULL OR length("user_agent") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_user_session_events_public_unique` ON `tamiran_user_session_events` (`public_id`);--> statement-breakpoint
CREATE INDEX `tamiran_user_session_events_user_time_idx` ON `tamiran_user_session_events` (`user_id`,`created_at`);