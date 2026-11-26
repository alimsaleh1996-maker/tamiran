# Graph Report - tamiran-v1  (2026-11-26)

## Corpus Check
- 166 files · ~175,913 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 13, (none) 8, .woff2 3)

## Summary
- 1662 nodes · 4957 edges · 90 communities (66 shown, 24 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1103 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8e53f00a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- manager_update_case
- v2-api.ts
- directadmin-api.ts
- {closure#2}
- v2-workspace.tsx
- v2_case
- smoke.py
- operations.php
- admin-panel.tsx
- installer_test.php
- Client
- نصب تعمیران روی هاست PHP
- bootstrap.php
- backup-engine.php
- workflowV2Action
- ModuleRouter
- expect
- tamiran_json_body
- modules.tsx
- workflow-v2.php
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- finance-case-view.tsx
- technical-case-workspace.tsx
- tamiran_audit
- react
- tamiran_require_csrf
- followups.php
- case-tools.tsx
- manager-operations.tsx
- شواهد نسخهٔ PHP تعمیران
- external_purchase_change
- compilerOptions
- package.py
- SalesSection
- CHANGELOG.md
- directadmin-api.ts
- v2_text
- CentralAdminPanel
- customer-portal.tsx
- DATABASE-MIGRATIONS.md
- catalog-import.tsx
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- issue_once_concurrently
- {closure#1}
- {closure#2}
- version.ts
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- README.md
- run
- run
- tamiran_id
- reception-draft-mutations.ts
- reception-ui-contract.ts
- operations-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- quality_run
- run
- operations.ts
- tamiran_captcha_audio
- jsonPost
- case_invoice_correct
- synthetic_imei
- catalog-similarity.php
- captcha_audio.py
- run
- design-qa.md

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 232 edges
2. `v2_text()` - 64 edges
3. `tamiran_id()` - 62 edges
4. `tamiran_audit()` - 59 edges
5. `expect()` - 54 edges
6. `Client` - 49 edges
7. `v2_require_permission()` - 45 edges
8. `v2_case()` - 45 edges
9. `tamiran_db()` - 40 edges
10. `tamiran_require_csrf()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `admin_shop_summary()` --calls--> `tamiran_license_state()`  [INFERRED]
  hosting/public_html/api/admin.php → hosting/public_html/api/bootstrap.php
- `{closure#1}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php

## Import Cycles
- None detected.

## Communities (90 total, 24 thin omitted)

### Community 0 - "manager_update_case"
Cohesion: 0.47
Nodes (4): manager_followup_queue(), manager_operations_report(), manager_update_case(), workflow_v2_technician_view()

### Community 1 - "v2-api.ts"
Cohesion: 0.11
Nodes (23): WorkspaceProfile, OperationsCaseWorkspace(), Task, tasks, assignV2Case(), createV2Estimate(), inventoryControlV2Action(), jsonPost() (+15 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (54): diagnosticFetch(), invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, accessErrorMessage(), AccessGateway(), AccessSessionLoader() (+46 more)

### Community 3 - "{closure#2}"
Cohesion: 0.10
Nodes (28): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+20 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.10
Nodes (39): directAdminRequest(), formatHandoverTime(), printHandoverReceipt(), matchesQueueSearch(), loadV2Delivery(), loadV2FinanceWorkspace(), loadV2Inventory(), loadV2InventoryControl() (+31 more)

### Community 5 - "v2_case"
Cohesion: 0.28
Nodes (25): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_diagnosis(), technician_editable() (+17 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (3): upload(), main(), main()

### Community 7 - "operations.php"
Cohesion: 0.10
Nodes (38): tamiran_require_csrf(), tamiran_tracking_token(), tamiran_uuid_v7(), tamiran_validate_national_code(), {closure#10}(), {closure#13}(), {closure#14}(), {closure#4}() (+30 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.06
Nodes (40): AdminModalState, AdminSection, adminSections, BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel(), billingPeriodLabels (+32 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.13
Nodes (21): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+13 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.05
Nodes (40): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+32 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.10
Nodes (29): {closure#1}(), {closure#5}(), tamiran_api(), tamiran_config(), tamiran_db(), tamiran_domain_root(), tamiran_encrypt_secret(), tamiran_encryption_key() (+21 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.18
Nodes (24): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+16 more)

### Community 14 - "workflowV2Action"
Cohesion: 0.24
Nodes (11): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), changeExternalPurchase(), ExternalPurchase (+3 more)

### Community 15 - "ModuleRouter"
Cohesion: 0.34
Nodes (21): printCompactReceipt(), AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal() (+13 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+11 more)

### Community 17 - "tamiran_json_body"
Cohesion: 0.11
Nodes (20): tamiran_json_body(), tamiran_require_actor(), tamiran_require_shop_manager(), tamiran_require_writable_actor(), catalog_rows(), catalog_value(), {closure#1}(), client_error_text() (+12 more)

### Community 18 - "modules.tsx"
Cohesion: 0.08
Nodes (54): displayDeviceType(), createCatalogItem(), discardReceptionDraft(), lookupCustomer(), saveReceptionDraft(), saveShopSetting(), CaseFollowUp, FollowUpKind (+46 more)

### Community 19 - "workflow-v2.php"
Cohesion: 0.17
Nodes (22): v2_json(), v2_require_case_access(), v2_transition_role_allowed(), {closure#8}(), workflow_v2_active_technician(), workflow_v2_activity(), workflow_v2_add_collaborator(), workflow_v2_add_manual_part() (+14 more)

### Community 20 - "package.json"
Cohesion: 0.10
Nodes (24): qrcode@1.5.4, devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7 (+16 more)

### Community 21 - "v2-core.php"
Cohesion: 0.12
Nodes (22): v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized(), v2_identity_value() (+14 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.21
Nodes (22): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "{closure#1}"
Cohesion: 0.19
Nodes (16): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_decrypt_secret(), tamiran_digits(), tamiran_mobile() (+8 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (16): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+8 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.13
Nodes (23): ConfirmAmount(), count, dateLabel(), FinanceHeader(), isOpenFinanceInvoice(), Line, lineAmount(), lineNames (+15 more)

### Community 26 - "technical-case-workspace.tsx"
Cohesion: 0.14
Nodes (21): blank(), costLabels, date(), Draft, message(), TechnicalCaseWorkspace(), titles, TechnicalFile (+13 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.36
Nodes (11): inventory_v2_route_after_parts(), v2_notify(), v2_stock_mutate(), {closure#1}(), {closure#2}(), inventory_v2_finalize_issue(), inventory_v2_issue(), inventory_v2_payload() (+3 more)

### Community 28 - "react"
Cohesion: 0.13
Nodes (14): dependencies, lucide-react@1.31.0, react@19.2.6, react-dom@19.2.6, ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary (+6 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.19
Nodes (21): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+13 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "case-tools.tsx"
Cohesion: 0.18
Nodes (12): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText(), RECEIPT_CSS (+4 more)

### Community 32 - "manager-operations.tsx"
Cohesion: 0.10
Nodes (32): fa(), FollowReason, followTitles, OperationsFollowups(), loadMore(), openCase(), saveNote(), OperationsPerformance() (+24 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "external_purchase_change"
Cohesion: 0.27
Nodes (10): external_purchase_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_rows(), external_purchase_view(), operations_policy(), operations_policy_defaults() (+2 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "SalesSection"
Cohesion: 0.15
Nodes (25): AdminEmpty(), AdminOverview(), daysRemaining(), formatDate(), formatMoney(), initials(), InvoiceCatalogForm(), InvoiceDetails() (+17 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.12
Nodes (14): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.2, تغییرات 1.0.0-rc.3, تغییرات 1.0.0-rc.4 (+6 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.06
Nodes (41): DeviceCatalogItem, initialDeviceCatalog, legacyDeviceTypeLabels, AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard (+33 more)

### Community 40 - "v2_text"
Cohesion: 0.24
Nodes (23): v2_require_permission(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload(), inventory_hot_review() (+15 more)

### Community 41 - "CentralAdminPanel"
Cohesion: 0.14
Nodes (17): AdminLoading(), AdminModal(), adminSectionFromLocation(), CentralAdminPanel(), errorMessage(), ProductChangeFlow(), SupportTickets(), UserForm() (+9 more)

### Community 42 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 44 - "catalog-import.tsx"
Cohesion: 0.06
Nodes (39): fflate@0.8.3, document, localVite, output, result, root, layers, lock() (+31 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "{closure#1}"
Cohesion: 0.57
Nodes (5): {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 50 - "{closure#2}"
Cohesion: 0.12
Nodes (14): admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_shop_summary(), admin_temporary_password(), admin_text() (+6 more)

### Community 51 - "version.ts"
Cohesion: 0.50
Nodes (3): APP_BUILD_ID, APP_CHANNEL, APP_VERSION

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.16
Nodes (12): check_case_procurement(), check_cashier_referral(), check_finance_delivery_browser(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser(), check_supply_browser(), open_as() (+4 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.33
Nodes (14): technician_unrepaired(), v2_financial_event(), tamiran_id(), {closure#3}(), finance_advance_readiness(), finance_draft_items(), finance_handoff(), finance_invoice_case() (+6 more)

### Community 75 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 76 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 77 - "operations-case-workspace.tsx"
Cohesion: 0.20
Nodes (19): fa, ProcurementDocuments(), ProcurementForm(), ReceiveDocument(), Run, statusLabels, formatToman(), MoneyInput() (+11 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.14
Nodes (13): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل, 1.0.0-rc.5 — نمایش پرونده در صف مالی (+5 more)

### Community 79 - "{closure#1}"
Cohesion: 0.36
Nodes (9): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+1 more)

### Community 81 - "quality_run"
Cohesion: 0.18
Nodes (22): v2_has_permission(), v2_require_capability(), v2_scope(), TamiranApiException, tamiran_captcha_image(), {closure#2}(), quality_ack(), quality_authorize_case() (+14 more)

### Community 82 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 83 - "operations.ts"
Cohesion: 0.09
Nodes (22): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), CreateInventoryItemInput, CreatePartRequestInput, CreateRepairCaseInput, CustomerLookupResult, emptyOperationalSnapshot (+14 more)

### Community 85 - "jsonPost"
Cohesion: 0.29
Nodes (11): accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp(), submit(), deliveryImeiError(), evidenceMethods, normalizeDeliveryImei() (+3 more)

### Community 86 - "case_invoice_correct"
Cohesion: 0.38
Nodes (8): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line()

### Community 87 - "synthetic_imei"
Cohesion: 0.11
Nodes (20): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+12 more)

### Community 88 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 90 - "captcha_audio.py"
Cohesion: 0.25
Nodes (3): check(), save(), svg_captcha()

### Community 91 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

## Knowledge Gaps
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `quality_run` to `manager_update_case`, `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `tamiran_json_body`, `workflow-v2.php`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `external_purchase_change`, `v2_text`, `{closure#1}`, `{closure#2}`, `tamiran_id`, `{closure#1}`, `tamiran_captcha_audio`, `case_invoice_correct`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 210 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 210 INFERRED edges - model-reasoned connections that need verification._
- **Should `v2-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `manager-operations.tsx`, `v2-api.ts`, `directadmin-api.ts`, `v2-workspace.tsx`, `directadmin-api.ts`, `admin-panel.tsx`, `customer-portal.tsx`, `catalog-import.tsx`, `operations-case-workspace.tsx`, `workflowV2Action`, `modules.tsx`, `operations.ts`, `package.json`, `jsonPost`, `persian-date.ts`, `finance-case-view.tsx`, `technical-case-workspace.tsx`, `case-tools.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._
- **Are the 59 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 59 INFERRED edges - model-reasoned connections that need verification._