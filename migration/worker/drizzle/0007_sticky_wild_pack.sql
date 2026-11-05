CREATE TABLE `tamiran_modules` (
	`module_key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`product_scope` text DEFAULT 'both' NOT NULL,
	`is_core` integer DEFAULT 0 NOT NULL,
	`is_sellable` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "tamiran_modules_key_length" CHECK(length(module_key) BETWEEN 1 AND 80),
	CONSTRAINT "tamiran_modules_name_length" CHECK(length(name) BETWEEN 1 AND 120),
	CONSTRAINT "tamiran_modules_description_length" CHECK(length(description) BETWEEN 1 AND 600),
	CONSTRAINT "tamiran_modules_product_scope" CHECK(product_scope IN ('solo','pro','both')),
	CONSTRAINT "tamiran_modules_core_bool" CHECK(is_core IN (0,1)),
	CONSTRAINT "tamiran_modules_sellable_bool" CHECK(is_sellable IN (0,1)),
	CONSTRAINT "tamiran_modules_status" CHECK(status IN ('active','disabled'))
);
--> statement-breakpoint
CREATE TABLE `tamiran_shop_modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repair_shop_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`state` text DEFAULT 'locked' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`started_at` text,
	`expires_at` text,
	`config_json` text NOT NULL,
	`updated_by_user_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`repair_shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`module_key`) REFERENCES `tamiran_modules`(`module_key`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`repair_shop_id`,`updated_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tamiran_shop_modules_id_integer" CHECK(typeof(id)='integer' AND id BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "tamiran_shop_modules_state" CHECK(state IN ('active','trial','locked','expired','suspended')),
	CONSTRAINT "tamiran_shop_modules_source_length" CHECK(length(source) BETWEEN 1 AND 40),
	CONSTRAINT "tamiran_shop_modules_config_json" CHECK(json_valid(config_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_shop_modules_scope_unique` ON `tamiran_shop_modules` (`repair_shop_id`,`module_key`);--> statement-breakpoint
CREATE INDEX `tamiran_shop_modules_state_idx` ON `tamiran_shop_modules` (`repair_shop_id`,`state`,`expires_at`);