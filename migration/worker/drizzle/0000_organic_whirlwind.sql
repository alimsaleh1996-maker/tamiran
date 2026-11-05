CREATE TABLE `repair_branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`branch_code` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`timezone` text DEFAULT 'Asia/Tehran' NOT NULL,
	`business_hours_json` text NOT NULL,
	`address` text,
	`phone` text,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_branches_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_branches_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_branches_branch_code_length" CHECK("branch_code" IS NULL OR length("branch_code") <= 64),
	CONSTRAINT "repair_branches_name_length" CHECK("name" IS NULL OR length("name") <= 180),
	CONSTRAINT "repair_branches_is_default_integer" CHECK("is_default" IS NULL OR (typeof("is_default") = 'integer' AND "is_default" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_branches_is_active_integer" CHECK("is_active" IS NULL OR (typeof("is_active") = 'integer' AND "is_active" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_branches_timezone_length" CHECK("timezone" IS NULL OR length("timezone") <= 64),
	CONSTRAINT "repair_branches_business_hours_json_json" CHECK(json_valid("business_hours_json")),
	CONSTRAINT "repair_branches_address_length" CHECK("address" IS NULL OR length("address") <= 1000),
	CONSTRAINT "repair_branches_phone_length" CHECK("phone" IS NULL OR length("phone") <= 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_branches_shop_code_unique` ON `repair_branches` (`shop_id`,`branch_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_branches_scope_id_unique` ON `repair_branches` (`shop_id`,`id`);--> statement-breakpoint
CREATE TABLE `repair_customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`full_name` text NOT NULL,
	`mobile` text NOT NULL,
	`secondary_mobile` text,
	`mobile_verified_at` text,
	`national_code` text,
	`province` text,
	`city` text,
	`address` text,
	`postal_code` text,
	`notes` text,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_customers_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_customers_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "repair_customers_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_customers_full_name_length" CHECK("full_name" IS NULL OR length("full_name") <= 180),
	CONSTRAINT "repair_customers_mobile_length" CHECK("mobile" IS NULL OR length("mobile") <= 20),
	CONSTRAINT "repair_customers_secondary_mobile_length" CHECK("secondary_mobile" IS NULL OR length("secondary_mobile") <= 20),
	CONSTRAINT "repair_customers_national_code_length" CHECK("national_code" IS NULL OR length("national_code") <= 10),
	CONSTRAINT "repair_customers_province_length" CHECK("province" IS NULL OR length("province") <= 100),
	CONSTRAINT "repair_customers_city_length" CHECK("city" IS NULL OR length("city") <= 100),
	CONSTRAINT "repair_customers_address_length" CHECK("address" IS NULL OR length("address") <= 1000),
	CONSTRAINT "repair_customers_postal_code_length" CHECK("postal_code" IS NULL OR length("postal_code") <= 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_customers_public_unique` ON `repair_customers` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_customers_shop_mobile_unique` ON `repair_customers` (`shop_id`,`mobile`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_customers_scope_id_unique` ON `repair_customers` (`shop_id`,`id`);--> statement-breakpoint
CREATE INDEX `repair_customers_shop_name_idx` ON `repair_customers` (`shop_id`,`full_name`);--> statement-breakpoint
CREATE TABLE `repair_shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_code` text NOT NULL,
	`public_shop_code` text NOT NULL,
	`receipt_counter` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`repair_type` text NOT NULL,
	`repair_type_locked` integer DEFAULT 1 NOT NULL,
	`size_profile` text DEFAULT 'small' NOT NULL,
	`plan_code` text DEFAULT 'light' NOT NULL,
	`operation_mode` text DEFAULT 'multi_user' NOT NULL,
	`product_profile` text DEFAULT 'pro' NOT NULL,
	`inventory_mode` text DEFAULT 'off' NOT NULL,
	`qc_mode` text DEFAULT 'off' NOT NULL,
	`inventory_cost_method` text DEFAULT 'weighted_average' NOT NULL,
	`allow_self_qc` integer DEFAULT 0 NOT NULL,
	`allow_delivery_with_balance` integer DEFAULT 0 NOT NULL,
	`workflow_settings_json` text NOT NULL,
	`tax_settings_json` text NOT NULL,
	`feature_flags_json` text NOT NULL,
	`modules_json` text NOT NULL,
	`national_code_required` integer DEFAULT 0 NOT NULL,
	`lifecycle_status` text DEFAULT 'active' NOT NULL,
	`license_started_at` text NOT NULL,
	`license_expires_at` text NOT NULL,
	`max_users` integer DEFAULT 3 NOT NULL,
	`max_branches` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "repair_shops_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_shops_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "repair_shops_shop_code_length" CHECK("shop_code" IS NULL OR length("shop_code") <= 64),
	CONSTRAINT "repair_shops_public_shop_code_length" CHECK("public_shop_code" IS NULL OR length("public_shop_code") <= 6),
	CONSTRAINT "repair_shops_receipt_counter_integer" CHECK("receipt_counter" IS NULL OR (typeof("receipt_counter") = 'integer' AND "receipt_counter" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_shops_name_length" CHECK("name" IS NULL OR length("name") <= 180),
	CONSTRAINT "repair_shops_repair_type_length" CHECK("repair_type" IS NULL OR length("repair_type") <= 64),
	CONSTRAINT "repair_shops_repair_type_locked_integer" CHECK("repair_type_locked" IS NULL OR (typeof("repair_type_locked") = 'integer' AND "repair_type_locked" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_shops_size_profile_enum" CHECK("size_profile" IN ('personal','small','medium','large')),
	CONSTRAINT "repair_shops_plan_code_length" CHECK("plan_code" IS NULL OR length("plan_code") <= 64),
	CONSTRAINT "repair_shops_operation_mode_enum" CHECK("operation_mode" IN ('single_user','multi_user')),
	CONSTRAINT "repair_shops_product_profile_enum" CHECK("product_profile" IN ('solo','pro')),
	CONSTRAINT "repair_shops_inventory_mode_enum" CHECK("inventory_mode" IN ('off','simple','pro')),
	CONSTRAINT "repair_shops_qc_mode_enum" CHECK("qc_mode" IN ('off','simple','independent')),
	CONSTRAINT "repair_shops_inventory_cost_method_enum" CHECK("inventory_cost_method" IN ('weighted_average','fifo','last_purchase')),
	CONSTRAINT "repair_shops_allow_self_qc_integer" CHECK("allow_self_qc" IS NULL OR (typeof("allow_self_qc") = 'integer' AND "allow_self_qc" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_shops_allow_delivery_with_balance_integer" CHECK("allow_delivery_with_balance" IS NULL OR (typeof("allow_delivery_with_balance") = 'integer' AND "allow_delivery_with_balance" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_shops_workflow_settings_json_json" CHECK(json_valid("workflow_settings_json")),
	CONSTRAINT "repair_shops_tax_settings_json_json" CHECK(json_valid("tax_settings_json")),
	CONSTRAINT "repair_shops_feature_flags_json_json" CHECK(json_valid("feature_flags_json")),
	CONSTRAINT "repair_shops_modules_json_json" CHECK(json_valid("modules_json")),
	CONSTRAINT "repair_shops_national_code_required_integer" CHECK("national_code_required" IS NULL OR (typeof("national_code_required") = 'integer' AND "national_code_required" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_shops_lifecycle_status_enum" CHECK("lifecycle_status" IN ('active','suspended','expired','read_only')),
	CONSTRAINT "repair_shops_max_users_integer" CHECK("max_users" IS NULL OR (typeof("max_users") = 'integer' AND "max_users" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_shops_max_branches_integer" CHECK("max_branches" IS NULL OR (typeof("max_branches") = 'integer' AND "max_branches" BETWEEN 0 AND 9007199254740991))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_shops_public_id_unique` ON `repair_shops` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_shops_code_unique` ON `repair_shops` (`shop_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_shops_public_code_unique` ON `repair_shops` (`public_shop_code`);--> statement-breakpoint
CREATE INDEX `repair_shops_license_idx` ON `repair_shops` (`lifecycle_status`,`license_expires_at`);--> statement-breakpoint
CREATE TABLE `tamiran_user_branches` (
	`shop_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`branch_role_code` text NOT NULL,
	`permissions_json` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`user_id`, `branch_id`),
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shop_id`,`branch_id`) REFERENCES `repair_branches`(`shop_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `repair_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tamiran_user_branches_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_user_branches_user_id_integer" CHECK("user_id" IS NULL OR (typeof("user_id") = 'integer' AND "user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_user_branches_branch_id_integer" CHECK("branch_id" IS NULL OR (typeof("branch_id") = 'integer' AND "branch_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_user_branches_branch_role_code_enum" CHECK("branch_role_code" IN ('repair_manager','reception','technician','quality_control','warehouse_keeper','finance_cashier')),
	CONSTRAINT "tamiran_user_branches_permissions_json_json" CHECK(json_valid("permissions_json")),
	CONSTRAINT "tamiran_user_branches_is_active_integer" CHECK("is_active" IS NULL OR (typeof("is_active") = 'integer' AND "is_active" BETWEEN 0 AND 1))
);
--> statement-breakpoint
CREATE INDEX `tamiran_user_branches_scope_idx` ON `tamiran_user_branches` (`shop_id`,`branch_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `tamiran_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text,
	`email` text,
	`password_hash` text NOT NULL,
	`role_code` text NOT NULL,
	`active_session_hash` text,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`deactivated_at` text,
	`deactivation_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text,
	`account_user_id` text,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tamiran_users_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_users_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_users_username_length" CHECK("username" IS NULL OR length("username") <= 120),
	CONSTRAINT "tamiran_users_display_name_length" CHECK("display_name" IS NULL OR length("display_name") <= 180),
	CONSTRAINT "tamiran_users_phone_length" CHECK("phone" IS NULL OR length("phone") <= 20),
	CONSTRAINT "tamiran_users_email_length" CHECK("email" IS NULL OR length("email") <= 190),
	CONSTRAINT "tamiran_users_password_hash_length" CHECK("password_hash" IS NULL OR length("password_hash") <= 255),
	CONSTRAINT "tamiran_users_role_code_enum" CHECK("role_code" IN ('central_admin','repair_manager','reception','technician','quality_control','warehouse_keeper','finance_cashier')),
	CONSTRAINT "tamiran_users_active_session_hash_length" CHECK("active_session_hash" IS NULL OR length("active_session_hash") <= 64),
	CONSTRAINT "tamiran_users_must_change_password_integer" CHECK("must_change_password" IS NULL OR (typeof("must_change_password") = 'integer' AND "must_change_password" BETWEEN 0 AND 1)),
	CONSTRAINT "tamiran_users_is_active_integer" CHECK("is_active" IS NULL OR (typeof("is_active") = 'integer' AND "is_active" BETWEEN 0 AND 1)),
	CONSTRAINT "tamiran_users_deactivation_reason_length" CHECK("deactivation_reason" IS NULL OR length("deactivation_reason") <= 500),
	CONSTRAINT "tamiran_users_role_scope" CHECK(("role_code" = 'central_admin' AND "shop_id" IS NULL) OR ("role_code" <> 'central_admin' AND "shop_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_users_scope_username_unique` ON `tamiran_users` (`shop_id`,`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_users_scope_id_unique` ON `tamiran_users` (`shop_id`,`id`);--> statement-breakpoint
CREATE INDEX `tamiran_users_role_idx` ON `tamiran_users` (`role_code`);--> statement-breakpoint
CREATE INDEX `tamiran_users_shop_active_idx` ON `tamiran_users` (`shop_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `tamiran_users_phone_idx` ON `tamiran_users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_users_account_scope_unique` ON `tamiran_users` (`shop_id`,`account_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_users_central_username_unique` ON `tamiran_users` (`username`) WHERE "shop_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_users_central_account_unique` ON `tamiran_users` (`account_user_id`) WHERE "shop_id" IS NULL;