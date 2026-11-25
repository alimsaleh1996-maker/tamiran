# Graph Report - tamiran-v1  (2026-11-25)

## Corpus Check
- 155 files · ~155,282 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 10, (none) 8, .woff2 3)

## Summary
- 1456 nodes · 4321 edges · 87 communities (60 shown, 27 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 970 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `03429833`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- tamiran_id
- catalog-import.tsx
- page.tsx
- {closure#2}
- v2-workspace.tsx
- technical-case-workspace.tsx
- smoke.py
- operations.php
- admin-panel.tsx
- installer_test.php
- Client
- نصب تعمیران روی هاست PHP
- bootstrap.php
- backup-engine.php
- synthetic_imei
- modules.tsx
- expect
- case-tools.tsx
- TamiranApiException
- directadmin-api.ts
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- TechnicalCaseWorkspace
- v2-api.ts
- tamiran_audit
- access.tsx
- tamiran_require_csrf
- followups.php
- react
- operations.ts
- شواهد نسخهٔ PHP تعمیران
- followups-api.ts
- compilerOptions
- package.py
- CentralAdminPanel
- CHANGELOG.md
- reception-ui-contract.ts
- {closure#1}
- customer-portal.tsx
- catalog-similarity.php
- DATABASE-MIGRATIONS.md
- captcha_audio.py
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- issue_once_concurrently
- SalesSection
- case-stage-board.tsx
- KNOWN-ISSUES.md
- tamiran_require_actor
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- README.md
- shop-users.tsx
- run
- finance_issue
- catalog-similarity.ts
- {closure#2}
- tamiran_db
- delivery_warranty_case
- build.mjs
- AdminEmpty
- quality_run
- capabilities.tsx
- frontend_contracts.test.mjs
- operational-bootstrap.ts
- آزمون‌های نسخهٔ توسعه
- version.ts

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 211 edges
2. `tamiran_id()` - 60 edges
3. `tamiran_audit()` - 55 edges
4. `v2_text()` - 53 edges
5. `Client` - 45 edges
6. `expect()` - 45 edges
7. `tamiran_db()` - 40 edges
8. `tamiran_require_csrf()` - 40 edges
9. `Home()` - 39 edges
10. `v2_require_permission()` - 38 edges

## Surprising Connections (you probably didn't know these)
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php
- `admin_shop_summary()` --calls--> `tamiran_license_state()`  [INFERRED]
  hosting/public_html/api/admin.php → hosting/public_html/api/bootstrap.php
- `{closure#1}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php
- `operations_create_case()` --calls--> `tamiran_validate_national_code()`  [INFERRED]
  hosting/public_html/api/operations.php → hosting/public_html/api/bootstrap.php

## Import Cycles
- None detected.

## Communities (87 total, 27 thin omitted)

### Community 0 - "tamiran_id"
Cohesion: 0.17
Nodes (36): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_editable(), technician_event() (+28 more)

### Community 1 - "catalog-import.tsx"
Cohesion: 0.22
Nodes (13): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), normalizeQueueSearch() (+5 more)

### Community 2 - "page.tsx"
Cohesion: 0.13
Nodes (26): AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase(), isDirectAdminConflict(), loadCapabilities(), loadOperations(), loadRepairCase() (+18 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (42): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+34 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.14
Nodes (26): createV2Estimate(), deliveryV2Action(), financeV2Action(), inventoryControlV2Action(), jsonPost(), procurementV2Action(), qualityV2Action(), sendV2Estimate() (+18 more)

### Community 5 - "technical-case-workspace.tsx"
Cohesion: 0.26
Nodes (15): formatToman(), MoneyInput(), moneyDigits(), tomanToRials(), blank(), costLabels, Draft, titles (+7 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (3): upload(), main(), svg_captcha()

### Community 7 - "operations.php"
Cohesion: 0.12
Nodes (19): {closure#10}(), {closure#13}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_select(), operations_case_to_api(), operations_cases() (+11 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.06
Nodes (40): AdminModalState, AdminSection, adminSections, BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel(), billingPeriodLabels (+32 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.12
Nodes (23): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+15 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.06
Nodes (32): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+24 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.11
Nodes (26): {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_config(), tamiran_csrf_token(), tamiran_domain_root(), tamiran_encryption_key(), tamiran_fail() (+18 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.17
Nodes (25): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+17 more)

### Community 14 - "synthetic_imei"
Cohesion: 0.11
Nodes (20): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+12 more)

### Community 15 - "modules.tsx"
Cohesion: 0.06
Nodes (88): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+80 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (20): expect(), main(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced() (+12 more)

### Community 17 - "case-tools.tsx"
Cohesion: 0.09
Nodes (27): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, WorkspaceProfile, Activity, Attachment, CaseTools() (+19 more)

### Community 18 - "TamiranApiException"
Cohesion: 0.13
Nodes (32): technician_require_receipt(), v2_identity_value(), v2_require_capability(), v2_scope(), tamiran_encrypt_secret(), tamiran_json_body(), tamiran_mobile(), tamiran_require_csrf() (+24 more)

### Community 19 - "directadmin-api.ts"
Cohesion: 0.09
Nodes (23): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+15 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.17
Nodes (25): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+17 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.20
Nodes (23): InvoiceCatalogForm(), addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay() (+15 more)

### Community 23 - "{closure#1}"
Cohesion: 0.14
Nodes (19): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_decrypt_secret(), tamiran_digits(), tamiran_public_rate_limit() (+11 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (15): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+7 more)

### Community 25 - "TechnicalCaseWorkspace"
Cohesion: 0.16
Nodes (20): OperationsCaseWorkspace(), Task, tasks, date(), message(), TechnicalCaseWorkspace(), readTechnicalScreen(), technicalCaseFromLocation() (+12 more)

### Community 26 - "v2-api.ts"
Cohesion: 0.10
Nodes (29): directAdminRequest(), loadTechnicalActivities(), loadTechnicalCase(), loadV2Delivery(), loadV2Finance(), loadV2Inventory(), loadV2InventoryControl(), loadV2Procurement() (+21 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.25
Nodes (24): v2_require_permission(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload(), inventory_hot_review() (+16 more)

### Community 28 - "access.tsx"
Cohesion: 0.22
Nodes (12): accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword(), completeLogin() (+4 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.25
Nodes (17): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+9 more)

### Community 30 - "followups.php"
Cohesion: 0.25
Nodes (18): tamiran_require_writable_actor(), {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get() (+10 more)

### Community 31 - "react"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 32 - "operations.ts"
Cohesion: 0.10
Nodes (19): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), CreateInventoryItemInput, CreatePartRequestInput, CreateRepairCaseInput, CustomerLookupResult, emptyOperationalSnapshot (+11 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "followups-api.ts"
Cohesion: 0.18
Nodes (16): diagnosticFetch(), ApiEnvelope, createFollowUp(), getCsrfToken(), loadFollowUps(), mutateFollowUp(), parseResponse(), updateFollowUp() (+8 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "CentralAdminPanel"
Cohesion: 0.14
Nodes (17): AdminLoading(), AdminModal(), adminSectionFromLocation(), CentralAdminPanel(), errorMessage(), PriceCatalogSection(), SupportTickets(), UserForm() (+9 more)

### Community 39 - "reception-ui-contract.ts"
Cohesion: 0.27
Nodes (9): ActiveReceiptTerms, buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection, ReceiptAcceptance, receiptTermsKey() (+1 more)

### Community 40 - "{closure#1}"
Cohesion: 0.20
Nodes (15): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+7 more)

### Community 41 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 42 - "catalog-similarity.php"
Cohesion: 0.28
Nodes (12): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+4 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "SalesSection"
Cohesion: 0.17
Nodes (15): formatMoney(), InvoiceDetails(), InvoiceDocument(), invoiceItemsForShop(), ProductChangeFlow(), productLabel(), SalesSection(), ShopFormV4() (+7 more)

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.23
Nodes (12): react-dom@19.2.6, layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard() (+4 more)

### Community 52 - "tamiran_require_actor"
Cohesion: 0.16
Nodes (10): tamiran_require_actor(), tamiran_require_central_admin(), tamiran_require_shop_manager(), {closure#1}(), operations_scope(), {closure#2}(), price_catalog_rows(), {closure#1}() (+2 more)

### Community 72 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "finance_issue"
Cohesion: 0.41
Nodes (11): technician_unrepaired(), v2_financial_event(), {closure#2}(), finance_advance_readiness(), finance_draft_items(), finance_invoice_case(), finance_issue(), finance_payload() (+3 more)

### Community 75 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 76 - "{closure#2}"
Cohesion: 0.44
Nodes (9): v2_stock_mutate(), {closure#1}(), {closure#2}(), inventory_v2_finalize_issue(), inventory_v2_issue(), inventory_v2_payload(), inventory_v2_reject_or_cancel(), inventory_v2_request() (+1 more)

### Community 77 - "tamiran_db"
Cohesion: 0.29
Nodes (6): tamiran_db(), tamiran_native_sql(), tamiran_release_active_session(), tamiran_verify_stored_password(), TamiranPDO, TamiranPDOStatement

### Community 78 - "delivery_warranty_case"
Cohesion: 0.27
Nodes (6): tamiran_tracking_token(), tamiran_uuid_v7(), {closure#4}(), delivery_payload(), delivery_report_discrepancy(), delivery_warranty_case()

### Community 79 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 80 - "AdminEmpty"
Cohesion: 0.50
Nodes (9): AdminEmpty(), AdminOverview(), daysRemaining(), formatDate(), initials(), LicensesSection(), ShopsSection(), StatusBadge() (+1 more)

### Community 81 - "quality_run"
Cohesion: 0.54
Nodes (6): v2_has_permission(), {closure#1}(), quality_ack(), quality_payload(), quality_route_after_run(), quality_run()

### Community 82 - "capabilities.tsx"
Cohesion: 0.47
Nodes (5): CapabilityCatalog(), stateLabels, CapabilitySnapshot, recordCapabilityEvent(), requestModuleActivation()

### Community 84 - "operational-bootstrap.ts"
Cohesion: 0.50
Nodes (4): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders

### Community 85 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.50
Nodes (3): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, آزمون‌های نسخهٔ توسعه

### Community 86 - "version.ts"
Cohesion: 0.50
Nodes (3): APP_BUILD_ID, APP_CHANNEL, APP_VERSION

## Knowledge Gaps
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `tamiran_id`, `{closure#2}`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `{closure#1}`, `catalog-similarity.php`, `tamiran_require_actor`, `finance_issue`, `{closure#2}`, `tamiran_db`, `delivery_warranty_case`, `quality_run`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 189 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 189 INFERRED edges - model-reasoned connections that need verification._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13105413105413105 - nodes in this community are weakly interconnected._
- **Why does `react` connect `case-tools.tsx` to `catalog-import.tsx`, `page.tsx`, `v2-workspace.tsx`, `technical-case-workspace.tsx`, `admin-panel.tsx`, `customer-portal.tsx`, `shop-users.tsx`, `modules.tsx`, `case-stage-board.tsx`, `capabilities.tsx`, `package.json`, `persian-date.ts`, `TechnicalCaseWorkspace`, `access.tsx`, `react`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 57 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Should `{closure#2}` be split into smaller, more focused modules?**
  _Cohesion score 0.06610259122157588 - nodes in this community are weakly interconnected._
- **Are the 48 inferred relationships involving `tamiran_audit()` (e.g. with `technician_event()` and `v2_delivery_identity()`) actually correct?**
  _`tamiran_audit()` has 48 INFERRED edges - model-reasoned connections that need verification._