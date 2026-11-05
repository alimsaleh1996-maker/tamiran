-- تعمیران ۲.۰.۰ بتا ۶ مخصوص DirectAdmin | نصب تمیز | MySQL 8 / MariaDB 10.4+
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS tamiran_schema_versions (
  version VARCHAR(40) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO tamiran_schema_versions(version) VALUES ('2.0.0-beta.7');

CREATE TABLE IF NOT EXISTS repair_shops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_code VARCHAR(64) NOT NULL,
  public_shop_code CHAR(6) NOT NULL, receipt_counter BIGINT UNSIGNED NOT NULL DEFAULT 0, name VARCHAR(180) NOT NULL,
  repair_type VARCHAR(64) NOT NULL, repair_type_locked TINYINT(1) NOT NULL DEFAULT 1,
  size_profile ENUM('personal','small','medium','large') NOT NULL DEFAULT 'small', plan_code VARCHAR(64) NOT NULL DEFAULT 'light',
  operation_mode ENUM('single_user','multi_user') NOT NULL DEFAULT 'multi_user',
  product_profile ENUM('solo','pro') NOT NULL DEFAULT 'pro',
  inventory_mode ENUM('off','simple','pro') NOT NULL DEFAULT 'off',
  qc_mode ENUM('off','simple','independent') NOT NULL DEFAULT 'off',
  inventory_cost_method ENUM('weighted_average','fifo','last_purchase') NOT NULL DEFAULT 'weighted_average',
  allow_self_qc TINYINT(1) NOT NULL DEFAULT 0, allow_delivery_with_balance TINYINT(1) NOT NULL DEFAULT 0,
  workflow_settings_json JSON NOT NULL, tax_settings_json JSON NOT NULL, feature_flags_json JSON NOT NULL,
  modules_json JSON NOT NULL, national_code_required TINYINT(1) NOT NULL DEFAULT 0,
  lifecycle_status ENUM('active','suspended','expired','read_only') NOT NULL DEFAULT 'active',
  license_started_at DATE NOT NULL, license_expires_at DATE NOT NULL, max_users SMALLINT UNSIGNED NOT NULL DEFAULT 3, max_branches SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_shops_public_id_unique (public_id), UNIQUE KEY repair_shops_code_unique (shop_code),
  UNIQUE KEY repair_shops_public_code_unique (public_shop_code), KEY repair_shops_license_idx (lifecycle_status, license_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_branches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NOT NULL, branch_code VARCHAR(64) NOT NULL, name VARCHAR(180) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran', business_hours_json JSON NOT NULL,
  address VARCHAR(1000) NULL, phone VARCHAR(20) NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_branches_shop_code_unique (shop_id, branch_code), UNIQUE KEY repair_branches_scope_id_unique (shop_id, id),
  CONSTRAINT repair_branches_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NULL, username VARCHAR(120) NOT NULL, display_name VARCHAR(180) NOT NULL,
  phone VARCHAR(20) NULL, email VARCHAR(190) NULL,
  password_hash VARCHAR(255) NOT NULL, role_code ENUM('central_admin','repair_manager','reception','technician','quality_control','warehouse_keeper','finance_cashier') NOT NULL,
  active_session_hash CHAR(64) NULL, must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1, deactivated_at DATETIME NULL, deactivation_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, last_login_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY tamiran_users_scope_username_unique (shop_id, username), UNIQUE KEY tamiran_users_scope_id_unique (shop_id, id), KEY tamiran_users_role_idx (role_code), KEY tamiran_users_shop_active_idx (shop_id, is_active), KEY tamiran_users_phone_idx (phone),
  CONSTRAINT tamiran_users_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_user_branches (
  shop_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  branch_role_code ENUM('repair_manager','reception','technician','quality_control','warehouse_keeper','finance_cashier') NOT NULL,
  permissions_json JSON NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, branch_id),
  KEY tamiran_user_branches_scope_idx (shop_id, branch_id, is_active),
  CONSTRAINT tamiran_user_branches_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_user_branches_user_scope_fk FOREIGN KEY (shop_id, user_id) REFERENCES tamiran_users (shop_id, id) ON DELETE CASCADE,
  CONSTRAINT tamiran_user_branches_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE CASCADE,
  CONSTRAINT tamiran_user_branches_user_fk FOREIGN KEY (user_id) REFERENCES tamiran_users (id) ON DELETE CASCADE,
  CONSTRAINT tamiran_user_branches_branch_fk FOREIGN KEY (branch_id) REFERENCES repair_branches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_shop_create_operations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL, idempotency_key VARCHAR(160) NOT NULL,
  state ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  request_snapshot_json JSON NOT NULL, result_json JSON NULL,
  failure_code VARCHAR(80) NULL, failure_message VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_shop_create_operations_public_unique(public_id),
  UNIQUE KEY tamiran_shop_create_operations_idempotency_unique(actor_user_id,idempotency_key),
  CONSTRAINT tamiran_shop_create_operations_actor_fk FOREIGN KEY(actor_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_shop_module_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NOT NULL, actor_user_id BIGINT UNSIGNED NOT NULL,
  previous_modules_json JSON NOT NULL, new_modules_json JSON NOT NULL, added_modules_json JSON NOT NULL, removed_modules_json JSON NOT NULL,
  change_reason VARCHAR(1000) NOT NULL, change_context VARCHAR(32) NOT NULL DEFAULT 'manual', related_plan_code VARCHAR(64) NULL,
  related_invoice_number VARCHAR(64) NULL, related_license_expires_at DATE NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY tamiran_shop_module_changes_shop_time_idx (shop_id, created_at),
  CONSTRAINT tamiran_shop_module_changes_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_shop_module_changes_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_product_offerings (
  product_code ENUM('solo','pro') NOT NULL, title VARCHAR(80) NOT NULL, description VARCHAR(500) NOT NULL,
  default_plan_code VARCHAR(64) NOT NULL, included_modules_json JSON NOT NULL, allowed_modules_json JSON NOT NULL,
  limits_json JSON NOT NULL, prices_json JSON NOT NULL, feature_summary_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tamiran_product_offerings(product_code,title,description,default_plan_code,included_modules_json,allowed_modules_json,limits_json,prices_json,feature_summary_json,is_active) VALUES
('solo','تعمیران Solo','نسخه تک‌نفره برای مدیریت ساده و سریع تعمیرگاه','light','["repair"]','["repair","inventory","finance","customer_portal","sms"]','{"maxUsers":1,"maxBranches":1,"operationMode":"single_user","maxInventoryMode":"simple","maxQcMode":"simple"}','{"monthly":0,"quarterly":0,"semiannual":0,"annual":0,"custom":0}','["یک کاربر و یک شعبه","گردش ساده تعمیر","انبار و QC ساده اختیاری"]',1),
('pro','تعمیران Pro','نسخه تیمی با نقش‌ها، کنترل کیفیت و فرایندهای کامل','professional','["repair"]','["repair","inventory","finance","customer_portal","multi_branch","sms"]','{"maxUsers":1000,"maxBranches":100,"operationMode":"multi_user","maxInventoryMode":"pro","maxQcMode":"independent"}','{"monthly":0,"quarterly":0,"semiannual":0,"annual":0,"custom":0}','["چندکاربره و چندشعبه‌ای","انبار و سفارش خرید حرفه‌ای","QC مستقل و دسترسی‌های تفکیکی"]',1)
ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),default_plan_code=VALUES(default_plan_code),included_modules_json=VALUES(included_modules_json),allowed_modules_json=VALUES(allowed_modules_json),limits_json=VALUES(limits_json),feature_summary_json=VALUES(feature_summary_json);

CREATE TABLE IF NOT EXISTS tamiran_shop_product_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL, previous_product ENUM('solo','pro') NOT NULL, new_product ENUM('solo','pro') NOT NULL,
  previous_config_json JSON NOT NULL, new_config_json JSON NOT NULL, change_reason VARCHAR(1000) NOT NULL,
  related_invoice_id BIGINT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_shop_product_changes_public_unique (public_id),
  KEY tamiran_shop_product_changes_shop_time_idx (shop_id,created_at),
  CONSTRAINT tamiran_shop_product_changes_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_shop_product_changes_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_product_change_operations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL, actor_user_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL, source_product ENUM('solo','pro') NOT NULL,
  target_product ENUM('solo','pro') NOT NULL,
  state ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  settings_json JSON NOT NULL, precheck_json JSON NOT NULL, snapshot_json JSON NOT NULL,
  result_json JSON NULL, failure_code VARCHAR(80) NULL, failure_message VARCHAR(1000) NULL,
  started_at DATETIME NULL, completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_product_change_operations_public_unique (public_id),
  UNIQUE KEY tamiran_product_change_operations_idempotency_unique (shop_id,idempotency_key),
  KEY tamiran_product_change_operations_shop_time_idx (shop_id,created_at),
  CONSTRAINT tamiran_product_change_operations_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_product_change_operations_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_auth_throttles (
  scope_key CHAR(64) NOT NULL, failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, blocked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (scope_key), KEY tamiran_auth_throttles_cleanup_idx (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_shop_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NOT NULL, setting_key VARCHAR(80) NOT NULL,
  value_json JSON NOT NULL, updated_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_shop_settings_scope_unique (shop_id, setting_key),
  CONSTRAINT repair_shop_settings_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_shop_settings_user_fk FOREIGN KEY (updated_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_plan_entitlements (
  plan_code VARCHAR(64) NOT NULL, capability_code VARCHAR(100) NOT NULL,
  is_allowed TINYINT(1) NOT NULL DEFAULT 1, limits_json JSON NOT NULL,
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, effective_to DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_code, capability_code), KEY tamiran_plan_entitlements_active_idx (plan_code, is_allowed, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_shop_feature_overrides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  capability_code VARCHAR(100) NOT NULL, is_enabled TINYINT(1) NOT NULL, settings_json JSON NOT NULL,
  reason VARCHAR(1000) NOT NULL, expires_at DATETIME NULL, updated_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_shop_feature_overrides_public_unique (public_id),
  UNIQUE KEY tamiran_shop_feature_overrides_scope_unique (shop_id, capability_code),
  CONSTRAINT tamiran_shop_feature_overrides_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_shop_feature_overrides_user_fk FOREIGN KEY (updated_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_modules (
  module_key VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, description VARCHAR(600) NOT NULL,
  product_scope ENUM('solo','pro','both') NOT NULL DEFAULT 'both', is_core TINYINT(1) NOT NULL DEFAULT 0,
  is_sellable TINYINT(1) NOT NULL DEFAULT 1, status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (module_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tamiran_modules(module_key,name,description,product_scope,is_core,is_sellable,status) VALUES
('repair','مدیریت تعمیرات','پذیرش، پرونده و گردش اصلی تعمیر','both',1,0,'active'),
('inventory','انبار قطعات','موجودی، رزرو، درخواست و گردش قطعات','both',0,1,'active'),
('finance','مالی پرونده','هزینه‌ها، دریافت‌ها و مانده هر پرونده','both',0,1,'active'),
('customer_portal','پرتال مشتری','پیگیری امن وضعیت تعمیر برای مشتری','both',0,1,'active'),
('sms','پیامک رویدادها','اعلان مرحله‌های مهم پرونده به مشتری','both',0,1,'active'),
('warranty','گارانتی شرکتی','تشخیص پوشش براساس سریال و سابقه گارانتی','both',0,1,'active'),
('multi_branch','چندشعبه‌ای','مدیریت شعب و گزارش تلفیقی','pro',0,1,'active'),
('analytics','گزارش‌های حرفه‌ای','تحلیل SLA، بهره‌وری و روند عملیات','pro',0,1,'active'),
('accounting_integration','اتصال حسابداری','خروجی و یکپارچگی مالی کنترل‌شده','pro',0,1,'active'),
('sla','SLA حرفه‌ای','اولویت‌بندی، هشدار و پایش زمان تعهد','pro',0,1,'active'),
('api','API سازمانی','دسترسی برنامه‌نویسی‌شده و ممیزی‌شده','pro',0,1,'active')
ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),product_scope=VALUES(product_scope),is_core=VALUES(is_core),is_sellable=VALUES(is_sellable),status=VALUES(status);

CREATE TABLE IF NOT EXISTS tamiran_shop_modules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, repair_shop_id BIGINT UNSIGNED NOT NULL, module_key VARCHAR(80) NOT NULL,
  state ENUM('active','trial','locked','expired','suspended') NOT NULL DEFAULT 'locked', source VARCHAR(40) NOT NULL DEFAULT 'manual',
  started_at DATETIME NULL, expires_at DATETIME NULL, config_json JSON NOT NULL, updated_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_shop_modules_scope_unique (repair_shop_id,module_key),
  KEY tamiran_shop_modules_state_idx (repair_shop_id,state,expires_at),
  CONSTRAINT tamiran_shop_modules_shop_fk FOREIGN KEY (repair_shop_id) REFERENCES repair_shops(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_shop_modules_module_fk FOREIGN KEY (module_key) REFERENCES tamiran_modules(module_key) ON DELETE RESTRICT,
  CONSTRAINT tamiran_shop_modules_actor_fk FOREIGN KEY (updated_by_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_module_discovery (
  module_key VARCHAR(80) NOT NULL, visible_to_owner TINYINT(1) NOT NULL DEFAULT 1, visible_to_admin TINYINT(1) NOT NULL DEFAULT 1,
  product_scope ENUM('solo','pro','both') NOT NULL DEFAULT 'both', display_order SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  PRIMARY KEY (module_key), CONSTRAINT tamiran_module_discovery_module_fk FOREIGN KEY (module_key) REFERENCES tamiran_modules(module_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tamiran_module_discovery(module_key,visible_to_owner,visible_to_admin,product_scope,display_order)
SELECT module_key,1,1,product_scope,100 FROM tamiran_modules WHERE is_sellable=1
ON DUPLICATE KEY UPDATE visible_to_owner=VALUES(visible_to_owner),visible_to_admin=VALUES(visible_to_admin),product_scope=VALUES(product_scope);

CREATE TABLE IF NOT EXISTS tamiran_module_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, repair_shop_id BIGINT UNSIGNED NOT NULL, module_key VARCHAR(80) NOT NULL,
  event_type VARCHAR(80) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, metadata_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY tamiran_module_events_shop_time_idx (repair_shop_id,created_at), KEY tamiran_module_events_type_idx (event_type,created_at),
  CONSTRAINT tamiran_module_events_shop_fk FOREIGN KEY (repair_shop_id) REFERENCES repair_shops(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_module_events_module_fk FOREIGN KEY (module_key) REFERENCES tamiran_modules(module_key) ON DELETE RESTRICT,
  CONSTRAINT tamiran_module_events_actor_fk FOREIGN KEY (actor_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_module_activation_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, repair_shop_id BIGINT UNSIGNED NOT NULL,
  module_key VARCHAR(80) NOT NULL, status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reason VARCHAR(1000) NULL, requested_by_user_id BIGINT UNSIGNED NOT NULL, reviewed_by_user_id BIGINT UNSIGNED NULL, reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_module_activation_requests_public_unique (public_id),
  KEY tamiran_module_activation_requests_queue_idx (status,created_at),
  CONSTRAINT tamiran_module_activation_requests_shop_fk FOREIGN KEY (repair_shop_id) REFERENCES repair_shops(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_module_activation_requests_module_fk FOREIGN KEY (module_key) REFERENCES tamiran_modules(module_key) ON DELETE RESTRICT,
  CONSTRAINT tamiran_module_activation_requests_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_module_activation_requests_reviewer_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_data_retention_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NOT NULL,
  otp_days SMALLINT UNSIGNED NOT NULL DEFAULT 7, sms_log_days SMALLINT UNSIGNED NOT NULL DEFAULT 365,
  application_log_days SMALLINT UNSIGNED NOT NULL DEFAULT 30, reception_draft_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  private_file_days_after_warranty SMALLINT UNSIGNED NOT NULL DEFAULT 365,
  device_secret_delete_on_delivery TINYINT(1) NOT NULL DEFAULT 1,
  updated_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_data_retention_policies_shop_unique (shop_id),
  CONSTRAINT tamiran_data_retention_policies_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_data_retention_policies_user_fk FOREIGN KEY (updated_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_retention_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  status ENUM('running','completed','failed') NOT NULL DEFAULT 'running', result_json JSON NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY tamiran_retention_runs_public_unique (public_id), KEY tamiran_retention_runs_shop_time_idx (shop_id, started_at),
  CONSTRAINT tamiran_retention_runs_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_reception_drafts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  payload_json JSON NOT NULL, idempotency_key VARCHAR(160) NOT NULL,
  status ENUM('active','submitted','discarded','expired') NOT NULL DEFAULT 'active', submitted_case_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_reception_drafts_public_unique (public_id),
  UNIQUE KEY repair_reception_drafts_idempotency_unique (shop_id, idempotency_key),
  KEY repair_reception_drafts_owner_idx (shop_id, branch_id, created_by_user_id, status, updated_at),
  CONSTRAINT repair_reception_drafts_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_reception_drafts_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_reception_drafts_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_receipt_term_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  version_number SMALLINT UNSIGNED NOT NULL, title VARCHAR(180) NOT NULL, body_text TEXT NOT NULL,
  content_sha256 CHAR(64) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, effective_to DATETIME NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_receipt_term_versions_public_unique (public_id),
  UNIQUE KEY repair_receipt_term_versions_shop_version_unique (shop_id, version_number),
  KEY repair_receipt_term_versions_active_idx (shop_id, is_active, effective_from),
  CONSTRAINT repair_receipt_term_versions_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_receipt_term_versions_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_sales_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_number VARCHAR(64) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  operation_type ENUM('new_sale','renewal','upgrade','add_module','increase_capacity','renewal_product_change','contract_correction') NOT NULL DEFAULT 'new_sale',
  idempotency_key VARCHAR(160) NOT NULL,
  product_profile ENUM('solo','pro') NOT NULL DEFAULT 'pro', product_snapshot_json JSON NOT NULL,
  activation_status ENUM('pending','activated','cancelled') NOT NULL DEFAULT 'pending', activated_at DATETIME NULL,
  provisioning_status ENUM('not_applied','scheduled','processing','active','failed','expired') NOT NULL DEFAULT 'not_applied', provisioning_error VARCHAR(1000) NULL,
  plan_code VARCHAR(64) NOT NULL, repair_type_code VARCHAR(64) NOT NULL, modules_json JSON NOT NULL, items_json JSON NOT NULL,
  billing_period ENUM('monthly','quarterly','semiannual','annual','custom') NOT NULL DEFAULT 'annual',
  issue_date DATE NOT NULL, due_date DATE NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, description VARCHAR(240) NOT NULL,
  subtotal_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, paid_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft','issued','partial','paid','cancelled') NOT NULL DEFAULT 'issued', discount_reason VARCHAR(1000) NULL,
  notes TEXT NULL, internal_notes TEXT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_sales_invoices_public_unique (public_id), UNIQUE KEY tamiran_sales_invoices_number_unique (invoice_number),
  UNIQUE KEY tamiran_sales_invoices_idempotency_unique (shop_id,idempotency_key),
  KEY tamiran_sales_invoices_shop_status_idx (shop_id, status, due_date),
  CONSTRAINT tamiran_sales_invoices_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_sales_invoices_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_price_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, product_key VARCHAR(100) NOT NULL, name VARCHAR(180) NOT NULL,
  item_type ENUM('product','module','capacity','service') NOT NULL, billing_period ENUM('monthly','quarterly','semiannual','annual','one_time','custom') NOT NULL,
  tax_rate DECIMAL(7,4) NOT NULL DEFAULT 0, entitlement_effect_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY tamiran_price_catalog_key_period_unique(product_key,billing_period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_price_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, catalog_id BIGINT UNSIGNED NOT NULL, version_code VARCHAR(40) NOT NULL,
  unit_price BIGINT UNSIGNED NOT NULL, effective_from DATETIME NOT NULL, effective_to DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY tamiran_price_versions_catalog_code_unique(catalog_id,version_code),
  KEY tamiran_price_versions_effective_idx(catalog_id,is_active,effective_from,effective_to),
  CONSTRAINT tamiran_price_versions_catalog_fk FOREIGN KEY(catalog_id) REFERENCES tamiran_price_catalog(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tamiran_price_catalog(product_key,name,item_type,billing_period,tax_rate,entitlement_effect_json,is_active) VALUES
('tamiran_solo','Tamiran Solo','product','annual',0,'{"product_profile":"solo","users_included":1,"branches_included":1}',1),
('tamiran_pro','Tamiran Pro','product','annual',0,'{"product_profile":"pro","users_included":10,"branches_included":1}',1),
('inventory_pro','Inventory Pro','module','annual',0,'{"module":"inventory","inventory_mode":"pro"}',1),
('warranty_corporate','Warranty Corporate','module','annual',0,'{"module":"warranty"}',1),
('customer_portal','Customer Portal','module','annual',0,'{"module":"customer_portal"}',1),
('finance_module','مالی پرونده','module','annual',0,'{"module":"finance"}',1),
('sms_module','پیامک و اطلاع‌رسانی','module','annual',0,'{"module":"sms"}',1),
('multi_branch','Multi Branch','module','annual',0,'{"module":"multi_branch"}',1),
('extra_user','کاربر اضافه','capacity','annual',0,'{"users_limit_delta":1}',1),
('extra_branch','شعبه اضافه','capacity','annual',0,'{"branches_limit_delta":1}',1),
('advanced_analytics','Advanced Analytics','module','annual',0,'{"module":"analytics"}',1),
('accounting_integration','Accounting Integration','module','annual',0,'{"module":"accounting_integration"}',1)
ON DUPLICATE KEY UPDATE name=VALUES(name),item_type=VALUES(item_type),tax_rate=VALUES(tax_rate),entitlement_effect_json=VALUES(entitlement_effect_json),is_active=VALUES(is_active);

CREATE TABLE IF NOT EXISTS tamiran_sales_invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, invoice_id BIGINT UNSIGNED NOT NULL, product_key VARCHAR(100) NOT NULL,
  item_type VARCHAR(32) NOT NULL, price_version VARCHAR(40) NOT NULL, description_snapshot VARCHAR(240) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1, unit_price BIGINT UNSIGNED NOT NULL, discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tax_rate DECIMAL(7,4) NOT NULL DEFAULT 0, tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, line_total BIGINT UNSIGNED NOT NULL,
  entitlement_payload JSON NOT NULL, price_override TINYINT(1) NOT NULL DEFAULT 0, override_reason VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY tamiran_sales_invoice_items_invoice_idx(invoice_id,id),
  CONSTRAINT tamiran_sales_invoice_items_invoice_fk FOREIGN KEY(invoice_id) REFERENCES tamiran_sales_invoices(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_sales_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_id BIGINT UNSIGNED NOT NULL,
  amount BIGINT UNSIGNED NOT NULL, payment_method ENUM('cash','bank_transfer','pos','online_gateway','other') NOT NULL,
  reference VARCHAR(190) NULL, paid_at DATETIME NOT NULL, note VARCHAR(1000) NULL, idempotency_key VARCHAR(160) NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY tamiran_sales_payments_public_unique(public_id),
  UNIQUE KEY tamiran_sales_payments_idempotency_unique(invoice_id,idempotency_key), KEY tamiran_sales_payments_invoice_idx(invoice_id,paid_at),
  CONSTRAINT tamiran_sales_payments_invoice_fk FOREIGN KEY(invoice_id) REFERENCES tamiran_sales_invoices(id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_sales_payments_actor_fk FOREIGN KEY(created_by_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tamiran_shop_product_changes
  ADD CONSTRAINT tamiran_shop_product_changes_invoice_fk FOREIGN KEY (related_invoice_id) REFERENCES tamiran_sales_invoices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS repair_device_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, shop_id BIGINT UNSIGNED NOT NULL, title VARCHAR(120) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY repair_device_types_unique (shop_id, title),
  CONSTRAINT repair_device_types_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_device_brands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, device_type_id BIGINT UNSIGNED NOT NULL, title VARCHAR(120) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id), UNIQUE KEY repair_device_brands_unique (device_type_id, title),
  CONSTRAINT repair_device_brands_type_fk FOREIGN KEY (device_type_id) REFERENCES repair_device_types (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_device_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, brand_id BIGINT UNSIGNED NOT NULL, title VARCHAR(160) NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, usage_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id), UNIQUE KEY repair_device_models_unique (brand_id, title),
  CONSTRAINT repair_device_models_brand_fk FOREIGN KEY (brand_id) REFERENCES repair_device_brands (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_receipt_sequences (
  shop_id BIGINT UNSIGNED NOT NULL, last_number BIGINT UNSIGNED NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id), CONSTRAINT repair_receipt_sequences_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(180) NOT NULL, mobile VARCHAR(20) NOT NULL, secondary_mobile VARCHAR(20) NULL, mobile_verified_at DATETIME NULL,
  national_code VARCHAR(10) NULL, province VARCHAR(100) NULL, city VARCHAR(100) NULL, address VARCHAR(1000) NULL, postal_code VARCHAR(10) NULL,
  notes TEXT NULL, archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_customers_public_unique (public_id), UNIQUE KEY repair_customers_shop_mobile_unique (shop_id, mobile), UNIQUE KEY repair_customers_scope_id_unique (shop_id, id), KEY repair_customers_shop_name_idx (shop_id, full_name),
  CONSTRAINT repair_customers_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_customer_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED NOT NULL,
  device_model_id BIGINT UNSIGNED NULL, device_type_title VARCHAR(120) NOT NULL, brand_title VARCHAR(120) NOT NULL, model_title VARCHAR(160) NOT NULL, color_title VARCHAR(80) NULL,
  identifier_value VARCHAR(190) NULL, normalized_identifier VARCHAR(190) NULL, ownership_verified_at DATETIME NULL,
  ownership_verification_json JSON NOT NULL, details_json JSON NOT NULL, last_accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_customer_devices_public_unique (public_id), UNIQUE KEY repair_customer_devices_scope_id_unique (shop_id, id), KEY repair_customer_devices_customer_idx (shop_id, customer_id, last_accepted_at), KEY repair_customer_devices_identifier_idx (shop_id, normalized_identifier),
  CONSTRAINT repair_customer_devices_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_customer_devices_customer_fk FOREIGN KEY (customer_id) REFERENCES repair_customers (id) ON DELETE RESTRICT,
  CONSTRAINT repair_customer_devices_customer_scope_fk FOREIGN KEY (shop_id, customer_id) REFERENCES repair_customers (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_customer_devices_model_fk FOREIGN KEY (device_model_id) REFERENCES repair_device_models (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, case_uuid CHAR(36) NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED NOT NULL, device_id BIGINT UNSIGNED NOT NULL,
  receipt_sequence BIGINT UNSIGNED NOT NULL, public_receipt_no VARCHAR(32) NOT NULL, receipt_number VARCHAR(32) NOT NULL,
  tracking_token_hash CHAR(64) NOT NULL, tracking_token_ciphertext TEXT NOT NULL,
  product_profile_snapshot ENUM('solo','pro') NOT NULL, inventory_mode_snapshot ENUM('off','simple','pro') NOT NULL,
  qc_mode_snapshot ENUM('off','simple','independent') NOT NULL, feature_flags_snapshot_json JSON NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  device_type_snapshot VARCHAR(120) NOT NULL, brand_snapshot VARCHAR(120) NOT NULL, model_snapshot VARCHAR(160) NOT NULL, color_snapshot VARCHAR(80) NULL, identifier_snapshot VARCHAR(190) NULL,
  declared_issue TEXT NOT NULL, accessories_json JSON NOT NULL, appearance_states_json JSON NOT NULL, reception_notes TEXT NULL,
  status ENUM('awaiting_assignment','assigned','diagnosing','repairing','awaiting_part','awaiting_customer','ready_for_delivery','returned','delivered','cancelled') NOT NULL DEFAULT 'awaiting_assignment',
  result ENUM('repaired','not_repaired') NULL, operation_report TEXT NULL, assigned_to_user_id BIGINT UNSIGNED NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  delivery_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, delivered_to_name VARCHAR(180) NULL, delivery_notes TEXT NULL,
  delivered_by_user_id BIGINT UNSIGNED NULL, delivered_at DATETIME NULL, row_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_cases_public_unique (public_id), UNIQUE KEY repair_cases_uuid_unique (case_uuid),
  UNIQUE KEY repair_cases_public_receipt_unique (public_receipt_no), UNIQUE KEY repair_cases_receipt_unique (receipt_number),
  UNIQUE KEY repair_cases_shop_sequence_unique (shop_id, receipt_sequence), UNIQUE KEY repair_cases_tracking_hash_unique (tracking_token_hash),
  UNIQUE KEY repair_cases_idempotency_unique (shop_id, idempotency_key), UNIQUE KEY repair_cases_scope_id_unique (shop_id, id),
  KEY repair_cases_shop_status_idx (shop_id, branch_id, status, updated_at), KEY repair_cases_assignee_idx (shop_id, assigned_to_user_id, status), KEY repair_cases_customer_idx (shop_id, customer_id, created_at),
  CONSTRAINT repair_cases_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_branch_fk FOREIGN KEY (branch_id) REFERENCES repair_branches (id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_customer_fk FOREIGN KEY (customer_id) REFERENCES repair_customers (id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_device_fk FOREIGN KEY (device_id) REFERENCES repair_customer_devices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_customer_scope_fk FOREIGN KEY (shop_id, customer_id) REFERENCES repair_customers (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_device_scope_fk FOREIGN KEY (shop_id, device_id) REFERENCES repair_customer_devices (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_assignee_fk FOREIGN KEY (assigned_to_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_cases_deliverer_fk FOREIGN KEY (delivered_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE repair_reception_drafts
  ADD CONSTRAINT repair_reception_drafts_submitted_case_fk FOREIGN KEY (submitted_case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT;

DELIMITER $$
DROP TRIGGER IF EXISTS repair_shops_public_code_immutable$$
CREATE TRIGGER repair_shops_public_code_immutable BEFORE UPDATE ON repair_shops FOR EACH ROW
BEGIN
  IF NOT (OLD.public_shop_code <=> NEW.public_shop_code) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='public_shop_code is immutable';
  END IF;
END$$
DROP TRIGGER IF EXISTS repair_cases_receipt_identity_immutable$$
CREATE TRIGGER repair_cases_receipt_identity_immutable BEFORE UPDATE ON repair_cases FOR EACH ROW
BEGIN
  IF NOT (OLD.case_uuid <=> NEW.case_uuid)
     OR NOT (OLD.receipt_sequence <=> NEW.receipt_sequence)
     OR NOT (OLD.public_receipt_no <=> NEW.public_receipt_no)
     OR NOT (OLD.receipt_number <=> NEW.receipt_number)
     OR NOT (OLD.tracking_token_hash <=> NEW.tracking_token_hash)
     OR NOT (OLD.tracking_token_ciphertext <=> NEW.tracking_token_ciphertext) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='repair case public identity is immutable';
  END IF;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS repair_case_receipt_terms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  term_version_id BIGINT UNSIGNED NOT NULL, accepted_by_name VARCHAR(180) NOT NULL,
  acceptance_method ENUM('digital_signature','in_person_signature','sms_otp','recorded_consent') NOT NULL,
  evidence_json JSON NOT NULL, accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_case_receipt_terms_public_unique (public_id), UNIQUE KEY repair_case_receipt_terms_case_unique (case_id),
  CONSTRAINT repair_case_receipt_terms_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_receipt_terms_version_fk FOREIGN KEY (term_version_id) REFERENCES repair_receipt_term_versions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, case_id BIGINT UNSIGNED NOT NULL, actor_user_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL, from_status VARCHAR(32) NULL, to_status VARCHAR(32) NULL, description TEXT NOT NULL, metadata_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY repair_case_events_case_time_idx (case_id, created_at),
  CONSTRAINT repair_case_events_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_events_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_inventory_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(80) NOT NULL, title VARCHAR(180) NOT NULL, category VARCHAR(120) NULL, unit_title VARCHAR(40) NOT NULL DEFAULT 'عدد',
  purchase_price BIGINT UNSIGNED NOT NULL DEFAULT 0, sale_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  physical_quantity INT UNSIGNED NOT NULL DEFAULT 0, reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0, minimum_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  hot_return_required TINYINT(1) NOT NULL DEFAULT 0, hot_evidence_rules_json JSON NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_inventory_items_public_unique (public_id), UNIQUE KEY repair_inventory_items_shop_code_unique (shop_id, item_code), UNIQUE KEY repair_inventory_items_scope_id_unique (shop_id, id), KEY repair_inventory_items_shop_active_idx (shop_id, is_active),
  CONSTRAINT repair_inventory_items_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NULL, movement_type ENUM('in','out','reserve','release','return','adjustment') NOT NULL,
  quantity INT UNSIGNED NOT NULL, reference_code VARCHAR(100) NULL, notes TEXT NULL, actor_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_inventory_movements_public_unique (public_id), KEY repair_inventory_movements_shop_time_idx (shop_id, branch_id, created_at), KEY repair_inventory_movements_item_time_idx (item_id, created_at),
  CONSTRAINT repair_inventory_movements_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_movements_branch_fk FOREIGN KEY (branch_id) REFERENCES repair_branches (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_movements_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_movements_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_movements_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_part_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NULL, requested_by_user_id BIGINT UNSIGNED NOT NULL, quantity INT UNSIGNED NOT NULL DEFAULT 1,
  reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0, delivered_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  consumed_quantity INT UNSIGNED NOT NULL DEFAULT 0, returned_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  source_type ENUM('branch_stock','interbranch','purchase') NULL,
  status ENUM('pending','reserved','partially_delivered','needs_supply','delivered','consumed','returned','rejected','cancelled') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(500) NULL, reservation_expires_at DATETIME NULL, reservation_expired_at DATETIME NULL, notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_part_requests_public_unique (public_id), KEY repair_part_requests_shop_status_idx (shop_id, branch_id, status, updated_at),
  CONSTRAINT repair_part_requests_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_requests_branch_fk FOREIGN KEY (branch_id) REFERENCES repair_branches (id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_requests_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_requests_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_requests_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL, item_code_snapshot VARCHAR(80) NOT NULL, item_title_snapshot VARCHAR(180) NOT NULL,
  requested_by_user_id BIGINT UNSIGNED NOT NULL, quantity INT UNSIGNED NOT NULL DEFAULT 1,
  priority ENUM('normal','urgent') NOT NULL DEFAULT 'normal',
  status ENUM('requested','approved','ordered','received','rejected','cancelled') NOT NULL DEFAULT 'requested',
  notes TEXT NULL, manager_notes TEXT NULL, handled_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_purchase_orders_public_unique (public_id),
  KEY repair_purchase_orders_shop_status_idx (shop_id, branch_id, status, updated_at),
  KEY repair_purchase_orders_requester_idx (requested_by_user_id, updated_at),
  CONSTRAINT repair_purchase_orders_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_orders_branch_fk FOREIGN KEY (branch_id) REFERENCES repair_branches (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_orders_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_orders_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_orders_handler_fk FOREIGN KEY (handled_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_hot_returns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL, technician_user_id BIGINT UNSIGNED NOT NULL, quantity INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('pending_return','waiting_review','settled','rejected') NOT NULL DEFAULT 'pending_return', notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_hot_returns_public_unique (public_id), KEY repair_hot_returns_shop_status_idx (shop_id, branch_id, status, updated_at), KEY repair_hot_returns_technician_idx (technician_user_id, status),
  CONSTRAINT repair_hot_returns_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_hot_returns_branch_fk FOREIGN KEY (branch_id) REFERENCES repair_branches (id) ON DELETE RESTRICT,
  CONSTRAINT repair_hot_returns_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_hot_returns_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_hot_returns_technician_fk FOREIGN KEY (technician_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_support_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  category ENUM('support','incident','sales') NOT NULL, priority ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
  subject VARCHAR(240) NOT NULL, status ENUM('open','in_progress','waiting_shop','resolved','closed') NOT NULL DEFAULT 'open',
  created_by_user_id BIGINT UNSIGNED NOT NULL, assigned_to_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_support_tickets_public_unique (public_id), KEY repair_support_tickets_scope_status_idx (shop_id, status, updated_at),
  CONSTRAINT repair_support_tickets_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_support_tickets_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_support_ticket_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ticket_id BIGINT UNSIGNED NOT NULL, author_user_id BIGINT UNSIGNED NOT NULL, body TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY repair_support_ticket_messages_idx (ticket_id, created_at),
  CONSTRAINT repair_support_ticket_messages_ticket_fk FOREIGN KEY (ticket_id) REFERENCES repair_support_tickets (id) ON DELETE RESTRICT,
  CONSTRAINT repair_support_ticket_messages_author_fk FOREIGN KEY (author_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, case_id BIGINT UNSIGNED NULL, created_by_user_id BIGINT UNSIGNED NULL, repair_shop_code VARCHAR(64) NOT NULL, branch_code VARCHAR(64) NOT NULL, receipt_id VARCHAR(80) NOT NULL,
  device_title VARCHAR(180) NOT NULL, customer_name VARCHAR(180) NOT NULL, message_text TEXT NOT NULL,
  message_kind ENUM('information','action','customer_callback') NOT NULL, priority ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
  source ENUM('customer_call','customer_visit','internal') NOT NULL DEFAULT 'internal', created_by VARCHAR(180) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY repair_case_messages_scope_receipt_idx (repair_shop_code, branch_code, receipt_id, created_at), KEY repair_case_messages_case_time_idx (case_id, created_at),
  CONSTRAINT repair_case_messages_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_messages_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_followups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id VARCHAR(80) NOT NULL, repair_shop_code VARCHAR(64) NOT NULL, branch_code VARCHAR(64) NOT NULL, message_id BIGINT UNSIGNED NOT NULL,
  assigned_to_user_id BIGINT UNSIGNED NULL, owner_role ENUM('technician','reception','repair_manager','quality_control') NOT NULL, owner_name VARCHAR(120) NOT NULL, due_label VARCHAR(120) NOT NULL, due_at DATETIME NULL, reminder_at DATETIME NULL,
  status ENUM('new','seen','in_progress','done') NOT NULL DEFAULT 'new', requires_acknowledgement TINYINT(1) NOT NULL DEFAULT 1,
  seen_at DATETIME NULL, started_at DATETIME NULL, completed_at DATETIME NULL, row_version INT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_followups_public_id_unique (public_id), UNIQUE KEY repair_followups_message_unique (message_id), KEY repair_followups_scope_status_idx (repair_shop_code, branch_code, status, due_at),
  CONSTRAINT repair_followups_message_fk FOREIGN KEY (message_id) REFERENCES repair_case_messages (id) ON DELETE RESTRICT,
  CONSTRAINT repair_followups_assignee_fk FOREIGN KEY (assigned_to_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_followup_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, followup_id BIGINT UNSIGNED NOT NULL, from_status ENUM('new','seen','in_progress','done') NULL,
  to_status ENUM('new','seen','in_progress','done') NOT NULL, actor_name VARCHAR(180) NOT NULL, occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY repair_followup_events_followup_time_idx (followup_id, occurred_at),
  CONSTRAINT repair_followup_events_followup_fk FOREIGN KEY (followup_id) REFERENCES repair_followups (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_followup_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, followup_id BIGINT UNSIGNED NOT NULL, actor_user_id BIGINT UNSIGNED NOT NULL, target_user_id BIGINT UNSIGNED NULL,
  activity_type ENUM('created','assigned','status_changed','commented','reminder_changed') NOT NULL, body TEXT NULL, metadata_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY repair_followup_activity_time_idx (followup_id, created_at),
  CONSTRAINT repair_followup_activity_followup_fk FOREIGN KEY (followup_id) REFERENCES repair_followups (id) ON DELETE RESTRICT,
  CONSTRAINT repair_followup_activity_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_followup_activity_target_fk FOREIGN KEY (target_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_backup_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1, enabled TINYINT(1) NOT NULL DEFAULT 1,
  global_interval_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30, shop_interval_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  local_hourly_retention SMALLINT UNSIGNED NOT NULL DEFAULT 48, daily_retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  weekly_retention_weeks SMALLINT UNSIGNED NOT NULL DEFAULT 12, monthly_retention_months SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  offsite_required TINYINT(1) NOT NULL DEFAULT 1, updated_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), CONSTRAINT tamiran_backup_settings_singleton CHECK (id = 1),
  CONSTRAINT tamiran_backup_settings_user_fk FOREIGN KEY (updated_by_user_id) REFERENCES tamiran_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tamiran_backup_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS tamiran_backup_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL,
  backup_type ENUM('global','shop','emergency') NOT NULL, shop_id BIGINT UNSIGNED NULL,
  trigger_source ENUM('manual','cron','before_restore','before_update') NOT NULL DEFAULT 'manual',
  status ENUM('queued','running','succeeded','failed','deleted') NOT NULL DEFAULT 'queued',
  local_status ENUM('pending','succeeded','failed','deleted') NOT NULL DEFAULT 'pending',
  offsite_status ENUM('disabled','pending','succeeded','failed') NOT NULL DEFAULT 'disabled',
  archive_name VARCHAR(240) NULL, checksum_sha256 CHAR(64) NULL, size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  record_count BIGINT UNSIGNED NOT NULL DEFAULT 0, table_counts_json JSON NOT NULL,
  encryption_format VARCHAR(40) NOT NULL DEFAULT 'tamiran-aes256gcm-v1', offsite_key VARCHAR(512) NULL,
  error_message VARCHAR(500) NULL, requested_by_user_id BIGINT UNSIGNED NULL,
  started_at DATETIME NULL, finished_at DATETIME NULL, verified_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_backup_jobs_public_unique (public_id),
  KEY tamiran_backup_jobs_status_time_idx (status, created_at), KEY tamiran_backup_jobs_shop_time_idx (shop_id, created_at),
  CONSTRAINT tamiran_backup_jobs_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE SET NULL,
  CONSTRAINT tamiran_backup_jobs_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_backup_restores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, backup_job_id BIGINT UNSIGNED NOT NULL,
  shop_id BIGINT UNSIGNED NULL, restore_type ENUM('shop','global') NOT NULL, status ENUM('previewed','running','succeeded','failed') NOT NULL,
  emergency_backup_job_id BIGINT UNSIGNED NULL, preview_counts_json JSON NOT NULL, error_message VARCHAR(500) NULL,
  requested_by_user_id BIGINT UNSIGNED NOT NULL, started_at DATETIME NULL, finished_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_backup_restores_public_unique (public_id), KEY tamiran_backup_restores_time_idx (created_at),
  CONSTRAINT tamiran_backup_restores_job_fk FOREIGN KEY (backup_job_id) REFERENCES tamiran_backup_jobs (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_backup_restores_emergency_fk FOREIGN KEY (emergency_backup_job_id) REFERENCES tamiran_backup_jobs (id) ON DELETE SET NULL,
  CONSTRAINT tamiran_backup_restores_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE SET NULL,
  CONSTRAINT tamiran_backup_restores_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tamiran 2.0 process core (clean-install only)
-- Immutable business documents are corrected by linked correction documents;
-- DELETE/UPDATE privileges for ledger and audit tables must not be granted to
-- the application database user outside the controlled procedures below.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tamiran_user_session_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL, event_type ENUM('login','logout','revoked','expired','password_changed') NOT NULL,
  session_hash CHAR(64) NULL, request_id VARCHAR(80) NOT NULL, ip_address VARCHAR(45) NOT NULL, user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_user_session_events_public_unique (public_id), KEY tamiran_user_session_events_user_time_idx (user_id, created_at),
  CONSTRAINT tamiran_user_session_events_user_fk FOREIGN KEY (user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_user_session_events_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL, action_code VARCHAR(80) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_public_id VARCHAR(80) NOT NULL,
  before_json JSON NULL, after_json JSON NULL, reason VARCHAR(1000) NULL, request_id VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45) NOT NULL, user_agent VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_audit_log_public_unique (public_id),
  KEY tamiran_audit_log_entity_idx (shop_id, entity_type, entity_public_id, created_at), KEY tamiran_audit_log_actor_idx (actor_user_id, created_at),
  CONSTRAINT tamiran_audit_log_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_audit_log_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_audit_log_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_workflows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL, case_kind ENUM('standard','warranty_return','correction','linked_after_cancel') NOT NULL DEFAULT 'standard',
  parent_case_id BIGINT UNSIGNED NULL, workflow_code ENUM('mobile_tablet','computer_laptop') NOT NULL,
  process_status ENUM('reception','awaiting_assignment','assigned','diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_pending','qc_rework','qc_conditional','finance_pending','ready_for_delivery','returned_unrepaired','delivered','cancelled','closed') NOT NULL DEFAULT 'reception',
  primary_technician_user_id BIGINT UNSIGNED NULL, preapproved_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  diagnostic_fee_policy_json JSON NOT NULL, customer_consent_json JSON NOT NULL, promised_at DATETIME NULL,
  active_work_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0, external_wait_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  wait_started_at DATETIME NULL, wait_reason ENUM('customer','part','other') NULL,
  temporary_device_secret_ciphertext TEXT NULL, temporary_secret_expires_at DATETIME NULL, temporary_secret_deleted_at DATETIME NULL,
  terminal_reason VARCHAR(1000) NULL, locked_at DATETIME NULL, lock_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_case_workflows_public_unique (public_id), UNIQUE KEY repair_case_workflows_case_unique (case_id),
  KEY repair_case_workflows_queue_idx (shop_id, branch_id, process_status, updated_at),
  CONSTRAINT repair_case_workflows_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_workflows_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_workflows_parent_fk FOREIGN KEY (parent_case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_workflows_primary_technician_fk FOREIGN KEY (primary_technician_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_stage_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, workflow_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(48) NULL, to_status VARCHAR(48) NOT NULL, actor_user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(1000) NULL, metadata_json JSON NOT NULL, idempotency_key VARCHAR(160) NOT NULL,
  started_at DATETIME NOT NULL, ended_at DATETIME NULL,
  active_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0, external_wait_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_case_stage_events_public_unique (public_id),
  UNIQUE KEY repair_case_stage_events_idempotency_unique (workflow_id, idempotency_key),
  KEY repair_case_stage_events_workflow_idx (workflow_id, created_at),
  CONSTRAINT repair_case_stage_events_workflow_fk FOREIGN KEY (workflow_id) REFERENCES repair_case_workflows (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_stage_events_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, workflow_id BIGINT UNSIGNED NOT NULL,
  technician_user_id BIGINT UNSIGNED NOT NULL, assignment_type ENUM('primary','collaborator') NOT NULL,
  task_title VARCHAR(240) NOT NULL, compensation_model ENUM('fixed','labor_percent','mixed') NOT NULL DEFAULT 'fixed',
  fixed_fee BIGINT UNSIGNED NOT NULL DEFAULT 0, labor_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  part_sale_percent DECIMAL(5,2) NOT NULL DEFAULT 0, part_percent_approved_by_user_id BIGINT UNSIGNED NULL,
  started_at DATETIME NULL, ended_at DATETIME NULL, accepted_at DATETIME NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_case_assignments_public_unique (public_id), KEY repair_case_assignments_workflow_idx (workflow_id, ended_at),
  CONSTRAINT repair_case_assignments_workflow_fk FOREIGN KEY (workflow_id) REFERENCES repair_case_workflows (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_assignments_technician_fk FOREIGN KEY (technician_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_assignments_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_assignments_part_approver_fk FOREIGN KEY (part_percent_approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_assignments_percent_check CHECK (labor_percent BETWEEN 0 AND 100 AND part_sale_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_handovers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, workflow_id BIGINT UNSIGNED NOT NULL,
  from_user_id BIGINT UNSIGNED NOT NULL, to_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('requested','accepted','manager_forced','cancelled') NOT NULL DEFAULT 'requested', reason VARCHAR(1000) NOT NULL,
  assets_json JSON NOT NULL, decided_by_user_id BIGINT UNSIGNED NULL, requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_case_handovers_public_unique (public_id), KEY repair_case_handovers_workflow_idx (workflow_id, status),
  CONSTRAINT repair_case_handovers_workflow_fk FOREIGN KEY (workflow_id) REFERENCES repair_case_workflows (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_handovers_from_fk FOREIGN KEY (from_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_handovers_to_fk FOREIGN KEY (to_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_handovers_decider_fk FOREIGN KEY (decided_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_warehouses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL DEFAULT 'انبار اصلی', is_main TINYINT(1) NOT NULL DEFAULT 1, is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_warehouses_public_unique (public_id), UNIQUE KEY repair_warehouses_one_main_per_branch (branch_id, is_main),
  UNIQUE KEY repair_warehouses_scope_id_unique (shop_id, id),
  CONSTRAINT repair_warehouses_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_branch_stock (
  shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL, warehouse_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL,
  physical_quantity INT UNSIGNED NOT NULL DEFAULT 0, reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  average_unit_cost BIGINT UNSIGNED NOT NULL DEFAULT 0, row_version INT UNSIGNED NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (warehouse_id, item_id), KEY repair_branch_stock_available_idx (shop_id, branch_id, item_id),
  CONSTRAINT repair_branch_stock_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_branch_stock_warehouse_scope_fk FOREIGN KEY (shop_id, warehouse_id) REFERENCES repair_warehouses (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_branch_stock_item_scope_fk FOREIGN KEY (shop_id, item_id) REFERENCES repair_inventory_items (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_branch_stock_reservation_check CHECK (reserved_quantity <= physical_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_inventory_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NULL,
  movement_type ENUM('receipt','reserve','release','issue','consume','return','adjustment','transfer_out','transfer_in','stocktake') NOT NULL,
  physical_delta INT NOT NULL DEFAULT 0, reserved_delta INT NOT NULL DEFAULT 0, unit_cost BIGINT UNSIGNED NOT NULL DEFAULT 0,
  balance_physical INT UNSIGNED NOT NULL, balance_reserved INT UNSIGNED NOT NULL, reference_type VARCHAR(64) NOT NULL,
  reference_public_id VARCHAR(80) NOT NULL, reason VARCHAR(1000) NOT NULL, actor_user_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_inventory_ledger_public_unique (public_id),
  KEY repair_inventory_ledger_item_time_idx (shop_id, branch_id, item_id, occurred_at), KEY repair_inventory_ledger_reference_idx (reference_type, reference_public_id),
  CONSTRAINT repair_inventory_ledger_warehouse_scope_fk FOREIGN KEY (shop_id, warehouse_id) REFERENCES repair_warehouses (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_ledger_item_scope_fk FOREIGN KEY (shop_id, item_id) REFERENCES repair_inventory_items (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_ledger_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_ledger_actor_fk FOREIGN KEY (actor_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_ledger_balance_check CHECK (balance_reserved <= balance_physical)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_inventory_cost_layers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL, source_public_id VARCHAR(80) NOT NULL,
  received_quantity INT UNSIGNED NOT NULL, remaining_quantity INT UNSIGNED NOT NULL, unit_cost BIGINT UNSIGNED NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_inventory_cost_layers_public_unique (public_id),
  KEY repair_inventory_cost_layers_fifo_idx (shop_id,warehouse_id,item_id,received_at,id),
  CONSTRAINT repair_inventory_cost_layers_warehouse_scope_fk FOREIGN KEY (shop_id,warehouse_id) REFERENCES repair_warehouses (shop_id,id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_cost_layers_item_scope_fk FOREIGN KEY (shop_id,item_id) REFERENCES repair_inventory_items (shop_id,id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_cost_layers_quantity_check CHECK (remaining_quantity <= received_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_part_issues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  part_request_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL,
  technician_user_id BIGINT UNSIGNED NOT NULL, quantity INT UNSIGNED NOT NULL,
  status ENUM('awaiting_technician','delivered','consumed','returned') NOT NULL DEFAULT 'awaiting_technician',
  issued_by_user_id BIGINT UNSIGNED NOT NULL, idempotency_key VARCHAR(160) NOT NULL, technician_confirmed_at DATETIME NULL, finalized_at DATETIME NULL, notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_part_issues_public_unique (public_id), UNIQUE KEY repair_part_issues_idempotency_unique(shop_id,idempotency_key), KEY repair_part_issues_case_status_idx (case_id, status),
  CONSTRAINT repair_part_issues_request_fk FOREIGN KEY (part_request_id) REFERENCES repair_part_requests (id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_issues_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_issues_item_scope_fk FOREIGN KEY (shop_id, item_id) REFERENCES repair_inventory_items (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_issues_technician_fk FOREIGN KEY (technician_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_part_issues_issuer_fk FOREIGN KEY (issued_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_hot_return_evidence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, hot_return_id BIGINT UNSIGNED NOT NULL,
  serial_number VARCHAR(190) NULL, condition_code ENUM('healthy','damaged','unknown') NOT NULL,
  image_file_id BIGINT UNSIGNED NULL, notes TEXT NULL, submitted_by_user_id BIGINT UNSIGNED NOT NULL,
  reviewed_by_user_id BIGINT UNSIGNED NULL, rejection_reason VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY repair_hot_return_evidence_return_idx (hot_return_id, created_at),
  CONSTRAINT repair_hot_return_evidence_return_fk FOREIGN KEY (hot_return_id) REFERENCES repair_hot_returns (id) ON DELETE RESTRICT,
  CONSTRAINT repair_hot_return_evidence_submitter_fk FOREIGN KEY (submitted_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_hot_return_evidence_reviewer_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_stocktakes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL, status ENUM('draft','counting','awaiting_manager','approved','cancelled') NOT NULL DEFAULT 'draft',
  snapshot_at DATETIME NULL, created_by_user_id BIGINT UNSIGNED NOT NULL, approved_by_user_id BIGINT UNSIGNED NULL,
  reason VARCHAR(1000) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, approved_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_stocktakes_public_unique (public_id), KEY repair_stocktakes_scope_status_idx (shop_id, branch_id, status),
  CONSTRAINT repair_stocktakes_warehouse_scope_fk FOREIGN KEY (shop_id, warehouse_id) REFERENCES repair_warehouses (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_stocktakes_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stocktakes_approver_fk FOREIGN KEY (approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_stocktake_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, stocktake_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL,
  snapshot_quantity INT UNSIGNED NOT NULL, counted_quantity INT UNSIGNED NULL, locked_by_user_id BIGINT UNSIGNED NULL,
  locked_until DATETIME NULL, counted_by_user_id BIGINT UNSIGNED NULL, counted_at DATETIME NULL, notes TEXT NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_stocktake_items_unique (stocktake_id, item_id),
  CONSTRAINT repair_stocktake_items_stocktake_fk FOREIGN KEY (stocktake_id) REFERENCES repair_stocktakes (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stocktake_items_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stocktake_items_locker_fk FOREIGN KEY (locked_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stocktake_items_counter_fk FOREIGN KEY (counted_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_inventory_adjustments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL, stocktake_id BIGINT UNSIGNED NULL,
  quantity_delta INT NOT NULL, reason VARCHAR(1000) NOT NULL, status ENUM('awaiting_manager','approved','rejected') NOT NULL DEFAULT 'awaiting_manager',
  created_by_user_id BIGINT UNSIGNED NOT NULL, approved_by_user_id BIGINT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_inventory_adjustments_public_unique (public_id), KEY repair_inventory_adjustments_status_idx (shop_id, branch_id, status),
  CONSTRAINT repair_inventory_adjustments_warehouse_scope_fk FOREIGN KEY (shop_id, warehouse_id) REFERENCES repair_warehouses (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_adjustments_item_scope_fk FOREIGN KEY (shop_id, item_id) REFERENCES repair_inventory_items (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_adjustments_stocktake_fk FOREIGN KEY (stocktake_id) REFERENCES repair_stocktakes (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_adjustments_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_adjustments_approver_fk FOREIGN KEY (approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_inventory_adjustments_nonzero_check CHECK (quantity_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_stock_transfers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  from_branch_id BIGINT UNSIGNED NOT NULL, to_branch_id BIGINT UNSIGNED NOT NULL,
  status ENUM('requested','approved','sent','received','rejected','cancelled') NOT NULL DEFAULT 'requested',
  requested_by_user_id BIGINT UNSIGNED NOT NULL, approved_by_user_id BIGINT UNSIGNED NULL, sent_by_user_id BIGINT UNSIGNED NULL, received_by_user_id BIGINT UNSIGNED NULL,
  reason VARCHAR(1000) NOT NULL, requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, approved_at DATETIME NULL, sent_at DATETIME NULL, received_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_stock_transfers_public_unique (public_id), KEY repair_stock_transfers_status_idx (shop_id, status, requested_at),
  CONSTRAINT repair_stock_transfers_from_scope_fk FOREIGN KEY (shop_id, from_branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfers_to_scope_fk FOREIGN KEY (shop_id, to_branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfers_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfers_approver_fk FOREIGN KEY (approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfers_sender_fk FOREIGN KEY (sent_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfers_receiver_fk FOREIGN KEY (received_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfers_distinct_branch_check CHECK (from_branch_id <> to_branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_stock_transfer_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, transfer_id BIGINT UNSIGNED NOT NULL, item_id BIGINT UNSIGNED NOT NULL,
  requested_quantity INT UNSIGNED NOT NULL, sent_quantity INT UNSIGNED NOT NULL DEFAULT 0, received_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL, PRIMARY KEY (id), UNIQUE KEY repair_stock_transfer_items_unique (transfer_id, item_id),
  CONSTRAINT repair_stock_transfer_items_transfer_fk FOREIGN KEY (transfer_id) REFERENCES repair_stock_transfers (id) ON DELETE RESTRICT,
  CONSTRAINT repair_stock_transfer_items_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL, mobile VARCHAR(20) NULL, phone VARCHAR(20) NULL, national_id VARCHAR(20) NULL,
  address VARCHAR(1000) NULL, notes TEXT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_suppliers_public_unique (public_id), UNIQUE KEY repair_suppliers_scope_name_unique (shop_id, name), UNIQUE KEY repair_suppliers_scope_id_unique (shop_id, id),
  CONSTRAINT repair_suppliers_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_purchase_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, document_number VARCHAR(64) NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL, supplier_id BIGINT UNSIGNED NOT NULL,
  status ENUM('draft','awaiting_approval','approved','ordered','partially_received','received','rejected','cancelled') NOT NULL DEFAULT 'draft',
  order_date DATE NULL, expected_at DATETIME NULL, subtotal_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, total_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  supplier_invoice_number VARCHAR(120) NULL, invoice_file_id BIGINT UNSIGNED NULL,
  origin_reason VARCHAR(1000) NOT NULL, manager_notes TEXT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  approved_by_user_id BIGINT UNSIGNED NULL, ordered_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_purchase_documents_public_unique (public_id), UNIQUE KEY repair_purchase_documents_number_unique (shop_id, document_number),
  KEY repair_purchase_documents_status_idx (shop_id, branch_id, status, expected_at),
  CONSTRAINT repair_purchase_documents_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_documents_supplier_scope_fk FOREIGN KEY (shop_id, supplier_id) REFERENCES repair_suppliers (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_documents_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_documents_approver_fk FOREIGN KEY (approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_documents_orderer_fk FOREIGN KEY (ordered_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_purchase_document_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, purchase_document_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL, quantity INT UNSIGNED NOT NULL, received_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  defective_quantity INT UNSIGNED NOT NULL DEFAULT 0, unit_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, line_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL, PRIMARY KEY (id), UNIQUE KEY repair_purchase_document_items_public_unique (public_id),
  UNIQUE KEY repair_purchase_document_items_unique (purchase_document_id, item_id),
  CONSTRAINT repair_purchase_document_items_document_fk FOREIGN KEY (purchase_document_id) REFERENCES repair_purchase_documents (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_document_items_item_fk FOREIGN KEY (item_id) REFERENCES repair_inventory_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_document_items_received_check CHECK (received_quantity + defective_quantity <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_purchase_request_links (
  purchase_item_id BIGINT UNSIGNED NOT NULL, part_request_id BIGINT UNSIGNED NOT NULL, allocated_quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (purchase_item_id, part_request_id),
  CONSTRAINT repair_purchase_request_links_item_fk FOREIGN KEY (purchase_item_id) REFERENCES repair_purchase_document_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_request_links_request_fk FOREIGN KEY (part_request_id) REFERENCES repair_part_requests (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_purchase_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, purchase_document_id BIGINT UNSIGNED NOT NULL,
  received_by_user_id BIGINT UNSIGNED NOT NULL, delivery_reference VARCHAR(160) NULL, notes TEXT NULL, received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_purchase_receipts_public_unique (public_id), KEY repair_purchase_receipts_document_idx (purchase_document_id, received_at),
  CONSTRAINT repair_purchase_receipts_document_fk FOREIGN KEY (purchase_document_id) REFERENCES repair_purchase_documents (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_receipts_receiver_fk FOREIGN KEY (received_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_purchase_receipt_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, receipt_id BIGINT UNSIGNED NOT NULL, purchase_item_id BIGINT UNSIGNED NOT NULL,
  accepted_quantity INT UNSIGNED NOT NULL DEFAULT 0, defective_quantity INT UNSIGNED NOT NULL DEFAULT 0, extra_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost BIGINT UNSIGNED NOT NULL, notes TEXT NULL, PRIMARY KEY (id), UNIQUE KEY repair_purchase_receipt_items_unique (receipt_id, purchase_item_id),
  CONSTRAINT repair_purchase_receipt_items_receipt_fk FOREIGN KEY (receipt_id) REFERENCES repair_purchase_receipts (id) ON DELETE RESTRICT,
  CONSTRAINT repair_purchase_receipt_items_purchase_item_fk FOREIGN KEY (purchase_item_id) REFERENCES repair_purchase_document_items (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_estimates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  estimate_number VARCHAR(64) NOT NULL, status ENUM('draft','sent','approved','rejected','explanation_requested','expired','superseded') NOT NULL DEFAULT 'draft',
  diagnostic_fee BIGINT UNSIGNED NOT NULL DEFAULT 0, subtotal_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, total_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  valid_until DATETIME NULL, customer_note TEXT NULL, internal_note TEXT NULL, revision SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_by_user_id BIGINT UNSIGNED NOT NULL, sent_at DATETIME NULL, decided_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_estimates_public_unique (public_id), UNIQUE KEY repair_estimates_number_unique (shop_id, estimate_number),
  KEY repair_estimates_case_idx (case_id, revision),
  CONSTRAINT repair_estimates_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_estimates_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_estimate_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, estimate_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('part','labor','diagnostic','other') NOT NULL, reference_id BIGINT UNSIGNED NULL,
  title VARCHAR(240) NOT NULL, quantity DECIMAL(10,2) NOT NULL DEFAULT 1, unit_price BIGINT UNSIGNED NOT NULL,
  discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, line_total BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id), KEY repair_estimate_items_estimate_idx (estimate_id, id),
  CONSTRAINT repair_estimate_items_estimate_fk FOREIGN KEY (estimate_id) REFERENCES repair_estimates (id) ON DELETE RESTRICT,
  CONSTRAINT repair_estimate_items_values_check CHECK (quantity > 0 AND tax_rate BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_estimate_approvals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, estimate_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('approved','rejected','explanation_requested') NOT NULL,
  channel ENUM('recorded_phone','sms_otp','in_person_signature','secure_portal') NOT NULL,
  customer_mobile VARCHAR(20) NOT NULL, otp_request_id VARCHAR(80) NULL, signature_file_id BIGINT UNSIGNED NULL,
  recorded_by_user_id BIGINT UNSIGNED NULL, decision_reason VARCHAR(1000) NULL, evidence_json JSON NOT NULL,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_estimate_approvals_public_unique (public_id), KEY repair_estimate_approvals_estimate_idx (estimate_id, decided_at),
  CONSTRAINT repair_estimate_approvals_estimate_fk FOREIGN KEY (estimate_id) REFERENCES repair_estimates (id) ON DELETE RESTRICT,
  CONSTRAINT repair_estimate_approvals_recorder_fk FOREIGN KEY (recorded_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_qc_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  workflow_code ENUM('mobile_tablet','computer_laptop') NOT NULL, title VARCHAR(180) NOT NULL,
  source ENUM('tamiran_standard','shop_extension') NOT NULL DEFAULT 'tamiran_standard', is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_qc_templates_public_unique (public_id), KEY repair_qc_templates_scope_idx (shop_id, workflow_code, is_active),
  CONSTRAINT repair_qc_templates_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT repair_qc_templates_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_qc_template_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, template_id BIGINT UNSIGNED NOT NULL, code VARCHAR(80) NOT NULL,
  title VARCHAR(240) NOT NULL, input_type ENUM('pass_fail','text','number','photo') NOT NULL DEFAULT 'pass_fail',
  is_required TINYINT(1) NOT NULL DEFAULT 1, requires_evidence_on_fail TINYINT(1) NOT NULL DEFAULT 1, sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id), UNIQUE KEY repair_qc_template_items_unique (template_id, code),
  CONSTRAINT repair_qc_template_items_template_fk FOREIGN KEY (template_id) REFERENCES repair_qc_templates (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_manual_parts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(240) NOT NULL, quantity DECIMAL(12,3) NOT NULL,
  purchase_unit_cost BIGINT UNSIGNED NOT NULL DEFAULT 0, sale_unit_price BIGINT UNSIGNED NOT NULL,
  note VARCHAR(1000) NULL, idempotency_key VARCHAR(160) NOT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), UNIQUE KEY repair_case_manual_parts_public_unique(public_id), UNIQUE KEY repair_case_manual_parts_idempotency_unique(shop_id,idempotency_key),
  KEY repair_case_manual_parts_case_idx(case_id,id),
  CONSTRAINT repair_case_manual_parts_case_scope_fk FOREIGN KEY(shop_id,case_id) REFERENCES repair_cases(shop_id,id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_manual_parts_actor_fk FOREIGN KEY(created_by_user_id) REFERENCES tamiran_users(id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_manual_parts_quantity_check CHECK(quantity>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_qc_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED NOT NULL, performed_by_user_id BIGINT UNSIGNED NOT NULL, repaired_by_user_id BIGINT UNSIGNED NULL,
  result ENUM('passed','failed','conditional') NOT NULL, failure_reason VARCHAR(1000) NULL, conditional_limitations VARCHAR(1000) NULL,
  manager_override TINYINT(1) NOT NULL DEFAULT 0, override_reason VARCHAR(1000) NULL,
  customer_acknowledged_at DATETIME NULL, customer_ack_channel VARCHAR(64) NULL, rework_number SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(160) NOT NULL, completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_qc_runs_public_unique (public_id), UNIQUE KEY repair_qc_runs_idempotency_unique(case_id,idempotency_key), KEY repair_qc_runs_case_idx (case_id, completed_at),
  CONSTRAINT repair_qc_runs_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_qc_runs_template_fk FOREIGN KEY (template_id) REFERENCES repair_qc_templates (id) ON DELETE RESTRICT,
  CONSTRAINT repair_qc_runs_performer_fk FOREIGN KEY (performed_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_qc_runs_repairer_fk FOREIGN KEY (repaired_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_qc_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, qc_run_id BIGINT UNSIGNED NOT NULL, template_item_id BIGINT UNSIGNED NULL,
  custom_title VARCHAR(240) NULL, result ENUM('passed','failed','not_applicable','not_tested') NOT NULL, value_text TEXT NULL, evidence_file_id BIGINT UNSIGNED NULL, notes TEXT NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_qc_results_unique (qc_run_id, template_item_id),
  CONSTRAINT repair_qc_results_run_fk FOREIGN KEY (qc_run_id) REFERENCES repair_qc_runs (id) ON DELETE RESTRICT,
  CONSTRAINT repair_qc_results_template_item_fk FOREIGN KEY (template_item_id) REFERENCES repair_qc_template_items (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_number VARCHAR(64) NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  status ENUM('draft','issued','partially_paid','paid','corrected','voided') NOT NULL DEFAULT 'draft',
  subtotal_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, total_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  paid_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, refunded_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  issued_by_user_id BIGINT UNSIGNED NOT NULL, idempotency_key VARCHAR(160) NOT NULL, issued_at DATETIME NULL, locked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_invoices_public_unique (public_id), UNIQUE KEY repair_invoices_number_unique (shop_id, invoice_number), UNIQUE KEY repair_invoices_idempotency_unique(shop_id,idempotency_key),
  UNIQUE KEY repair_invoices_active_case_unique (case_id), KEY repair_invoices_balance_idx (shop_id, status, updated_at),
  CONSTRAINT repair_invoices_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_invoices_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_invoices_issuer_fk FOREIGN KEY (issued_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_invoices_amount_check CHECK (discount_amount <= subtotal_amount AND paid_amount >= refunded_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('part','labor','diagnostic','other','correction') NOT NULL, reference_id BIGINT UNSIGNED NULL,
  title VARCHAR(240) NOT NULL, quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  purchase_unit_cost BIGINT UNSIGNED NOT NULL DEFAULT 0, sale_unit_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
  discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0, line_total BIGINT NOT NULL,
  warranty_days SMALLINT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_invoice_items_public_unique (public_id), KEY repair_invoice_items_invoice_idx (invoice_id, id),
  CONSTRAINT repair_invoice_items_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_invoice_items_value_check CHECK (quantity > 0 AND tax_rate BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_id BIGINT UNSIGNED NOT NULL,
  amount BIGINT UNSIGNED NOT NULL, method ENUM('cash','card','bank_transfer','online','credit') NOT NULL,
  tracking_number VARCHAR(160) NULL, paid_by_name VARCHAR(180) NULL, received_by_user_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL, paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, notes TEXT NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_payments_public_unique (public_id), UNIQUE KEY repair_payments_idempotency_unique (invoice_id, idempotency_key),
  KEY repair_payments_invoice_idx (invoice_id, paid_at),
  CONSTRAINT repair_payments_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_payments_receiver_fk FOREIGN KEY (received_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_payments_positive_check CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_refunds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_id BIGINT UNSIGNED NOT NULL, payment_id BIGINT UNSIGNED NULL,
  amount BIGINT UNSIGNED NOT NULL, method ENUM('cash','card','bank_transfer','online','credit') NOT NULL,
  tracking_number VARCHAR(160) NULL, reason VARCHAR(1000) NOT NULL, processed_by_user_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL, refunded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_refunds_public_unique (public_id), UNIQUE KEY repair_refunds_idempotency_unique (invoice_id, idempotency_key),
  CONSTRAINT repair_refunds_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_refunds_payment_fk FOREIGN KEY (payment_id) REFERENCES repair_payments (id) ON DELETE RESTRICT,
  CONSTRAINT repair_refunds_processor_fk FOREIGN KEY (processed_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_refunds_positive_check CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_receivables (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  original_amount BIGINT UNSIGNED NOT NULL, outstanding_amount BIGINT UNSIGNED NOT NULL, due_at DATETIME NOT NULL,
  customer_commitment_text TEXT NOT NULL, customer_evidence_json JSON NOT NULL,
  status ENUM('open','partially_paid','settled','overdue','written_off') NOT NULL DEFAULT 'open',
  approved_by_manager_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, settled_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_receivables_public_unique (public_id), UNIQUE KEY repair_receivables_open_invoice_unique (invoice_id, status),
  KEY repair_receivables_due_idx (status, due_at),
  CONSTRAINT repair_receivables_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_receivables_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_receivables_approver_fk FOREIGN KEY (approved_by_manager_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_receivables_amount_check CHECK (outstanding_amount <= original_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_financial_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL,
  shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL, invoice_id BIGINT UNSIGNED NULL,
  event_type ENUM('invoice_issued','payment_received','refund_issued','discount_applied','part_cost_posted','technician_commission_accrued','receivable_opened','payment_reversed','adjustment') NOT NULL,
  customer_balance_delta BIGINT NOT NULL DEFAULT 0, cash_delta BIGINT NOT NULL DEFAULT 0, direct_cost_delta BIGINT NOT NULL DEFAULT 0,
  reference_type VARCHAR(80) NOT NULL, reference_public_id VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL, metadata_json JSON NOT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_financial_ledger_public_unique (public_id),
  UNIQUE KEY repair_financial_ledger_idempotency_unique (shop_id, idempotency_key),
  KEY repair_financial_ledger_case_time_idx (shop_id, case_id, occurred_at),
  KEY repair_financial_ledger_customer_time_idx (shop_id, customer_id, occurred_at),
  CONSTRAINT repair_financial_ledger_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_ledger_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_ledger_customer_scope_fk FOREIGN KEY (shop_id, customer_id) REFERENCES repair_customers (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_ledger_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_ledger_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_financial_corrections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, invoice_id BIGINT UNSIGNED NOT NULL,
  correction_number VARCHAR(64) NOT NULL, amount_delta BIGINT NOT NULL, reason VARCHAR(1000) NOT NULL,
  details_json JSON NOT NULL, created_by_user_id BIGINT UNSIGNED NOT NULL, approved_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_financial_corrections_public_unique (public_id), UNIQUE KEY repair_financial_corrections_number_unique (correction_number),
  CONSTRAINT repair_financial_corrections_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_corrections_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_corrections_approver_fk FOREIGN KEY (approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_financial_corrections_nonzero_check CHECK (amount_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_technician_compensations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  technician_user_id BIGINT UNSIGNED NOT NULL, source_type ENUM('labor','part_sale','warranty_rework') NOT NULL,
  basis_amount BIGINT UNSIGNED NOT NULL, rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0, fixed_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  calculated_amount BIGINT UNSIGNED NOT NULL, policy_snapshot_json JSON NOT NULL, approved_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_technician_compensations_public_unique (public_id), KEY repair_technician_compensations_case_idx (case_id, technician_user_id),
  CONSTRAINT repair_technician_compensations_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_technician_compensations_technician_fk FOREIGN KEY (technician_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_technician_compensations_approver_fk FOREIGN KEY (approved_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_technician_compensations_rate_check CHECK (rate_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NOT NULL, recipient_type ENUM('customer','representative') NOT NULL,
  recipient_full_name VARCHAR(180) NOT NULL, recipient_national_code VARCHAR(20) NULL, recipient_mobile VARCHAR(20) NOT NULL,
  verification_method ENUM('digital_signature','identity_document','sms_otp','receipt_qr','manager_emergency') NOT NULL,
  verification_json JSON NOT NULL, customer_otp_request_id VARCHAR(80) NULL,
  accessories_confirmed_json JSON NOT NULL, warnings_acknowledged_json JSON NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL, delivered_by_user_id BIGINT UNSIGNED NOT NULL, delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_deliveries_public_unique (public_id), UNIQUE KEY repair_deliveries_case_unique (case_id), UNIQUE KEY repair_deliveries_idempotency_unique(shop_id,idempotency_key),
  CONSTRAINT repair_deliveries_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_deliveries_invoice_fk FOREIGN KEY (invoice_id) REFERENCES repair_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT repair_deliveries_deliverer_fk FOREIGN KEY (delivered_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_warranties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, delivery_id BIGINT UNSIGNED NOT NULL,
  invoice_item_id BIGINT UNSIGNED NOT NULL, starts_at DATETIME NOT NULL, expires_at DATETIME NOT NULL,
  conditions_text TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_warranties_public_unique (public_id), UNIQUE KEY repair_warranties_delivery_item_unique (delivery_id, invoice_item_id),
  KEY repair_warranties_expiry_idx (expires_at),
  CONSTRAINT repair_warranties_delivery_fk FOREIGN KEY (delivery_id) REFERENCES repair_deliveries (id) ON DELETE RESTRICT,
  CONSTRAINT repair_warranties_invoice_item_fk FOREIGN KEY (invoice_item_id) REFERENCES repair_invoice_items (id) ON DELETE RESTRICT,
  CONSTRAINT repair_warranties_date_check CHECK (expires_at >= starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_warranty_assessments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, warranty_case_id BIGINT UNSIGNED NOT NULL, original_case_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('warranty','non_warranty','needs_review') NOT NULL, cause_code VARCHAR(80) NULL, notes TEXT NULL,
  rework_cost BIGINT UNSIGNED NOT NULL DEFAULT 0, technician_fee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  decided_by_user_id BIGINT UNSIGNED NOT NULL, decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_warranty_assessments_public_unique (public_id), UNIQUE KEY repair_warranty_assessments_case_unique (warranty_case_id),
  CONSTRAINT repair_warranty_assessments_case_fk FOREIGN KEY (warranty_case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_warranty_assessments_original_fk FOREIGN KEY (original_case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_warranty_assessments_decider_fk FOREIGN KEY (decided_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_case_corrections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  field_code VARCHAR(80) NOT NULL, before_value_json JSON NOT NULL, after_value_json JSON NOT NULL,
  reason VARCHAR(1000) NOT NULL, status ENUM('requested','approved','rejected') NOT NULL DEFAULT 'requested',
  requested_by_user_id BIGINT UNSIGNED NOT NULL, decided_by_user_id BIGINT UNSIGNED NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_case_corrections_public_unique (public_id), KEY repair_case_corrections_case_idx (case_id, status),
  CONSTRAINT repair_case_corrections_case_fk FOREIGN KEY (case_id) REFERENCES repair_cases (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_corrections_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_case_corrections_decider_fk FOREIGN KEY (decided_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_private_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NULL,
  case_id BIGINT UNSIGNED NULL, storage_driver ENUM('private_host','s3_compatible') NOT NULL DEFAULT 'private_host',
  storage_key VARCHAR(512) NOT NULL, original_name VARCHAR(240) NOT NULL, mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL, sha256 CHAR(64) NOT NULL, purpose ENUM('reception','qc','hot_return','purchase','signature','identity','other') NOT NULL,
  is_customer_visible TINYINT(1) NOT NULL DEFAULT 0, uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_private_files_public_unique (public_id), UNIQUE KEY tamiran_private_files_storage_unique (storage_driver, storage_key),
  KEY tamiran_private_files_case_idx (shop_id, case_id, created_at),
  CONSTRAINT tamiran_private_files_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_private_files_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_private_files_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_private_files_uploader_fk FOREIGN KEY (uploaded_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_portal_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL, expires_at DATETIME NOT NULL, revoked_at DATETIME NULL, last_viewed_at DATETIME NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_portal_tokens_public_unique (public_id), UNIQUE KEY repair_portal_tokens_hash_unique (token_hash),
  KEY repair_portal_tokens_case_idx (case_id, expires_at),
  CONSTRAINT repair_portal_tokens_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_portal_tokens_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_portal_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, portal_token_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('viewed','estimate_approved','estimate_rejected','explanation_requested','conditional_qc_accepted','message_sent') NOT NULL,
  subject_public_id VARCHAR(80) NULL, otp_request_id VARCHAR(80) NULL, payload_json JSON NOT NULL,
  ip_address VARCHAR(45) NOT NULL, user_agent VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY repair_portal_actions_public_unique (public_id), KEY repair_portal_actions_token_idx (portal_token_id, created_at),
  CONSTRAINT repair_portal_actions_token_fk FOREIGN KEY (portal_token_id) REFERENCES repair_portal_tokens (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repair_portal_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, case_id BIGINT UNSIGNED NOT NULL,
  direction ENUM('customer_to_shop','shop_to_customer') NOT NULL, body TEXT NOT NULL,
  status ENUM('new','assigned','answered','closed') NOT NULL DEFAULT 'new', assigned_to_user_id BIGINT UNSIGNED NULL,
  created_by_user_id BIGINT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, answered_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY repair_portal_messages_public_unique (public_id), KEY repair_portal_messages_queue_idx (shop_id, status, created_at),
  CONSTRAINT repair_portal_messages_case_scope_fk FOREIGN KEY (shop_id, case_id) REFERENCES repair_cases (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT repair_portal_messages_assignee_fk FOREIGN KEY (assigned_to_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT,
  CONSTRAINT repair_portal_messages_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL, branch_id BIGINT UNSIGNED NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL, event_code VARCHAR(80) NOT NULL, title VARCHAR(240) NOT NULL, body TEXT NOT NULL,
  entity_type VARCHAR(80) NULL, entity_public_id VARCHAR(80) NULL, priority ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
  read_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_notifications_public_unique (public_id), KEY tamiran_notifications_user_idx (recipient_user_id, read_at, created_at),
  CONSTRAINT tamiran_notifications_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_notifications_branch_scope_fk FOREIGN KEY (shop_id, branch_id) REFERENCES repair_branches (shop_id, id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_notifications_recipient_fk FOREIGN KEY (recipient_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_sms_providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  provider_code ENUM('kavenegar','generic_rest') NOT NULL, display_name VARCHAR(180) NOT NULL,
  credentials_ciphertext TEXT NOT NULL, settings_json JSON NOT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id BIGINT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_sms_providers_public_unique (public_id), UNIQUE KEY tamiran_sms_providers_scope_unique (shop_id, provider_code),
  CONSTRAINT tamiran_sms_providers_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_sms_providers_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_sms_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  event_code VARCHAR(80) NOT NULL, title VARCHAR(180) NOT NULL, body_template VARCHAR(1800) NOT NULL,
  lookup_template VARCHAR(120) NULL, is_enabled TINYINT(1) NOT NULL DEFAULT 1, updated_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_sms_templates_public_unique (public_id), UNIQUE KEY tamiran_sms_templates_scope_event_unique (shop_id, event_code),
  CONSTRAINT tamiran_sms_templates_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_sms_templates_updater_fk FOREIGN KEY (updated_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_sms_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL, event_code VARCHAR(80) NOT NULL, recipient_mobile VARCHAR(20) NOT NULL,
  body VARCHAR(1800) NOT NULL, status ENUM('queued','processing','sent','delivered','failed','cancelled') NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(160) NULL, attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0, max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_error VARCHAR(1000) NULL,
  idempotency_key VARCHAR(160) NOT NULL, related_type VARCHAR(80) NULL, related_public_id VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at DATETIME NULL, delivered_at DATETIME NULL,
  PRIMARY KEY (id), UNIQUE KEY tamiran_sms_messages_public_unique (public_id), UNIQUE KEY tamiran_sms_messages_idempotency_unique (shop_id, idempotency_key),
  KEY tamiran_sms_messages_queue_idx (status, next_attempt_at),
  CONSTRAINT tamiran_sms_messages_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT,
  CONSTRAINT tamiran_sms_messages_provider_fk FOREIGN KEY (provider_id) REFERENCES tamiran_sms_providers (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_sms_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, shop_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('estimate','delivery','representative_delivery','portal_action','portal_access','mobile_change') NOT NULL,
  subject_public_id VARCHAR(80) NOT NULL, mobile VARCHAR(20) NOT NULL, code_hash CHAR(64) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0, max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL, verified_at DATETIME NULL, consumed_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_sms_otps_public_unique (public_id), KEY tamiran_sms_otps_lookup_idx (shop_id, purpose, subject_public_id, mobile, expires_at),
  CONSTRAINT tamiran_sms_otps_shop_fk FOREIGN KEY (shop_id) REFERENCES repair_shops (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tamiran_release_gate_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, public_id CHAR(26) NOT NULL, release_version VARCHAR(40) NOT NULL,
  gate_code VARCHAR(80) NOT NULL, environment ENUM('automated','staging','sadratel_pilot') NOT NULL,
  status ENUM('pending','passed','failed','blocked') NOT NULL DEFAULT 'pending', evidence_json JSON NOT NULL,
  executed_by_user_id BIGINT UNSIGNED NULL, executed_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY tamiran_release_gate_results_public_unique (public_id), UNIQUE KEY tamiran_release_gate_results_unique (release_version, gate_code, environment),
  CONSTRAINT tamiran_release_gate_results_executor_fk FOREIGN KEY (executed_by_user_id) REFERENCES tamiran_users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP TRIGGER IF EXISTS tamiran_audit_log_no_update$$
DROP TRIGGER IF EXISTS tamiran_audit_log_no_delete$$
DROP TRIGGER IF EXISTS repair_inventory_ledger_no_update$$
DROP TRIGGER IF EXISTS repair_inventory_ledger_no_delete$$
DROP TRIGGER IF EXISTS repair_financial_ledger_no_update$$
DROP TRIGGER IF EXISTS repair_financial_ledger_no_delete$$
CREATE TRIGGER tamiran_audit_log_no_update BEFORE UPDATE ON tamiran_audit_log
FOR EACH ROW BEGIN IF COALESCE(@tamiran_restore_mode,0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit log is immutable'; END IF; END$$
CREATE TRIGGER tamiran_audit_log_no_delete BEFORE DELETE ON tamiran_audit_log
FOR EACH ROW BEGIN IF COALESCE(@tamiran_restore_mode,0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit log is immutable'; END IF; END$$
CREATE TRIGGER repair_inventory_ledger_no_update BEFORE UPDATE ON repair_inventory_ledger
FOR EACH ROW BEGIN IF COALESCE(@tamiran_restore_mode,0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inventory ledger is immutable'; END IF; END$$
CREATE TRIGGER repair_inventory_ledger_no_delete BEFORE DELETE ON repair_inventory_ledger
FOR EACH ROW BEGIN IF COALESCE(@tamiran_restore_mode,0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inventory ledger is immutable'; END IF; END$$
CREATE TRIGGER repair_financial_ledger_no_update BEFORE UPDATE ON repair_financial_ledger
FOR EACH ROW BEGIN IF COALESCE(@tamiran_restore_mode,0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Financial ledger is immutable'; END IF; END$$
CREATE TRIGGER repair_financial_ledger_no_delete BEFORE DELETE ON repair_financial_ledger
FOR EACH ROW BEGIN IF COALESCE(@tamiran_restore_mode,0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Financial ledger is immutable'; END IF; END$$
DELIMITER ;

INSERT INTO tamiran_plan_entitlements(plan_code,capability_code,is_allowed,limits_json) VALUES
('light','core.repair',1,'{}'),('light','core.finance',1,'{}'),('light','core.portal',1,'{}'),('light','platform.sms_otp',1,'{}'),('light','module.inventory.simple',1,'{}'),('light','module.qc.simple',1,'{}'),
('professional','core.repair',1,'{}'),('professional','core.finance',1,'{}'),('professional','core.portal',1,'{}'),('professional','platform.sms_otp',1,'{}'),('professional','module.inventory.simple',1,'{}'),('professional','module.inventory.pro',1,'{}'),('professional','module.qc.simple',1,'{}'),('professional','module.qc.independent',1,'{}'),('professional','module.procurement',1,'{}'),('professional','module.hot_return',1,'{}'),('professional','pro.assignment',1,'{}'),('professional','pro.commission',1,'{}'),('professional','pro.sla',1,'{}'),
('business','core.repair',1,'{}'),('business','core.finance',1,'{}'),('business','core.portal',1,'{}'),('business','platform.sms_otp',1,'{}'),('business','module.inventory.simple',1,'{}'),('business','module.inventory.pro',1,'{}'),('business','module.qc.simple',1,'{}'),('business','module.qc.independent',1,'{}'),('business','module.procurement',1,'{}'),('business','module.hot_return',1,'{}'),('business','module.multi_branch',1,'{}'),('business','pro.assignment',1,'{}'),('business','pro.commission',1,'{}'),('business','pro.sla',1,'{}')
ON DUPLICATE KEY UPDATE is_allowed=VALUES(is_allowed),limits_json=VALUES(limits_json),updated_at=NOW();
