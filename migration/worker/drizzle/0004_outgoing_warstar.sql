ALTER TABLE `repair_cases` ADD `reception_request_hash` text;--> statement-breakpoint
ALTER TABLE `repair_customer_devices` ADD `lock_version` integer DEFAULT 0 NOT NULL;