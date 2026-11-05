CREATE TABLE `repair_reception_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`payload_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`submitted_case_id` integer,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lock_version` integer DEFAULT 0 NOT NULL,
	`payload_sha256` text NOT NULL,
	FOREIGN KEY (`shop_id`,`branch_id`) REFERENCES `repair_branches`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`created_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`submitted_case_id`) REFERENCES `repair_cases`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_drafts_public_length" CHECK(length(public_id) BETWEEN 1 AND 26),
	CONSTRAINT "repair_drafts_key_length" CHECK(length(idempotency_key) BETWEEN 1 AND 160),
	CONSTRAINT "repair_drafts_status" CHECK(status IN ('active','submitted','discarded','expired')),
	CONSTRAINT "repair_drafts_version" CHECK(typeof(lock_version)='integer' AND lock_version BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "repair_drafts_digest" CHECK(length(payload_sha256)=64 AND payload_sha256 NOT GLOB '*[^a-f0-9]*'),
	CONSTRAINT "repair_drafts_envelope" CHECK(json_valid(payload_json) AND coalesce(json_extract(payload_json,'$.version'),0)=1 AND coalesce(json_type(payload_json,'$.ciphertext'),'')='text' AND coalesce(json_extract(payload_json,'$.ciphertext'),'') LIKE 'v1.%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_reception_drafts_public_unique` ON `repair_reception_drafts` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_reception_drafts_idempotency_unique` ON `repair_reception_drafts` (`shop_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `repair_reception_drafts_owner_idx` ON `repair_reception_drafts` (`shop_id`,`branch_id`,`created_by_user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `tamiran_data_retention_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`otp_days` integer DEFAULT 7 NOT NULL,
	`sms_log_days` integer DEFAULT 365 NOT NULL,
	`application_log_days` integer DEFAULT 30 NOT NULL,
	`reception_draft_days` integer DEFAULT 30 NOT NULL,
	`private_file_days_after_warranty` integer DEFAULT 365 NOT NULL,
	`device_secret_delete_on_delivery` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`updated_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tamiran_retention_days_integer" CHECK(typeof(otp_days)='integer' AND otp_days BETWEEN 0 AND 65535 AND typeof(sms_log_days)='integer' AND sms_log_days BETWEEN 0 AND 65535 AND typeof(application_log_days)='integer' AND application_log_days BETWEEN 0 AND 65535 AND typeof(reception_draft_days)='integer' AND reception_draft_days BETWEEN 0 AND 65535 AND typeof(private_file_days_after_warranty)='integer' AND private_file_days_after_warranty BETWEEN 0 AND 65535),
	CONSTRAINT "tamiran_retention_secret_bool" CHECK(device_secret_delete_on_delivery IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_data_retention_policies_shop_unique` ON `tamiran_data_retention_policies` (`shop_id`);--> statement-breakpoint
CREATE TRIGGER repair_drafts_identity_immutable BEFORE UPDATE ON repair_reception_drafts
WHEN NEW.public_id<>OLD.public_id OR NEW.shop_id<>OLD.shop_id OR NEW.branch_id<>OLD.branch_id OR NEW.created_by_user_id<>OLD.created_by_user_id OR NEW.idempotency_key<>OLD.idempotency_key
BEGIN SELECT RAISE(ABORT,'draft identity is immutable'); END;
