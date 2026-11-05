CREATE TABLE `repair_shop_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`setting_key` text NOT NULL,
	`value_json` text NOT NULL,
	`updated_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`updated_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_shop_settings_key_length" CHECK(length("setting_key") BETWEEN 1 AND 80),
	CONSTRAINT "repair_shop_settings_json" CHECK(json_valid("value_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_shop_settings_scope_unique` ON `repair_shop_settings` (`shop_id`,`setting_key`);