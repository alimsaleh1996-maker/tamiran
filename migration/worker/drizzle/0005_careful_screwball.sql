CREATE TABLE `repair_case_receipt_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`case_id` integer NOT NULL,
	`term_version_id` integer NOT NULL,
	`accepted_by_name` text NOT NULL,
	`acceptance_method` text NOT NULL,
	`evidence_json` text NOT NULL,
	`accepted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`shop_id` integer NOT NULL,
	FOREIGN KEY (`shop_id`,`case_id`) REFERENCES `repair_cases`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`term_version_id`) REFERENCES `repair_receipt_term_versions`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_case_receipt_terms_method" CHECK("acceptance_method" IN ('digital_signature','in_person_signature','sms_otp','recorded_consent')),
	CONSTRAINT "repair_case_receipt_terms_json" CHECK(json_valid("evidence_json")),
	CONSTRAINT "repair_case_receipt_terms_name" CHECK(length("accepted_by_name") BETWEEN 1 AND 180),
	CONSTRAINT "repair_case_receipt_terms_public_id" CHECK(length("public_id") BETWEEN 1 AND 26)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_case_receipt_terms_public_unique` ON `repair_case_receipt_terms` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_case_receipt_terms_case_unique` ON `repair_case_receipt_terms` (`case_id`);--> statement-breakpoint
CREATE TABLE `repair_portal_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`case_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`last_viewed_at` text,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`,`case_id`) REFERENCES `repair_cases`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`created_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_portal_tokens_hash" CHECK(length("token_hash")=64 AND "token_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "repair_portal_tokens_public_id" CHECK(length("public_id") BETWEEN 1 AND 26)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_portal_tokens_public_unique` ON `repair_portal_tokens` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_portal_tokens_hash_unique` ON `repair_portal_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `repair_portal_tokens_case_idx` ON `repair_portal_tokens` (`case_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `repair_receipt_term_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`title` text NOT NULL,
	`body_text` text NOT NULL,
	`content_sha256` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`effective_from` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`effective_to` text,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`created_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_receipt_term_versions_version" CHECK(typeof("version_number")='integer' AND "version_number" BETWEEN 1 AND 65535),
	CONSTRAINT "repair_receipt_term_versions_active" CHECK("is_active" IN (0,1)),
	CONSTRAINT "repair_receipt_term_versions_hash" CHECK(length("content_sha256")=64 AND "content_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "repair_receipt_term_versions_title" CHECK(length("title") BETWEEN 1 AND 180),
	CONSTRAINT "repair_receipt_term_versions_public_id" CHECK(length("public_id") BETWEEN 1 AND 26)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_receipt_term_versions_public_unique` ON `repair_receipt_term_versions` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_receipt_term_versions_shop_version_unique` ON `repair_receipt_term_versions` (`shop_id`,`version_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_receipt_term_versions_scope_id_unique` ON `repair_receipt_term_versions` (`shop_id`,`id`);--> statement-breakpoint
CREATE INDEX `repair_receipt_term_versions_active_idx` ON `repair_receipt_term_versions` (`shop_id`,`is_active`,`effective_from`);
--> statement-breakpoint
CREATE TRIGGER repair_receipt_term_versions_content_immutable BEFORE UPDATE ON repair_receipt_term_versions
WHEN NEW.id IS NOT OLD.id OR NEW.public_id IS NOT OLD.public_id OR NEW.shop_id IS NOT OLD.shop_id OR NEW.version_number IS NOT OLD.version_number OR NEW.title IS NOT OLD.title OR NEW.body_text IS NOT OLD.body_text OR NEW.content_sha256 IS NOT OLD.content_sha256 OR NEW.effective_from IS NOT OLD.effective_from OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'receipt terms content immutable'); END;
--> statement-breakpoint
CREATE TRIGGER repair_receipt_term_versions_no_delete BEFORE DELETE ON repair_receipt_term_versions
BEGIN SELECT RAISE(ABORT,'receipt terms history immutable'); END;
--> statement-breakpoint
CREATE TRIGGER repair_case_receipt_terms_no_update BEFORE UPDATE ON repair_case_receipt_terms
BEGIN SELECT RAISE(ABORT,'receipt acceptance evidence immutable'); END;
--> statement-breakpoint
CREATE TRIGGER repair_case_receipt_terms_no_delete BEFORE DELETE ON repair_case_receipt_terms
BEGIN SELECT RAISE(ABORT,'receipt acceptance evidence immutable'); END;
--> statement-breakpoint
CREATE TRIGGER repair_portal_tokens_case_hash_guard BEFORE INSERT ON repair_portal_tokens
WHEN NOT EXISTS(SELECT 1 FROM repair_cases WHERE id=NEW.case_id AND shop_id=NEW.shop_id AND tracking_token_hash=NEW.token_hash) OR NEW.expires_at<=NEW.created_at
BEGIN SELECT RAISE(ABORT,'portal token outside case scope or invalid expiry'); END;
--> statement-breakpoint
CREATE TRIGGER repair_portal_tokens_identity_immutable BEFORE UPDATE ON repair_portal_tokens
WHEN NEW.id IS NOT OLD.id OR NEW.public_id IS NOT OLD.public_id OR NEW.shop_id IS NOT OLD.shop_id OR NEW.case_id IS NOT OLD.case_id OR NEW.token_hash IS NOT OLD.token_hash OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at<=NEW.created_at
BEGIN SELECT RAISE(ABORT,'portal token identity immutable'); END;
