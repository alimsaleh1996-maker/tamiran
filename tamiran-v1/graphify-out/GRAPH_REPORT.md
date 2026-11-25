# Graph Report - tamiran-v1  (2026-11-25)

## Corpus Check
- 155 files · ~157,132 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 10, (none) 8, .woff2 3)

## Summary
- 1474 nodes · 4368 edges · 82 communities (56 shown, 26 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 977 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c98a61c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- technician-service.php
- catalog-import.tsx
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
- synthetic_imei
- modules.tsx
- expect
- case-tools.tsx
- TamiranApiException
- ModuleRouter
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- technical-case-workspace.tsx
- SectionTitle
- tamiran_audit
- access.tsx
- tamiran_require_csrf
- followups.php
- ReceptionPage
- tamiran_config
- شواهد نسخهٔ PHP تعمیران
- BackupSection
- compilerOptions
- package.py
- CentralAdminPanel
- CHANGELOG.md
- reception-ui-contract.ts
- reception-draft-mutations.ts
- customer-portal.tsx
- catalog-similarity.php
- DATABASE-MIGRATIONS.md
- captcha_audio.py
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- issue_once_concurrently
- SalesSection
- services_test.php
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
- PriceCatalogSection
- {closure#2}
- tamiran_captcha_audio
- delivery_warranty_case
- quality_run
- آزمون‌های نسخهٔ توسعه
- version.ts

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 213 edges
2. `tamiran_id()` - 60 edges
3. `tamiran_audit()` - 55 edges
4. `v2_text()` - 54 edges
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
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `admin_shop_summary()` --calls--> `tamiran_license_state()`  [INFERRED]
  hosting/public_html/api/admin.php → hosting/public_html/api/bootstrap.php

## Import Cycles
- None detected.

## Communities (82 total, 26 thin omitted)

### Community 0 - "technician-service.php"
Cohesion: 0.30
Nodes (20): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_editable(), technician_event() (+12 more)

### Community 1 - "catalog-import.tsx"
Cohesion: 0.06
Nodes (42): fflate@0.8.3, document, localVite, output, result, root, layers, lock() (+34 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.06
Nodes (63): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, isDraftVersionConflict(), AccessSessionLoader(), CapabilityCatalog(), stateLabels (+55 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (42): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+34 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.07
Nodes (57): directAdminRequest(), matchesQueueSearch(), technicalCaseFromLocation(), deliveryV2Action(), financeV2Action(), handoverDiscrepancy(), inventoryControlV2Action(), jsonPost() (+49 more)

### Community 5 - "v2_case"
Cohesion: 0.20
Nodes (23): v2_case(), v2_json(), v2_notify(), tamiran_request_id(), {closure#7}(), workflow_v2_active_technician(), workflow_v2_activity(), workflow_v2_add_collaborator() (+15 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (3): upload(), main(), svg_captcha()

### Community 7 - "operations.php"
Cohesion: 0.11
Nodes (22): {closure#10}(), {closure#13}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_select(), operations_case_to_api(), operations_cases() (+14 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (41): AdminModalState, AdminSection, adminSections, billingPeriodLabels, digitMap, EditableInvoiceItem, emptyDashboard, initialDueDate (+33 more)

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
Cohesion: 0.12
Nodes (21): {closure#5}(), tamiran_actor(), tamiran_credential_stamp(), tamiran_db(), tamiran_domain_root(), tamiran_forget_actor(), tamiran_license_state(), tamiran_log() (+13 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (23): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+15 more)

### Community 14 - "synthetic_imei"
Cohesion: 0.11
Nodes (20): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+12 more)

### Community 15 - "modules.tsx"
Cohesion: 0.07
Nodes (33): qrcode@1.5.4, CompactReceipt(), CompactReceiptProps, dateText(), RECEIPT_CSS, Address, CustomerAddress(), FollowUpKind (+25 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (20): expect(), main(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced() (+12 more)

### Community 17 - "case-tools.tsx"
Cohesion: 0.10
Nodes (22): dependencies, lucide-react@1.31.0, react@19.2.6, react-dom@19.2.6, ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary (+14 more)

### Community 18 - "TamiranApiException"
Cohesion: 0.14
Nodes (30): v2_require_capability(), auth_change_initial_password(), tamiran_encrypt_secret(), tamiran_json_body(), tamiran_require_csrf(), TamiranApiException, tamiran_captcha_image(), {closure#1}() (+22 more)

### Community 19 - "ModuleRouter"
Cohesion: 0.33
Nodes (22): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+14 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.16
Nodes (26): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+18 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.21
Nodes (22): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "{closure#1}"
Cohesion: 0.19
Nodes (16): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_decrypt_secret(), tamiran_digits(), tamiran_encryption_key() (+8 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (16): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+8 more)

### Community 25 - "technical-case-workspace.tsx"
Cohesion: 0.09
Nodes (45): WorkspaceProfile, formatToman(), MoneyInput(), moneyDigits(), tomanToRials(), OperationsCaseWorkspace(), Task, tasks (+37 more)

### Community 26 - "SectionTitle"
Cohesion: 0.22
Nodes (16): printCompactReceipt(), saveShopSetting(), updateShopSettings(), AccountSettings(), Field(), InventorySettings(), ReceiptSettings(), SectionTitle() (+8 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.27
Nodes (22): v2_require_permission(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload(), inventory_hot_review() (+14 more)

### Community 28 - "access.tsx"
Cohesion: 0.13
Nodes (25): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+17 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.29
Nodes (14): auth_begin_actor(), auth_candidate_users(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check(), auth_throttle_failure() (+6 more)

### Community 30 - "followups.php"
Cohesion: 0.10
Nodes (36): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+28 more)

### Community 31 - "ReceptionPage"
Cohesion: 0.19
Nodes (15): displayDeviceType(), createCatalogItem(), discardReceptionDraft(), loadCatalog(), lookupCustomer(), saveReceptionDraft(), updateCatalogItem(), BaseDataSettings() (+7 more)

### Community 32 - "tamiran_config"
Cohesion: 0.22
Nodes (11): tamiran_api(), tamiran_config(), tamiran_csrf_token(), tamiran_fail(), tamiran_is_https(), tamiran_log_response(), tamiran_require_https(), tamiran_respond() (+3 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "BackupSection"
Cohesion: 0.17
Nodes (12): BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel(), formatBytes(), cleanupBackups(), loadBackups(), previewBackupRestore() (+4 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "CentralAdminPanel"
Cohesion: 0.14
Nodes (17): AdminLoading(), AdminModal(), adminSectionFromLocation(), CentralAdminPanel(), errorMessage(), ProductChangeFlow(), SupportTickets(), UserForm() (+9 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.50
Nodes (3): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3

### Community 39 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 40 - "reception-draft-mutations.ts"
Cohesion: 0.24
Nodes (9): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue, ReceptionDraftReference (+1 more)

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
Cohesion: 0.18
Nodes (21): AdminEmpty(), AdminOverview(), daysRemaining(), formatDate(), initials(), InvoiceCatalogForm(), InvoiceDetails(), InvoiceDocument() (+13 more)

### Community 50 - "services_test.php"
Cohesion: 0.40
Nodes (5): check(), {closure#1}(), {closure#2}(), {closure#3}(), denied()

### Community 52 - "tamiran_require_actor"
Cohesion: 0.29
Nodes (4): tamiran_require_central_admin(), {closure#1}(), {closure#2}(), price_catalog_rows()

### Community 72 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "finance_issue"
Cohesion: 0.40
Nodes (12): technician_unrepaired(), v2_financial_event(), tamiran_id(), {closure#2}(), finance_advance_readiness(), finance_draft_items(), finance_invoice_case(), finance_issue() (+4 more)

### Community 75 - "PriceCatalogSection"
Cohesion: 0.50
Nodes (4): formatMoney(), PriceCatalogSection(), createPriceVersion(), loadPriceCatalog()

### Community 76 - "{closure#2}"
Cohesion: 0.44
Nodes (9): v2_stock_mutate(), {closure#1}(), {closure#2}(), inventory_v2_finalize_issue(), inventory_v2_issue(), inventory_v2_payload(), inventory_v2_reject_or_cancel(), inventory_v2_request() (+1 more)

### Community 78 - "delivery_warranty_case"
Cohesion: 0.27
Nodes (6): tamiran_tracking_token(), tamiran_uuid_v7(), {closure#4}(), delivery_payload(), delivery_report_discrepancy(), delivery_warranty_case()

### Community 81 - "quality_run"
Cohesion: 0.54
Nodes (6): v2_has_permission(), {closure#1}(), quality_ack(), quality_payload(), quality_route_after_run(), quality_run()

### Community 85 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.40
Nodes (4): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, آزمون‌های نسخهٔ توسعه

### Community 86 - "version.ts"
Cohesion: 0.50
Nodes (3): APP_BUILD_ID, APP_CHANNEL, APP_VERSION

## Knowledge Gaps
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `technician-service.php`, `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `tamiran_config`, `catalog-similarity.php`, `tamiran_require_actor`, `finance_issue`, `{closure#2}`, `tamiran_captcha_audio`, `delivery_warranty_case`, `quality_run`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 191 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 191 INFERRED edges - model-reasoned connections that need verification._
- **Should `catalog-import.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.058445353594389245 - nodes in this community are weakly interconnected._
- **Why does `react` connect `case-tools.tsx` to `catalog-import.tsx`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `customer-portal.tsx`, `shop-users.tsx`, `modules.tsx`, `package.json`, `persian-date.ts`, `technical-case-workspace.tsx`, `access.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 57 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05711849957374254 - nodes in this community are weakly interconnected._
- **Are the 48 inferred relationships involving `tamiran_audit()` (e.g. with `technician_event()` and `v2_delivery_identity()`) actually correct?**
  _`tamiran_audit()` has 48 INFERRED edges - model-reasoned connections that need verification._