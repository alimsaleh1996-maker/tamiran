CREATE TABLE `repair_case_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`actor_user_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`description` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `repair_cases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_case_events_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_events_case_id_integer" CHECK("case_id" IS NULL OR (typeof("case_id") = 'integer' AND "case_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_events_actor_user_id_integer" CHECK("actor_user_id" IS NULL OR (typeof("actor_user_id") = 'integer' AND "actor_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_events_event_type_length" CHECK("event_type" IS NULL OR length("event_type") <= 64),
	CONSTRAINT "repair_case_events_from_status_length" CHECK("from_status" IS NULL OR length("from_status") <= 32),
	CONSTRAINT "repair_case_events_to_status_length" CHECK("to_status" IS NULL OR length("to_status") <= 32),
	CONSTRAINT "repair_case_events_metadata_json_json" CHECK(json_valid("metadata_json"))
);
--> statement-breakpoint
CREATE INDEX `repair_case_events_case_time_idx` ON `repair_case_events` (`case_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `repair_case_stage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`workflow_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_user_id` integer NOT NULL,
	`reason` text,
	`metadata_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`active_seconds` integer DEFAULT 0 NOT NULL,
	`external_wait_seconds` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `repair_case_workflows`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_case_stage_events_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_stage_events_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "repair_case_stage_events_workflow_id_integer" CHECK("workflow_id" IS NULL OR (typeof("workflow_id") = 'integer' AND "workflow_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_stage_events_from_status_length" CHECK("from_status" IS NULL OR length("from_status") <= 48),
	CONSTRAINT "repair_case_stage_events_to_status_length" CHECK("to_status" IS NULL OR length("to_status") <= 48),
	CONSTRAINT "repair_case_stage_events_actor_user_id_integer" CHECK("actor_user_id" IS NULL OR (typeof("actor_user_id") = 'integer' AND "actor_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_stage_events_reason_length" CHECK("reason" IS NULL OR length("reason") <= 1000),
	CONSTRAINT "repair_case_stage_events_metadata_json_json" CHECK(json_valid("metadata_json")),
	CONSTRAINT "repair_case_stage_events_idempotency_key_length" CHECK("idempotency_key" IS NULL OR length("idempotency_key") <= 160),
	CONSTRAINT "repair_case_stage_events_active_seconds_integer" CHECK("active_seconds" IS NULL OR (typeof("active_seconds") = 'integer' AND "active_seconds" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_stage_events_external_wait_seconds_integer" CHECK("external_wait_seconds" IS NULL OR (typeof("external_wait_seconds") = 'integer' AND "external_wait_seconds" BETWEEN 0 AND 9007199254740991))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_case_stage_events_public_unique` ON `repair_case_stage_events` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_case_stage_events_idempotency_unique` ON `repair_case_stage_events` (`workflow_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `repair_case_stage_events_workflow_idx` ON `repair_case_stage_events` (`workflow_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `repair_case_workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`case_id` integer NOT NULL,
	`case_kind` text DEFAULT 'standard' NOT NULL,
	`parent_case_id` integer,
	`workflow_code` text NOT NULL,
	`process_status` text DEFAULT 'reception' NOT NULL,
	`primary_technician_user_id` integer,
	`preapproved_amount` integer DEFAULT 0 NOT NULL,
	`diagnostic_fee_policy_json` text NOT NULL,
	`customer_consent_json` text NOT NULL,
	`promised_at` text,
	`active_work_seconds` integer DEFAULT 0 NOT NULL,
	`external_wait_seconds` integer DEFAULT 0 NOT NULL,
	`wait_started_at` text,
	`wait_reason` text,
	`temporary_device_secret_ciphertext` text,
	`temporary_secret_expires_at` text,
	`temporary_secret_deleted_at` text,
	`terminal_reason` text,
	`locked_at` text,
	`lock_version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`,`case_id`) REFERENCES `repair_cases`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`branch_id`) REFERENCES `repair_branches`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`parent_case_id`) REFERENCES `repair_cases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`primary_technician_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`primary_technician_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_case_workflows_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "repair_case_workflows_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_branch_id_integer" CHECK("branch_id" IS NULL OR (typeof("branch_id") = 'integer' AND "branch_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_case_id_integer" CHECK("case_id" IS NULL OR (typeof("case_id") = 'integer' AND "case_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_case_kind_enum" CHECK("case_kind" IN ('standard','warranty_return','correction','linked_after_cancel')),
	CONSTRAINT "repair_case_workflows_parent_case_id_integer" CHECK("parent_case_id" IS NULL OR (typeof("parent_case_id") = 'integer' AND "parent_case_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_workflow_code_enum" CHECK("workflow_code" IN ('mobile_tablet','computer_laptop')),
	CONSTRAINT "repair_case_workflows_process_status_enum" CHECK("process_status" IN ('reception','awaiting_assignment','assigned','diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_pending','qc_rework','qc_conditional','finance_pending','ready_for_delivery','returned_unrepaired','delivered','cancelled','closed')),
	CONSTRAINT "repair_case_workflows_primary_technician_user_id_integer" CHECK("primary_technician_user_id" IS NULL OR (typeof("primary_technician_user_id") = 'integer' AND "primary_technician_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_preapproved_amount_integer" CHECK("preapproved_amount" IS NULL OR (typeof("preapproved_amount") = 'integer' AND "preapproved_amount" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_diagnostic_fee_policy_json_json" CHECK(json_valid("diagnostic_fee_policy_json")),
	CONSTRAINT "repair_case_workflows_customer_consent_json_json" CHECK(json_valid("customer_consent_json")),
	CONSTRAINT "repair_case_workflows_active_work_seconds_integer" CHECK("active_work_seconds" IS NULL OR (typeof("active_work_seconds") = 'integer' AND "active_work_seconds" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_external_wait_seconds_integer" CHECK("external_wait_seconds" IS NULL OR (typeof("external_wait_seconds") = 'integer' AND "external_wait_seconds" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_case_workflows_wait_reason_enum" CHECK("wait_reason" IN ('customer','part','other')),
	CONSTRAINT "repair_case_workflows_terminal_reason_length" CHECK("terminal_reason" IS NULL OR length("terminal_reason") <= 1000),
	CONSTRAINT "repair_case_workflows_lock_version_integer" CHECK("lock_version" IS NULL OR (typeof("lock_version") = 'integer' AND "lock_version" BETWEEN 0 AND 9007199254740991))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_case_workflows_public_unique` ON `repair_case_workflows` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_case_workflows_case_unique` ON `repair_case_workflows` (`case_id`);--> statement-breakpoint
CREATE INDEX `repair_case_workflows_queue_idx` ON `repair_case_workflows` (`shop_id`,`branch_id`,`process_status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `repair_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`case_uuid` text NOT NULL,
	`shop_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`device_id` integer NOT NULL,
	`receipt_sequence` integer NOT NULL,
	`public_receipt_no` text NOT NULL,
	`receipt_number` text NOT NULL,
	`tracking_token_hash` text NOT NULL,
	`tracking_token_ciphertext` text NOT NULL,
	`product_profile_snapshot` text NOT NULL,
	`inventory_mode_snapshot` text NOT NULL,
	`qc_mode_snapshot` text NOT NULL,
	`feature_flags_snapshot_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`device_type_snapshot` text NOT NULL,
	`brand_snapshot` text NOT NULL,
	`model_snapshot` text NOT NULL,
	`color_snapshot` text,
	`identifier_snapshot` text,
	`declared_issue` text NOT NULL,
	`accessories_json` text NOT NULL,
	`appearance_states_json` text NOT NULL,
	`reception_notes` text,
	`status` text DEFAULT 'awaiting_assignment' NOT NULL,
	`result` text,
	`operation_report` text,
	`assigned_to_user_id` integer,
	`created_by_user_id` integer NOT NULL,
	`delivery_amount` integer DEFAULT 0 NOT NULL,
	`delivered_to_name` text,
	`delivery_notes` text,
	`delivered_by_user_id` integer,
	`delivered_at` text,
	`row_version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_id`) REFERENCES `repair_branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `repair_customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_id`) REFERENCES `repair_customer_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`branch_id`) REFERENCES `repair_branches`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`customer_id`) REFERENCES `repair_customers`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`device_id`) REFERENCES `repair_customer_devices`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_to_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`delivered_by_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`assigned_to_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`created_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`delivered_by_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_cases_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "repair_cases_case_uuid_length" CHECK("case_uuid" IS NULL OR length("case_uuid") <= 36),
	CONSTRAINT "repair_cases_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_branch_id_integer" CHECK("branch_id" IS NULL OR (typeof("branch_id") = 'integer' AND "branch_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_customer_id_integer" CHECK("customer_id" IS NULL OR (typeof("customer_id") = 'integer' AND "customer_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_device_id_integer" CHECK("device_id" IS NULL OR (typeof("device_id") = 'integer' AND "device_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_receipt_sequence_integer" CHECK("receipt_sequence" IS NULL OR (typeof("receipt_sequence") = 'integer' AND "receipt_sequence" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_public_receipt_no_length" CHECK("public_receipt_no" IS NULL OR length("public_receipt_no") <= 32),
	CONSTRAINT "repair_cases_receipt_number_length" CHECK("receipt_number" IS NULL OR length("receipt_number") <= 32),
	CONSTRAINT "repair_cases_tracking_token_hash_length" CHECK("tracking_token_hash" IS NULL OR length("tracking_token_hash") <= 64),
	CONSTRAINT "repair_cases_product_profile_snapshot_enum" CHECK("product_profile_snapshot" IN ('solo','pro')),
	CONSTRAINT "repair_cases_inventory_mode_snapshot_enum" CHECK("inventory_mode_snapshot" IN ('off','simple','pro')),
	CONSTRAINT "repair_cases_qc_mode_snapshot_enum" CHECK("qc_mode_snapshot" IN ('off','simple','independent')),
	CONSTRAINT "repair_cases_feature_flags_snapshot_json_json" CHECK(json_valid("feature_flags_snapshot_json")),
	CONSTRAINT "repair_cases_idempotency_key_length" CHECK("idempotency_key" IS NULL OR length("idempotency_key") <= 160),
	CONSTRAINT "repair_cases_device_type_snapshot_length" CHECK("device_type_snapshot" IS NULL OR length("device_type_snapshot") <= 120),
	CONSTRAINT "repair_cases_brand_snapshot_length" CHECK("brand_snapshot" IS NULL OR length("brand_snapshot") <= 120),
	CONSTRAINT "repair_cases_model_snapshot_length" CHECK("model_snapshot" IS NULL OR length("model_snapshot") <= 160),
	CONSTRAINT "repair_cases_color_snapshot_length" CHECK("color_snapshot" IS NULL OR length("color_snapshot") <= 80),
	CONSTRAINT "repair_cases_identifier_snapshot_length" CHECK("identifier_snapshot" IS NULL OR length("identifier_snapshot") <= 190),
	CONSTRAINT "repair_cases_accessories_json_json" CHECK(json_valid("accessories_json")),
	CONSTRAINT "repair_cases_appearance_states_json_json" CHECK(json_valid("appearance_states_json")),
	CONSTRAINT "repair_cases_status_enum" CHECK("status" IN ('awaiting_assignment','assigned','diagnosing','repairing','awaiting_part','awaiting_customer','ready_for_delivery','returned','delivered','cancelled')),
	CONSTRAINT "repair_cases_result_enum" CHECK("result" IN ('repaired','not_repaired')),
	CONSTRAINT "repair_cases_assigned_to_user_id_integer" CHECK("assigned_to_user_id" IS NULL OR (typeof("assigned_to_user_id") = 'integer' AND "assigned_to_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_created_by_user_id_integer" CHECK("created_by_user_id" IS NULL OR (typeof("created_by_user_id") = 'integer' AND "created_by_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_delivery_amount_integer" CHECK("delivery_amount" IS NULL OR (typeof("delivery_amount") = 'integer' AND "delivery_amount" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_delivered_to_name_length" CHECK("delivered_to_name" IS NULL OR length("delivered_to_name") <= 180),
	CONSTRAINT "repair_cases_delivered_by_user_id_integer" CHECK("delivered_by_user_id" IS NULL OR (typeof("delivered_by_user_id") = 'integer' AND "delivered_by_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_cases_row_version_integer" CHECK("row_version" IS NULL OR (typeof("row_version") = 'integer' AND "row_version" BETWEEN 0 AND 9007199254740991))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_public_unique` ON `repair_cases` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_uuid_unique` ON `repair_cases` (`case_uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_public_receipt_unique` ON `repair_cases` (`public_receipt_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_receipt_unique` ON `repair_cases` (`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_shop_sequence_unique` ON `repair_cases` (`shop_id`,`receipt_sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_tracking_hash_unique` ON `repair_cases` (`tracking_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_idempotency_unique` ON `repair_cases` (`shop_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_cases_scope_id_unique` ON `repair_cases` (`shop_id`,`id`);--> statement-breakpoint
CREATE INDEX `repair_cases_shop_status_idx` ON `repair_cases` (`shop_id`,`branch_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `repair_cases_assignee_idx` ON `repair_cases` (`shop_id`,`assigned_to_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `repair_cases_customer_idx` ON `repair_cases` (`shop_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `repair_customer_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`device_model_id` integer,
	`device_type_title` text NOT NULL,
	`brand_title` text NOT NULL,
	`model_title` text NOT NULL,
	`color_title` text,
	`identifier_value` text,
	`normalized_identifier` text,
	`ownership_verified_at` text,
	`ownership_verification_json` text NOT NULL,
	`details_json` text NOT NULL,
	`last_accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `repair_customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`customer_id`) REFERENCES `repair_customers`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`device_model_id`) REFERENCES `repair_device_models`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_customer_devices_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_customer_devices_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "repair_customer_devices_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_customer_devices_customer_id_integer" CHECK("customer_id" IS NULL OR (typeof("customer_id") = 'integer' AND "customer_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_customer_devices_device_model_id_integer" CHECK("device_model_id" IS NULL OR (typeof("device_model_id") = 'integer' AND "device_model_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_customer_devices_device_type_title_length" CHECK("device_type_title" IS NULL OR length("device_type_title") <= 120),
	CONSTRAINT "repair_customer_devices_brand_title_length" CHECK("brand_title" IS NULL OR length("brand_title") <= 120),
	CONSTRAINT "repair_customer_devices_model_title_length" CHECK("model_title" IS NULL OR length("model_title") <= 160),
	CONSTRAINT "repair_customer_devices_color_title_length" CHECK("color_title" IS NULL OR length("color_title") <= 80),
	CONSTRAINT "repair_customer_devices_identifier_value_length" CHECK("identifier_value" IS NULL OR length("identifier_value") <= 190),
	CONSTRAINT "repair_customer_devices_normalized_identifier_length" CHECK("normalized_identifier" IS NULL OR length("normalized_identifier") <= 190),
	CONSTRAINT "repair_customer_devices_ownership_verification_json_json" CHECK(json_valid("ownership_verification_json")),
	CONSTRAINT "repair_customer_devices_details_json_json" CHECK(json_valid("details_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_customer_devices_public_unique` ON `repair_customer_devices` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_customer_devices_scope_id_unique` ON `repair_customer_devices` (`shop_id`,`id`);--> statement-breakpoint
CREATE INDEX `repair_customer_devices_customer_idx` ON `repair_customer_devices` (`shop_id`,`customer_id`,`last_accepted_at`);--> statement-breakpoint
CREATE INDEX `repair_customer_devices_identifier_idx` ON `repair_customer_devices` (`shop_id`,`normalized_identifier`);--> statement-breakpoint
CREATE TABLE `repair_device_brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_type_id` integer NOT NULL,
	`title` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`device_type_id`) REFERENCES `repair_device_types`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_device_brands_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_device_brands_device_type_id_integer" CHECK("device_type_id" IS NULL OR (typeof("device_type_id") = 'integer' AND "device_type_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_device_brands_title_length" CHECK("title" IS NULL OR length("title") <= 120),
	CONSTRAINT "repair_device_brands_is_active_integer" CHECK("is_active" IS NULL OR (typeof("is_active") = 'integer' AND "is_active" BETWEEN 0 AND 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_device_brands_unique` ON `repair_device_brands` (`device_type_id`,`title`);--> statement-breakpoint
CREATE TABLE `repair_device_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`title` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `repair_device_brands`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_device_models_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_device_models_brand_id_integer" CHECK("brand_id" IS NULL OR (typeof("brand_id") = 'integer' AND "brand_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_device_models_title_length" CHECK("title" IS NULL OR length("title") <= 160),
	CONSTRAINT "repair_device_models_is_active_integer" CHECK("is_active" IS NULL OR (typeof("is_active") = 'integer' AND "is_active" BETWEEN 0 AND 1)),
	CONSTRAINT "repair_device_models_usage_count_integer" CHECK("usage_count" IS NULL OR (typeof("usage_count") = 'integer' AND "usage_count" BETWEEN 0 AND 9007199254740991))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_device_models_unique` ON `repair_device_models` (`brand_id`,`title`);--> statement-breakpoint
CREATE TABLE `repair_device_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`title` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_device_types_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_device_types_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_device_types_title_length" CHECK("title" IS NULL OR length("title") <= 120),
	CONSTRAINT "repair_device_types_is_active_integer" CHECK("is_active" IS NULL OR (typeof("is_active") = 'integer' AND "is_active" BETWEEN 0 AND 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_device_types_unique` ON `repair_device_types` (`shop_id`,`title`);--> statement-breakpoint
CREATE TABLE `repair_receipt_sequences` (
	`shop_id` integer PRIMARY KEY NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "repair_receipt_sequences_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "repair_receipt_sequences_last_number_integer" CHECK("last_number" IS NULL OR (typeof("last_number") = 'integer' AND "last_number" BETWEEN 0 AND 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `tamiran_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`shop_id` integer NOT NULL,
	`branch_id` integer,
	`actor_user_id` integer NOT NULL,
	`action_code` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_public_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`request_id` text NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `repair_shops`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`branch_id`) REFERENCES `repair_branches`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `tamiran_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shop_id`,`actor_user_id`) REFERENCES `tamiran_users`(`shop_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tamiran_audit_log_id_integer" CHECK("id" IS NULL OR (typeof("id") = 'integer' AND "id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_audit_log_public_id_length" CHECK("public_id" IS NULL OR length("public_id") <= 26),
	CONSTRAINT "tamiran_audit_log_shop_id_integer" CHECK("shop_id" IS NULL OR (typeof("shop_id") = 'integer' AND "shop_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_audit_log_branch_id_integer" CHECK("branch_id" IS NULL OR (typeof("branch_id") = 'integer' AND "branch_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_audit_log_actor_user_id_integer" CHECK("actor_user_id" IS NULL OR (typeof("actor_user_id") = 'integer' AND "actor_user_id" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "tamiran_audit_log_action_code_length" CHECK("action_code" IS NULL OR length("action_code") <= 80),
	CONSTRAINT "tamiran_audit_log_entity_type_length" CHECK("entity_type" IS NULL OR length("entity_type") <= 80),
	CONSTRAINT "tamiran_audit_log_entity_public_id_length" CHECK("entity_public_id" IS NULL OR length("entity_public_id") <= 80),
	CONSTRAINT "tamiran_audit_log_before_json_json" CHECK("before_json" IS NULL OR json_valid("before_json")),
	CONSTRAINT "tamiran_audit_log_after_json_json" CHECK("after_json" IS NULL OR json_valid("after_json")),
	CONSTRAINT "tamiran_audit_log_reason_length" CHECK("reason" IS NULL OR length("reason") <= 1000),
	CONSTRAINT "tamiran_audit_log_request_id_length" CHECK("request_id" IS NULL OR length("request_id") <= 80),
	CONSTRAINT "tamiran_audit_log_ip_address_length" CHECK("ip_address" IS NULL OR length("ip_address") <= 45),
	CONSTRAINT "tamiran_audit_log_user_agent_length" CHECK("user_agent" IS NULL OR length("user_agent") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tamiran_audit_log_public_unique` ON `tamiran_audit_log` (`public_id`);--> statement-breakpoint
CREATE INDEX `tamiran_audit_log_entity_idx` ON `tamiran_audit_log` (`shop_id`,`entity_type`,`entity_public_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tamiran_audit_log_actor_idx` ON `tamiran_audit_log` (`actor_user_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `repair_shops_public_code_immutable`
BEFORE UPDATE OF `public_shop_code` ON `repair_shops`
WHEN OLD.`public_shop_code` IS NOT NEW.`public_shop_code`
BEGIN SELECT RAISE(ABORT, 'public_shop_code is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_cases_receipt_identity_immutable`
BEFORE UPDATE OF `case_uuid`,`receipt_sequence`,`public_receipt_no`,`receipt_number`,`tracking_token_hash`,`tracking_token_ciphertext` ON `repair_cases`
WHEN OLD.`case_uuid` IS NOT NEW.`case_uuid`
  OR OLD.`receipt_sequence` IS NOT NEW.`receipt_sequence`
  OR OLD.`public_receipt_no` IS NOT NEW.`public_receipt_no`
  OR OLD.`receipt_number` IS NOT NEW.`receipt_number`
  OR OLD.`tracking_token_hash` IS NOT NEW.`tracking_token_hash`
  OR OLD.`tracking_token_ciphertext` IS NOT NEW.`tracking_token_ciphertext`
BEGIN SELECT RAISE(ABORT, 'repair case public identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_receipt_sequences_monotonic`
BEFORE UPDATE OF `last_number` ON `repair_receipt_sequences`
WHEN NEW.`last_number` < OLD.`last_number`
BEGIN SELECT RAISE(ABORT, 'receipt sequence cannot decrease'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_customer_devices_model_shop_insert`
BEFORE INSERT ON `repair_customer_devices`
WHEN NEW.`device_model_id` IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM `repair_device_models` m
   JOIN `repair_device_brands` b ON b.`id` = m.`brand_id`
   JOIN `repair_device_types` t ON t.`id` = b.`device_type_id`
   WHERE m.`id` = NEW.`device_model_id` AND t.`shop_id` = NEW.`shop_id`
 )
BEGIN SELECT RAISE(ABORT, 'device model is outside shop scope'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_customer_devices_model_shop_update`
BEFORE UPDATE OF `device_model_id`,`shop_id` ON `repair_customer_devices`
WHEN NEW.`device_model_id` IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM `repair_device_models` m
   JOIN `repair_device_brands` b ON b.`id` = m.`brand_id`
   JOIN `repair_device_types` t ON t.`id` = b.`device_type_id`
   WHERE m.`id` = NEW.`device_model_id` AND t.`shop_id` = NEW.`shop_id`
 )
BEGIN SELECT RAISE(ABORT, 'device model is outside shop scope'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_events_actor_scope_insert`
BEFORE INSERT ON `repair_case_events`
WHEN NOT EXISTS (
  SELECT 1 FROM `repair_cases` c
  JOIN `tamiran_users` u ON u.`id` = NEW.`actor_user_id` AND u.`shop_id` = c.`shop_id`
  WHERE c.`id` = NEW.`case_id`
)
BEGIN SELECT RAISE(ABORT, 'case event actor is outside shop scope'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_stage_events_actor_scope_insert`
BEFORE INSERT ON `repair_case_stage_events`
WHEN NOT EXISTS (
  SELECT 1 FROM `repair_case_workflows` w
  JOIN `tamiran_users` u ON u.`id` = NEW.`actor_user_id` AND u.`shop_id` = w.`shop_id`
  WHERE w.`id` = NEW.`workflow_id`
)
BEGIN SELECT RAISE(ABORT, 'stage event actor is outside shop scope'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_workflows_parent_scope_insert`
BEFORE INSERT ON `repair_case_workflows`
WHEN NEW.`parent_case_id` IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM `repair_cases` c WHERE c.`id` = NEW.`parent_case_id` AND c.`shop_id` = NEW.`shop_id`)
BEGIN SELECT RAISE(ABORT, 'parent case is outside shop scope'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_workflows_parent_scope_update`
BEFORE UPDATE OF `parent_case_id`,`shop_id` ON `repair_case_workflows`
WHEN NEW.`parent_case_id` IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM `repair_cases` c WHERE c.`id` = NEW.`parent_case_id` AND c.`shop_id` = NEW.`shop_id`)
BEGIN SELECT RAISE(ABORT, 'parent case is outside shop scope'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_events_no_update`
BEFORE UPDATE ON `repair_case_events`
BEGIN SELECT RAISE(ABORT, 'case event is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_events_no_delete`
BEFORE DELETE ON `repair_case_events`
BEGIN SELECT RAISE(ABORT, 'case event is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_stage_events_no_update`
BEFORE UPDATE ON `repair_case_stage_events`
BEGIN SELECT RAISE(ABORT, 'stage event is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `repair_case_stage_events_no_delete`
BEFORE DELETE ON `repair_case_stage_events`
BEGIN SELECT RAISE(ABORT, 'stage event is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tamiran_audit_log_no_update`
BEFORE UPDATE ON `tamiran_audit_log`
BEGIN SELECT RAISE(ABORT, 'audit log is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tamiran_audit_log_no_delete`
BEFORE DELETE ON `tamiran_audit_log`
BEGIN SELECT RAISE(ABORT, 'audit log is immutable'); END;
