-- LOCAL TEST ONLY. Fixture family TEST-TAMIRAN-1010B; no real customer data.
INSERT INTO repair_device_types(id,shop_id,title) VALUES
(1,1,'آزمایشی — موبایل الف'),(2,2,'آزمایشی — موبایل ب');
INSERT INTO repair_device_brands(id,device_type_id,title) VALUES
(1,1,'آزمایشی — برند الف'),(2,2,'آزمایشی — برند ب');
INSERT INTO repair_device_models(id,brand_id,title) VALUES
(1,1,'آزمایشی — مدل الف'),(2,2,'آزمایشی — مدل ب');
INSERT INTO repair_receipt_sequences(shop_id,last_number) VALUES (1,1),(2,1);
INSERT INTO repair_customer_devices(
  id,public_id,shop_id,customer_id,device_model_id,device_type_title,brand_title,model_title,
  identifier_value,normalized_identifier,ownership_verification_json,details_json
) VALUES
(1,'TEST-TAMIRAN-1010B-DEVA',1,1,1,'آزمایشی — موبایل','آزمایشی — برند الف','آزمایشی — مدل الف','TEST-IMEI-A','TESTIMEIA','{}','{}'),
(2,'TEST-TAMIRAN-1010B-DEVB',2,2,2,'آزمایشی — موبایل','آزمایشی — برند ب','آزمایشی — مدل ب','TEST-IMEI-B','TESTIMEIB','{}','{}');
INSERT INTO repair_cases(
  id,public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,
  public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,
  product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,
  idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,
  accessories_json,appearance_states_json,created_by_user_id
) VALUES
(1,'TEST-TAMIRAN-1010B-CASEA','00000000-0000-4000-8000-000000000001',1,1,1,1,1,
 'T1010A-000001','T1010A-000001','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','TEST-NOT-A-REAL-TOKEN',
 'pro','off','off','{}','TEST-TAMIRAN-1010B-REQUEST-A','آزمایشی — موبایل','آزمایشی — برند الف','آزمایشی — مدل الف','آزمایشی — روشن نمی‌شود',
 '[]','[]',3),
(2,'TEST-TAMIRAN-1010B-CASEB','00000000-0000-4000-8000-000000000002',2,2,2,2,1,
 'T1010B-000001','T1010B-000001','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','TEST-NOT-A-REAL-TOKEN-B',
 'pro','off','off','{}','TEST-TAMIRAN-1010B-REQUEST-B','آزمایشی — موبایل','آزمایشی — برند ب','آزمایشی — مدل ب','آزمایشی — شارژ نمی‌شود',
 '[]','[]',8);
INSERT INTO repair_case_workflows(
  id,public_id,shop_id,branch_id,case_id,workflow_code,diagnostic_fee_policy_json,customer_consent_json
) VALUES
(1,'TEST-TAMIRAN-1010B-WFA',1,1,1,'mobile_tablet','{}','{}'),
(2,'TEST-TAMIRAN-1010B-WFB',2,2,2,'mobile_tablet','{}','{}');
INSERT INTO repair_case_events(id,case_id,actor_user_id,event_type,to_status,description,metadata_json)
VALUES(1,1,3,'case_created','awaiting_assignment','آزمایشی — ایجاد پرونده','{}');
INSERT INTO repair_case_stage_events(
 id,public_id,workflow_id,to_status,actor_user_id,metadata_json,idempotency_key,started_at
) VALUES(1,'TEST-TAMIRAN-1010B-STAGE',1,'reception',3,'{}','TEST-TAMIRAN-1010B-STAGE-1','2026-10-10 00:30:00');
INSERT INTO tamiran_audit_log(
 id,public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,
 before_json,after_json,request_id,ip_address
) VALUES(1,'TEST-TAMIRAN-1010B-AUDIT',1,1,3,'case.create','repair_case','TEST-TAMIRAN-1010B-CASEA',
 NULL,'{}','TEST-TAMIRAN-1010B-REQUEST-A','192.0.2.1');
