# Graph Report - tamiran-v1  (2026-11-27)

## Corpus Check
- 168 files · ~188,592 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1760 nodes · 5269 edges · 89 communities (67 shown, 22 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1156 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cddfc07f`
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
- bootstrap.php
- backup-engine.php
- compact-receipt.tsx
- modules.tsx
- expect
- workflowV2Action
- run
- workflow-v2.php
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- finance-case-view.tsx
- operations_policy
- customer-portal.tsx
- ModuleRouter
- {closure#2}
- followups.php
- catalog-import.tsx
- manager-operations.tsx
- شواهد نسخهٔ PHP تعمیران
- external_purchase_change
- compilerOptions
- package.py
- client-diagnostics.ts
- CHANGELOG.md
- directadmin-api.ts
- v2_text
- useModalFocus
- tamiran_captcha_audio
- DATABASE-MIGRATIONS.md
- moduleErrorMessage
- check_quality_browser
- package_test.py
- issue_once_concurrently
- {closure#1}
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
- technical-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- TamiranApiException
- quality_run
- ReceptionPage
- catalog-similarity.ts
- jsonPost
- case_invoice_correct
- synthetic_imei
- catalog-similarity.php
- build.mjs
- expect
- dependencies
- design-qa.md

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 239 edges
2. `v2_text()` - 70 edges
3. `tamiran_id()` - 64 edges
4. `tamiran_audit()` - 61 edges
5. `expect()` - 55 edges
6. `v2_require_permission()` - 49 edges
7. `v2_case()` - 49 edges
8. `Client` - 49 edges
9. `tamiran_db()` - 40 edges
10. `Home()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `API، داده و ابزارها` --references--> `v2_case()`  [INFERRED]
  docs/STABILIZATION-FA.md → hosting/private/v2-core.php
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php
- `admin_shop_summary()` --calls--> `tamiran_license_state()`  [INFERRED]
  hosting/public_html/api/admin.php → hosting/public_html/api/bootstrap.php
- `{closure#1}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php

## Import Cycles
- None detected.

## Communities (89 total, 22 thin omitted)

### Community 0 - "access.tsx"
Cohesion: 0.15
Nodes (22): diagnosticFetch(), accessErrorMessage(), AccessGateway(), AccessSessionLoader(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels (+14 more)

### Community 1 - "MoneyInput"
Cohesion: 0.22
Nodes (16): fa, ProcurementDocuments(), ProcurementForm(), ReceiveDocument(), Run, statusLabels, formatToman(), MoneyInput() (+8 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (43): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, CapabilitySnapshot, createInventoryItem(), createPartRequest(), createRepairCase() (+35 more)

### Community 3 - "{closure#2}"
Cohesion: 0.10
Nodes (28): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+20 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.08
Nodes (53): directAdminRequest(), isOpenFinanceInvoice(), formatHandoverTime(), printHandoverReceipt(), timeFormatter, matchesQueueSearch(), normalizeQueueSearch(), queueTimestamp() (+45 more)

### Community 5 - "v2_case"
Cohesion: 0.28
Nodes (22): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_declared_issues(), technician_device_password() (+14 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (5): check(), save(), upload(), main(), main()

### Community 7 - "operations.php"
Cohesion: 0.10
Nodes (40): tamiran_encrypt_secret(), tamiran_tracking_token(), tamiran_uuid_v7(), tamiran_validate_national_code(), {closure#10}(), {closure#13}(), {closure#14}(), {closure#2}() (+32 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (81): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+73 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.12
Nodes (21): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+13 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.04
Nodes (44): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+36 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.08
Nodes (43): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+35 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (23): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+15 more)

### Community 14 - "compact-receipt.tsx"
Cohesion: 0.21
Nodes (14): CompactReceipt(), CompactReceiptProps, dateText(), DEFAULT_RECEIPT_SIZE, RECEIPT_CSS, IntakeReceiptDetails, formatPersianDate(), date (+6 more)

### Community 15 - "modules.tsx"
Cohesion: 0.06
Nodes (42): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), Address, CustomerAddress(), defaultAppearanceStates, defaultDeviceColors, DeviceColorOption (+34 more)

### Community 16 - "expect"
Cohesion: 0.18
Nodes (11): run(), assert_true(), back(), check(), create(), no_complexity(), receive(), row() (+3 more)

### Community 17 - "workflowV2Action"
Cohesion: 0.15
Nodes (18): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), disposals, ExternalPurchasePanel(), addCatalog(), submit() (+10 more)

### Community 18 - "run"
Cohesion: 0.18
Nodes (10): run(), check_cashier_invoice(), create(), estimate(), finish(), projection(), queued_case(), receive() (+2 more)

### Community 19 - "workflow-v2.php"
Cohesion: 0.18
Nodes (25): external_purchase_catalog(), v2_case(), v2_json(), v2_notify(), v2_require_case_access(), {closure#8}(), workflow_v2_active_technician(), workflow_v2_activity() (+17 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.17
Nodes (24): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+16 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.20
Nodes (22): InvoiceCatalogForm(), addGregorianDays(), addPersianMonths(), daysInPersianMonth(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "{closure#1}"
Cohesion: 0.11
Nodes (27): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_config(), tamiran_decrypt_secret(), tamiran_digits() (+19 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (15): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+7 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.13
Nodes (25): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), Line (+17 more)

### Community 26 - "operations_policy"
Cohesion: 0.18
Nodes (14): manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_report_cases(), manager_report_dates(), manager_report_params(), manager_report_sources(), manager_update_case() (+6 more)

### Community 27 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.34
Nodes (21): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+13 more)

### Community 29 - "{closure#2}"
Cohesion: 0.24
Nodes (9): admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_shop_summary(), admin_temporary_password(), admin_text() (+1 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "catalog-import.tsx"
Cohesion: 0.23
Nodes (12): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), columnIndex() (+4 more)

### Community 32 - "manager-operations.tsx"
Cohesion: 0.08
Nodes (39): fa(), FollowReason, followTitles, ManagerPulse(), OperationsFollowups(), loadMore(), openCase(), saveNote() (+31 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "external_purchase_change"
Cohesion: 0.33
Nodes (7): external_purchase_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_requires_customer_authorization(), external_purchase_rows(), external_purchase_view()

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.18
Nodes (11): digest(), git(), main(), release_manifest(), release_source(), release_version(), required(), runtime_files() (+3 more)

### Community 37 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 38 - "CHANGELOG.md"
Cohesion: 0.10
Nodes (18): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+10 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.08
Nodes (26): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+18 more)

### Community 40 - "v2_text"
Cohesion: 0.16
Nodes (35): v2_require_capability(), v2_require_permission(), v2_stock_mutate(), v2_text(), tamiran_audit(), delivery_report_discrepancy(), delivery_warranty_case(), {closure#2}() (+27 more)

### Community 41 - "useModalFocus"
Cohesion: 0.38
Nodes (6): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog()

### Community 44 - "moduleErrorMessage"
Cohesion: 0.19
Nodes (21): printCompactReceipt(), saveShopSetting(), updateShopSettings(), OperationsPolicyForm(), save(), AccountSettings(), Field(), InventorySettings() (+13 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "{closure#1}"
Cohesion: 0.57
Nodes (5): {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.36
Nodes (5): CaseStageBoard(), initialStageForStatuses(), repairStages, stageForStatus(), vectors

### Community 51 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 52 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.14
Nodes (13): check_case_procurement(), check_cashier_referral(), check_finance_delivery_browser(), check_intake_print(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser(), check_supply_browser() (+5 more)

### Community 73 - "run"
Cohesion: 0.14
Nodes (14): run(), capture(), check(), create(), save(), simple(), visit(), yes() (+6 more)

### Community 74 - "tamiran_id"
Cohesion: 0.24
Nodes (19): technician_money(), technician_unrepaired(), v2_financial_event(), v2_open_case_advances(), tamiran_id(), {closure#5}(), finance_advance(), finance_advance_case_search() (+11 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.09
Nodes (43): blank(), costLabels, date(), diagnosisOptions, Draft, message(), normalizeClock(), TechnicalCaseWorkspace() (+35 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.06
Nodes (28): انتشار, خواندن نسخهٔ هاست, مسیر انتشار نسل جدید, API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12, سابقهٔ پیاده‌سازی و آزمون, فهرست پیگیری بر اساس ممیزی مستقل rc.13 (+20 more)

### Community 79 - "{closure#1}"
Cohesion: 0.22
Nodes (9): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+1 more)

### Community 80 - "TamiranApiException"
Cohesion: 0.09
Nodes (34): v2_scope(), tamiran_db(), tamiran_json_body(), tamiran_require_actor(), tamiran_require_central_admin(), tamiran_require_csrf(), tamiran_require_shop_manager(), tamiran_require_writable_actor() (+26 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 83 - "ReceptionPage"
Cohesion: 0.18
Nodes (14): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, createCatalogItem(), updateCatalogItem(), BaseDataSettings(), normalizeDeviceColors() (+6 more)

### Community 84 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 85 - "jsonPost"
Cohesion: 0.15
Nodes (19): WorkspaceProfile, accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp(), submit(), deliveryImeiError(), evidenceMethods (+11 more)

### Community 86 - "case_invoice_correct"
Cohesion: 0.38
Nodes (8): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line()

### Community 87 - "synthetic_imei"
Cohesion: 0.27
Nodes (7): run(), run(), Runner, run(), create(), receive(), row()

### Community 88 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 89 - "build.mjs"
Cohesion: 0.18
Nodes (5): document, localVite, output, result, root

### Community 90 - "expect"
Cohesion: 0.16
Nodes (13): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+5 more)

### Community 91 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, qrcode, react-dom

## Knowledge Gaps
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `workflow-v2.php`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `operations_policy`, `{closure#2}`, `followups.php`, `external_purchase_change`, `v2_text`, `tamiran_captcha_audio`, `{closure#1}`, `tamiran_id`, `{closure#1}`, `quality_run`, `case_invoice_correct`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 217 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 217 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06753006475485661 - nodes in this community are weakly interconnected._
- **Why does `react` connect `technical-case-workspace.tsx` to `access.tsx`, `MoneyInput`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `compact-receipt.tsx`, `modules.tsx`, `workflowV2Action`, `package.json`, `persian-date.ts`, `finance-case-view.tsx`, `customer-portal.tsx`, `catalog-import.tsx`, `manager-operations.tsx`, `client-diagnostics.ts`, `useModalFocus`, `case-stage-board.tsx`, `shop-users.tsx`, `jsonPost`, `dependencies`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 67 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 67 INFERRED edges - model-reasoned connections that need verification._
- **Should `{closure#2}` be split into smaller, more focused modules?**
  _Cohesion score 0.10365853658536585 - nodes in this community are weakly interconnected._
- **Are the 61 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 61 INFERRED edges - model-reasoned connections that need verification._