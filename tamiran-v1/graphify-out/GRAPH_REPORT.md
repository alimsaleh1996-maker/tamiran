# Graph Report - tamiran-v1  (2026-11-27)

## Corpus Check
- 171 files · ~191,566 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1800 nodes · 5400 edges · 86 communities (64 shown, 22 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1192 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `99fd3698`
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
- نصب تعمیران روی هاست PHP
- TamiranApiException
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
- SupportTickets
- DATABASE-MIGRATIONS.md
- price-catalog.php
- check_quality_browser
- package_test.py
- issue_once_concurrently
- product-change.php
- case-stage-board.tsx
- shop-users.tsx
- reception-draft-mutations.ts
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- run
- run
- tamiran_id
- reception-ui-contract.ts
- run
- technical-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- quality_run
- frontend_contracts.test.mjs
- catalog-similarity.ts
- jsonPost
- catalog-similarity.php
- build.mjs
- captcha_audio.py
- design-qa.md

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 246 edges
2. `v2_text()` - 73 edges
3. `tamiran_id()` - 65 edges
4. `tamiran_audit()` - 61 edges
5. `expect()` - 56 edges
6. `Client` - 52 edges
7. `v2_require_permission()` - 51 edges
8. `v2_case()` - 50 edges
9. `{closure#8}()` - 41 edges
10. `tamiran_db()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `API، داده و ابزارها` --references--> `v2_case()`  [INFERRED]
  docs/STABILIZATION-FA.md → hosting/private/v2-core.php
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#2}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php

## Import Cycles
- None detected.

## Communities (86 total, 22 thin omitted)

### Community 0 - "access.tsx"
Cohesion: 0.11
Nodes (28): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+20 more)

### Community 1 - "MoneyInput"
Cohesion: 0.18
Nodes (21): fa, ProcurementDocuments(), ProcurementForm(), loadRelated(), ReceiveDocument(), Run, statusLabels, formatToman() (+13 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (46): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createPartRequest(), createRepairCase(), loadCapabilities() (+38 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (37): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+29 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.07
Nodes (54): createInventoryItem(), directAdminRequest(), formatHandoverTime(), printHandoverReceipt(), timeFormatter, fa, QueueFeedback(), useOperationalQueue() (+46 more)

### Community 5 - "v2_case"
Cohesion: 0.13
Nodes (48): external_purchase_catalog(), manager_update_case(), technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state() (+40 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (3): upload(), main(), main()

### Community 7 - "operations.php"
Cohesion: 0.11
Nodes (38): tamiran_validate_national_code(), {closure#10}(), {closure#13}(), {closure#14}(), {closure#2}(), {closure#4}(), operations_appearance_options(), operations_canonical_value() (+30 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.06
Nodes (42): AdminModalState, AdminSection, adminSections, BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel(), billingPeriodLabels (+34 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.10
Nodes (25): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+17 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.04
Nodes (45): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+37 more)

### Community 12 - "TamiranApiException"
Cohesion: 0.06
Nodes (73): v2_scope(), admin_user_assert_mobile_available(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), {closure#9}(), shop_user_assert_managed() (+65 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.11
Nodes (33): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+25 more)

### Community 14 - "compact-receipt.tsx"
Cohesion: 0.12
Nodes (24): WorkspaceProfile, Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText() (+16 more)

### Community 15 - "modules.tsx"
Cohesion: 0.07
Nodes (43): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, Address, CustomerAddress(), createCatalogItem(), discardReceptionDraft() (+35 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (20): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+12 more)

### Community 17 - "SalesSection"
Cohesion: 0.19
Nodes (20): AdminEmpty(), AdminOverview(), daysRemaining(), formatDate(), initials(), InvoiceDetails(), InvoiceDocument(), invoiceItemsForShop() (+12 more)

### Community 18 - "synthetic_imei"
Cohesion: 0.11
Nodes (20): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+12 more)

### Community 19 - "external_purchase_change"
Cohesion: 0.33
Nodes (7): external_purchase_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_requires_customer_authorization(), external_purchase_rows(), external_purchase_view()

### Community 20 - "package.json"
Cohesion: 0.12
Nodes (21): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+13 more)

### Community 21 - "v2-core.php"
Cohesion: 0.17
Nodes (24): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+16 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.14
Nodes (31): InvoiceCatalogForm(), fa(), OperationsPerformance(), detailButton(), load(), moreDetails(), openCompleted(), addGregorianDays() (+23 more)

### Community 23 - "{closure#1}"
Cohesion: 0.14
Nodes (21): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, {closure#3}(), v2_require_capability(), tamiran_decrypt_secret() (+13 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (6): admin_user_assign_branches(), admin_user_payload(), shop_user_branches(), shop_user_memberships(), shop_user_payload(), shop_user_permission_catalog()

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.12
Nodes (28): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), isOpenFinanceInvoice() (+20 more)

### Community 26 - "operations_policy"
Cohesion: 0.21
Nodes (10): manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_queue_conditions(), manager_report_cases(), manager_report_dates(), manager_report_params(), manager_report_sources() (+2 more)

### Community 27 - "auth_identify"
Cohesion: 0.32
Nodes (12): auth_begin_actor(), auth_candidate_users(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check(), auth_throttle_failure() (+4 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.19
Nodes (36): printCompactReceipt(), saveShopSetting(), AccountSettings(), AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv() (+28 more)

### Community 29 - "CentralAdminPanel"
Cohesion: 0.14
Nodes (16): AdminLoading(), adminSectionFromLocation(), CentralAdminPanel(), errorMessage(), formatMoney(), PriceCatalogSection(), ProductChangeFlow(), UserForm() (+8 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "catalog-import.tsx"
Cohesion: 0.22
Nodes (13): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), normalizeQueueSearch() (+5 more)

### Community 32 - "v2-api.ts"
Cohesion: 0.07
Nodes (44): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), FollowReason, followTitles (+36 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.25
Nodes (11): digest(), git(), main(), release_manifest(), release_source(), release_version(), required(), runtime_files() (+3 more)

### Community 37 - "client-diagnostics.ts"
Cohesion: 0.16
Nodes (12): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State, layers, lock(), locks (+4 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.10
Nodes (19): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+11 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.08
Nodes (24): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+16 more)

### Community 40 - "v2_text"
Cohesion: 0.12
Nodes (45): manager_case_queue(), v2_queue_id(), v2_queue_offset(), v2_queue_term(), v2_request_has_no_open_purchase_sql(), v2_require_permission(), v2_require_queue_branch(), v2_stock_mutate() (+37 more)

### Community 41 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, qrcode, react-dom

### Community 42 - "SupportTickets"
Cohesion: 0.40
Nodes (5): AdminModal(), SupportTickets(), changeTicket(), createTicket(), loadTickets()

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "product-change.php"
Cohesion: 0.53
Nodes (4): product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.71
Nodes (4): CaseStageBoard(), initialStageForStatuses(), repairStages, stageForStatus()

### Community 51 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 52 - "reception-draft-mutations.ts"
Cohesion: 0.19
Nodes (11): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+3 more)

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.13
Nodes (14): screens(), check_case_procurement(), check_cashier_referral(), check_finance_delivery_browser(), check_intake_print(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser() (+6 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.12
Nodes (32): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line() (+24 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 76 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.07
Nodes (45): OperationsPolicyForm(), save(), blank(), costLabels, date(), DevicePassword(), reveal(), diagnosisOptions (+37 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.06
Nodes (29): انتشار, خواندن نسخهٔ هاست, مسیر انتشار نسل جدید, API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12, سابقهٔ پیاده‌سازی و آزمون, فهرست پیگیری بر اساس ممیزی مستقل rc.13 و آزمون rc.15 (+21 more)

### Community 79 - "{closure#1}"
Cohesion: 0.20
Nodes (10): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+2 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 82 - "frontend_contracts.test.mjs"
Cohesion: 0.23
Nodes (5): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), vectors, vite

### Community 84 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 85 - "jsonPost"
Cohesion: 0.16
Nodes (19): accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp(), submit(), deliveryImeiError(), evidenceMethods, normalizeDeliveryImei() (+11 more)

### Community 88 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 89 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 90 - "captcha_audio.py"
Cohesion: 0.25
Nodes (3): check(), save(), svg_captcha()

## Knowledge Gaps
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `v2_case`, `operations.php`, `v2_text`, `installer_test.php`, `tamiran_id`, `backup-engine.php`, `{closure#1}`, `product-change.php`, `quality_run`, `external_purchase_change`, `v2-core.php`, `{closure#1}`, `operations_policy`, `auth_identify`, `followups.php`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 224 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 224 INFERRED edges - model-reasoned connections that need verification._
- **Should `access.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Why does `react` connect `client-diagnostics.ts` to `access.tsx`, `MoneyInput`, `customer-portal.tsx`, `v2-api.ts`, `v2-workspace.tsx`, `directadmin-api.ts`, `admin-panel.tsx`, `dependencies`, `technical-case-workspace.tsx`, `compact-receipt.tsx`, `modules.tsx`, `case-stage-board.tsx`, `shop-users.tsx`, `package.json`, `jsonPost`, `persian-date.ts`, `finance-case-view.tsx`, `catalog-import.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 69 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 69 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06717687074829932 - nodes in this community are weakly interconnected._
- **Are the 62 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 62 INFERRED edges - model-reasoned connections that need verification._