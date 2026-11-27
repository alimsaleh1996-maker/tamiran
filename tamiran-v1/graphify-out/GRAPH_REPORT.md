# Graph Report - tamiran-v1  (2026-11-27)

## Corpus Check
- 174 files · ~194,822 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1834 nodes · 5504 edges · 96 communities (71 shown, 25 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1211 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0c7cb592`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- access.tsx
- MoneyInput
- directadmin-api.ts
- {closure#2}
- v2-workspace.tsx
- v2_case
- smoke.py
- operations.php
- admin-panel.tsx
- installer_test.php
- Client
- UPGRADE-FA.md
- bootstrap.php
- backup-engine.php
- compact-receipt.tsx
- modules.tsx
- expect
- SalesSection
- synthetic_imei
- external_purchase_change
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- finance-case-view.tsx
- operations_policy
- auth_identify
- ModuleRouter
- CentralAdminPanel
- followups.php
- catalog-import.tsx
- v2-api.ts
- شواهد نسخهٔ PHP تعمیران
- customer-portal.tsx
- compilerOptions
- package.py
- client-diagnostics.ts
- CHANGELOG.md
- directadmin-api.ts
- v2_text
- dependencies
- TamiranApiException
- workflow-v2.php
- tamiran_require_central_admin
- check_quality_browser
- run
- package_test.py
- issue_once_concurrently
- workflowV2Action
- case-stage-board.tsx
- {closure#2}
- reception-draft-mutations.ts
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- نصب تعمیران روی هاست PHP
- run
- run
- tamiran_id
- reception-ui-contract.ts
- run
- technical-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- delivery-v2.php
- UI-FIXES-FA.md
- quality_run
- frontend_contracts.test.mjs
- به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8
- catalog-similarity.ts
- jsonPost
- useModalFocus
- services_test.php
- run
- build.mjs
- hosting/README.md
- tamiran_captcha_audio
- {closure#1}
- design-qa.md
- {closure#1}
- به‌روزرسانی از php.8 به php.9

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 247 edges
2. `v2_text()` - 73 edges
3. `tamiran_id()` - 65 edges
4. `tamiran_audit()` - 61 edges
5. `expect()` - 59 edges
6. `Client` - 55 edges
7. `v2_require_permission()` - 51 edges
8. `v2_case()` - 51 edges
9. `{closure#8}()` - 41 edges
10. `tamiran_db()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `API، داده و ابزارها` --references--> `v2_case()`  [INFERRED]
  docs/STABILIZATION-FA.md → hosting/private/v2-core.php
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php

## Import Cycles
- None detected.

## Communities (96 total, 25 thin omitted)

### Community 0 - "access.tsx"
Cohesion: 0.11
Nodes (28): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+20 more)

### Community 1 - "MoneyInput"
Cohesion: 0.17
Nodes (22): fa, ProcurementDocuments(), ProcurementForm(), loadRelated(), ReceiveDocument(), Run, statusLabels, formatToman() (+14 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.06
Nodes (50): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+42 more)

### Community 3 - "{closure#2}"
Cohesion: 0.09
Nodes (33): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+25 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.08
Nodes (51): directAdminRequest(), formatHandoverTime(), printHandoverReceipt(), timeFormatter, matchesQueueSearch(), queueTimestamp(), inventoryControlV2Action(), loadManagerQueueOptions() (+43 more)

### Community 5 - "v2_case"
Cohesion: 0.13
Nodes (52): manager_update_case(), technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_declared_issues() (+44 more)

### Community 6 - "smoke.py"
Cohesion: 0.10
Nodes (5): check(), save(), upload(), main(), svg_captcha()

### Community 7 - "operations.php"
Cohesion: 0.11
Nodes (24): {closure#10}(), {closure#13}(), {closure#2}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_recallable(), operations_case_select() (+16 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.06
Nodes (42): AdminModalState, AdminSection, adminSections, BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel(), billingPeriodLabels (+34 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.11
Nodes (25): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+17 more)

### Community 11 - "UPGRADE-FA.md"
Cohesion: 0.12
Nodes (15): ارتقای 1.0.0-rc.10 به 1.0.0-rc.11, ارتقای 1.0.0-rc.11 به 1.0.0-rc.12, ارتقای 1.0.0-rc.12 به 1.0.0-rc.13, ارتقای 1.0.0-rc.13 به 1.0.0-rc.14, ارتقای 1.0.0-rc.14 به 1.0.0-rc.15, ارتقای 1.0.0-rc.15 به 1.0.0-rc.16, ارتقای 1.0.0-rc.2 به 1.0.0-rc.3, ارتقای 1.0.0-rc.3 به 1.0.0-rc.4 (+7 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.11
Nodes (28): {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_config(), tamiran_csrf_token(), tamiran_db(), tamiran_encryption_key(), tamiran_fail() (+20 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (23): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+15 more)

### Community 14 - "compact-receipt.tsx"
Cohesion: 0.20
Nodes (14): WorkspaceProfile, CompactReceipt(), CompactReceiptProps, dateText(), DEFAULT_RECEIPT_SIZE, RECEIPT_CSS, IntakeReceiptDetails, date (+6 more)

### Community 15 - "modules.tsx"
Cohesion: 0.08
Nodes (54): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, createCatalogItem(), discardReceptionDraft(), loadCatalog(), lookupCustomer() (+46 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+11 more)

### Community 17 - "SalesSection"
Cohesion: 0.18
Nodes (22): AdminEmpty(), AdminOverview(), daysRemaining(), formatDate(), formatMoney(), initials(), InvoiceCatalogForm(), InvoiceDetails() (+14 more)

### Community 18 - "synthetic_imei"
Cohesion: 0.11
Nodes (20): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+12 more)

### Community 19 - "external_purchase_change"
Cohesion: 0.30
Nodes (9): external_purchase_add_catalog(), external_purchase_can_add_catalog(), external_purchase_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_requires_customer_authorization(), external_purchase_rows() (+1 more)

### Community 20 - "package.json"
Cohesion: 0.12
Nodes (21): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+13 more)

### Community 21 - "v2-core.php"
Cohesion: 0.13
Nodes (29): manager_case_queue(), manager_queue_conditions(), inventory_v2_route_after_parts(), v2_catalog_collisions(), v2_delivery_identity(), v2_device_has_imei(), v2_identity_normalized(), v2_identity_value() (+21 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.21
Nodes (22): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "{closure#1}"
Cohesion: 0.19
Nodes (15): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, {closure#3}(), tamiran_decrypt_secret(), tamiran_digits() (+7 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (15): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+7 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.11
Nodes (29): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), isOpenFinanceInvoice() (+21 more)

### Community 26 - "operations_policy"
Cohesion: 0.23
Nodes (8): manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_report_cases(), manager_report_dates(), manager_report_params(), manager_report_sources(), workflow_v2_technician_view()

### Community 27 - "auth_identify"
Cohesion: 0.25
Nodes (17): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+9 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.30
Nodes (23): printCompactReceipt(), AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal() (+15 more)

### Community 29 - "CentralAdminPanel"
Cohesion: 0.12
Nodes (20): AdminLoading(), AdminModal(), adminSectionFromLocation(), CentralAdminPanel(), errorMessage(), PriceCatalogSection(), ProductChangeFlow(), SupportTickets() (+12 more)

### Community 30 - "followups.php"
Cohesion: 0.08
Nodes (46): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+38 more)

### Community 31 - "catalog-import.tsx"
Cohesion: 0.22
Nodes (13): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), normalizeQueueSearch() (+5 more)

### Community 32 - "v2-api.ts"
Cohesion: 0.07
Nodes (42): fa(), FollowReason, followTitles, managerMetricLabels, ManagerPulse(), openManagerQueueCase(), OperationsFollowups(), loadMore() (+34 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "customer-portal.tsx"
Cohesion: 0.19
Nodes (12): Address, CustomerAddress(), CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload (+4 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.18
Nodes (11): digest(), git(), main(), release_manifest(), release_source(), release_version(), required(), runtime_files() (+3 more)

### Community 37 - "client-diagnostics.ts"
Cohesion: 0.27
Nodes (6): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State, react

### Community 38 - "CHANGELOG.md"
Cohesion: 0.09
Nodes (20): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+12 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (36): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+28 more)

### Community 40 - "v2_text"
Cohesion: 0.20
Nodes (27): v2_request_has_no_open_purchase_sql(), v2_require_permission(), v2_text(), tamiran_audit(), delivery_report_discrepancy(), finance_advance_case_search(), {closure#2}(), inventory_adjustment() (+19 more)

### Community 41 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, qrcode, react-dom

### Community 42 - "TamiranApiException"
Cohesion: 0.11
Nodes (39): v2_require_capability(), v2_scope(), tamiran_encrypt_secret(), tamiran_id(), tamiran_json_body(), tamiran_require_csrf(), tamiran_tracking_token(), tamiran_uuid_v7() (+31 more)

### Community 43 - "workflow-v2.php"
Cohesion: 0.18
Nodes (14): v2_require_case_access(), workflow_v2_active_technician(), workflow_v2_activity(), workflow_v2_add_collaborator(), workflow_v2_check_finance_reapproval(), workflow_v2_estimate_decide(), workflow_v2_estimate_send(), workflow_v2_handover_checklist() (+6 more)

### Community 44 - "tamiran_require_central_admin"
Cohesion: 0.29
Nodes (4): tamiran_require_central_admin(), {closure#1}(), {closure#2}(), price_catalog_rows()

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 46 - "run"
Cohesion: 0.14
Nodes (14): browse(), check_catalog_browser(), check_concurrency(), wait_for_transactions(), check_grant_browser(), check_hot_browser(), check_recall_browser(), check() (+6 more)

### Community 49 - "workflowV2Action"
Cohesion: 0.16
Nodes (16): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), disposals, ExternalPurchasePanel(), addCatalog(), submit() (+8 more)

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.71
Nodes (4): CaseStageBoard(), initialStageForStatuses(), repairStages, stageForStatus()

### Community 51 - "{closure#2}"
Cohesion: 0.24
Nodes (9): admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_shop_summary(), admin_temporary_password(), admin_text() (+1 more)

### Community 52 - "reception-draft-mutations.ts"
Cohesion: 0.19
Nodes (11): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+3 more)

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 71 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.18
Nodes (11): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+3 more)

### Community 72 - "run"
Cohesion: 0.13
Nodes (14): screens(), check_case_procurement(), check_cashier_referral(), check_finance_delivery_browser(), check_intake_print(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser() (+6 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.14
Nodes (26): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line() (+18 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 76 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.07
Nodes (45): OperationsPolicyForm(), save(), fa, QueueFeedback(), useOperationalQueue(), blank(), costLabels, date() (+37 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.05
Nodes (32): TAM-STAB-02، شناسه‌های مستقل دستگاه, ساختار داده, انتشار, خواندن نسخهٔ هاست, مسیر انتشار نسل جدید, API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12 (+24 more)

### Community 80 - "UI-FIXES-FA.md"
Cohesion: 0.22
Nodes (8): php.10 — اصلاح ورودی جاافتادهٔ مرکز عملیات, اصلاحات رابط — 2.0.0-php.7, سابقهٔ php.2, سابقهٔ php.6, سابقهٔ php.8, سابقهٔ اصلاحات, میز کار وظیفه‌محور — php.9, میز کار یکپارچهٔ تکنسین — php.8

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 82 - "frontend_contracts.test.mjs"
Cohesion: 0.23
Nodes (5): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), vectors, vite

### Community 83 - "به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8"
Cohesion: 0.25
Nodes (8): به‌روزرسانی از 2.0.0-php.6 به 2.0.0-php.7, به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8, سابقهٔ php.7, سابقهٔ ارتقا از php.1 به php.2, سابقهٔ ارتقا از php.2 به php.3, سابقهٔ ارتقا از php.3 به php.4, سابقهٔ ارتقا از php.4 به php.5, سابقهٔ ارتقا از php.5 به php.6

### Community 84 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 85 - "jsonPost"
Cohesion: 0.16
Nodes (19): accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp(), submit(), evidenceMethods, Run, imeiError() (+11 more)

### Community 86 - "useModalFocus"
Cohesion: 0.38
Nodes (6): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog()

### Community 87 - "services_test.php"
Cohesion: 0.40
Nodes (5): check(), {closure#1}(), {closure#2}(), {closure#3}(), denied()

### Community 88 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 89 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 92 - "{closure#1}"
Cohesion: 0.67
Nodes (3): tamiran_domain_root(), {closure#1}(), tamiran_health_files()

## Knowledge Gaps
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `external_purchase_change`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `operations_policy`, `auth_identify`, `followups.php`, `v2_text`, `workflow-v2.php`, `tamiran_require_central_admin`, `{closure#2}`, `tamiran_id`, `quality_run`, `tamiran_captcha_audio`, `{closure#1}`, `{closure#1}`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 225 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 225 INFERRED edges - model-reasoned connections that need verification._
- **Should `access.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Why does `react` connect `client-diagnostics.ts` to `access.tsx`, `MoneyInput`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `compact-receipt.tsx`, `modules.tsx`, `package.json`, `persian-date.ts`, `finance-case-view.tsx`, `catalog-import.tsx`, `v2-api.ts`, `customer-portal.tsx`, `directadmin-api.ts`, `dependencies`, `workflowV2Action`, `case-stage-board.tsx`, `technical-case-workspace.tsx`, `jsonPost`, `useModalFocus`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 69 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 69 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06289308176100629 - nodes in this community are weakly interconnected._
- **Are the 62 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 62 INFERRED edges - model-reasoned connections that need verification._