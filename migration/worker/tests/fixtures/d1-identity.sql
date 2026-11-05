-- LOCAL TEST ONLY. Never applied by hosting or included in schema migrations.
-- Fixture family TEST-TAMIRAN-1010A; no telephone destination or usable password.
INSERT INTO repair_shops(id,public_id,shop_code,public_shop_code,name,repair_type,workflow_settings_json,tax_settings_json,feature_flags_json,modules_json,license_started_at,license_expires_at)
VALUES (1,'TEST-TAMIRAN-1010A-SHOPA','TEST-TAMIRAN-1010A-SHOPA','T1010A','آزمایشی — تعمیرگاه الف','mobile_tablet','{}','{}','{}','["repair"]','2026-10-10','2027-10-10'),
(2,'TEST-TAMIRAN-1010A-SHOPB','TEST-TAMIRAN-1010A-SHOPB','T1010B','آزمایشی — تعمیرگاه ب','mobile_tablet','{}','{}','{}','["repair"]','2026-10-10','2027-10-10');
INSERT INTO repair_branches(id,shop_id,branch_code,name,business_hours_json) VALUES
(1,1,'TEST-TAMIRAN-1010A-BA','آزمایشی — شعبه الف','{}'),
(2,2,'TEST-TAMIRAN-1010A-BB','آزمایشی — شعبه ب','{}'),
(3,1,'TEST-TAMIRAN-1010A-BA2','آزمایشی — شعبه دوم الف','{}');
INSERT INTO tamiran_users(id,shop_id,username,display_name,password_hash,role_code,account_user_id) VALUES
(1,NULL,'TEST-TAMIRAN-1010A-admin','آزمایشی — مدیر سیستم','!TEST-NOT-A-LOGIN-HASH','central_admin','TEST-TAMIRAN-1010A-account1'),
(2,1,'TEST-TAMIRAN-1010A-manager','آزمایشی — مدیر تعمیرگاه','!TEST-NOT-A-LOGIN-HASH','repair_manager','TEST-TAMIRAN-1010A-account2'),
(3,1,'TEST-TAMIRAN-1010A-reception','آزمایشی — پذیرش','!TEST-NOT-A-LOGIN-HASH','reception','TEST-TAMIRAN-1010A-account3'),
(4,1,'TEST-TAMIRAN-1010A-tech','آزمایشی — تکنسین','!TEST-NOT-A-LOGIN-HASH','technician','TEST-TAMIRAN-1010A-account4'),
(5,1,'TEST-TAMIRAN-1010A-qc','آزمایشی — کنترل کیفیت','!TEST-NOT-A-LOGIN-HASH','quality_control','TEST-TAMIRAN-1010A-account5'),
(6,1,'TEST-TAMIRAN-1010A-warehouse','آزمایشی — انباردار','!TEST-NOT-A-LOGIN-HASH','warehouse_keeper','TEST-TAMIRAN-1010A-account6'),
(7,1,'TEST-TAMIRAN-1010A-finance','آزمایشی — مالی','!TEST-NOT-A-LOGIN-HASH','finance_cashier','TEST-TAMIRAN-1010A-account7'),
(8,2,'TEST-TAMIRAN-1010A-other','آزمایشی — پذیرش تعمیرگاه ب','!TEST-NOT-A-LOGIN-HASH','reception','TEST-TAMIRAN-1010A-account8');
INSERT INTO tamiran_user_branches(shop_id,user_id,branch_id,branch_role_code,permissions_json)
SELECT shop_id,id,CASE shop_id WHEN 1 THEN 1 ELSE 2 END,role_code,'[]' FROM tamiran_users WHERE shop_id IS NOT NULL;
INSERT INTO repair_customers(id,public_id,shop_id,full_name,mobile) VALUES
(1,'TEST-TAMIRAN-1010A-CUSTA',1,'آزمایشی — مشتری الف','TEST-MOBILE-A'),
(2,'TEST-TAMIRAN-1010A-CUSTB',2,'آزمایشی — مشتری ب','TEST-MOBILE-A');
