# Graph Report - tamiran-v1  (2026-11-26)

## Corpus Check
- 164 files · ~169,110 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: .css 11, (none) 8, .woff2 3)

## Summary
- 1577 nodes · 4743 edges · 94 communities (67 shown, 27 thin omitted)
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 1078 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6517d49b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- case_invoice_correct
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
- client-diagnostics.ts
- tamiran_json_body
- v2-api.ts
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- technical-case-workspace.tsx
- technician-workbench.tsx
- tamiran_audit
- access.tsx
- tamiran_require_csrf
- followups.php
- compact-receipt.tsx
- manager-operations.tsx
- شواهد نسخهٔ PHP تعمیران
- external_purchase_change
- compilerOptions
- package.py
- ModuleRouter
- CHANGELOG.md
- CentralAdminPanel
- workflowV2Action
- customer-portal.tsx
- catalog-similarity.php
- DATABASE-MIGRATIONS.md
- {closure#2}
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- {closure#2}
- TamiranApiException
- run
- KNOWN-ISSUES.md
- ReceptionPage
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- README.md
- run
- run
- finance_issue
- moduleErrorMessage
- case-stage-board.tsx
- shop-users.tsx
- {closure#1}
- reception-draft-mutations.ts
- reception-ui-contract.ts
- quality_run
- catalog-similarity.ts
- build.mjs
- directAdminRequest
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- run
- captcha_audio.py
- tamiran_captcha_audio
- services_test.php
- case-mutations.ts
- {closure#1}
- design-qa.md

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 230 edges
2. `v2_text()` - 64 edges
3. `tamiran_id()` - 64 edges
4. `tamiran_audit()` - 60 edges
5. `Client` - 49 edges
6. `expect()` - 49 edges
7. `v2_require_permission()` - 41 edges
8. `v2_case()` - 41 edges
9. `tamiran_db()` - 40 edges
10. `tamiran_require_csrf()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php
- `technician_projection()` --calls--> `case_invoice_public()`  [INFERRED]
  hosting/private/technician-service.php → hosting/private/case-invoice.php
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php

## Import Cycles
- None detected.

## Communities (94 total, 27 thin omitted)

### Community 0 - "case_invoice_correct"
Cohesion: 0.36
Nodes (8): case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line(), technician_money()

### Community 1 - "catalog-import.tsx"
Cohesion: 0.23
Nodes (12): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), columnIndex() (+4 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.08
Nodes (40): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), CapabilityCatalog(), stateLabels, CapabilitySnapshot (+32 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (37): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+29 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.11
Nodes (34): deliveryV2Action(), financeV2Action(), inventoryControlV2Action(), loadV2Delivery(), loadV2Finance(), loadV2Inventory(), loadV2InventoryControl(), loadV2Quality() (+26 more)

### Community 5 - "v2_case"
Cohesion: 0.15
Nodes (38): manager_update_case(), technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_diagnosis() (+30 more)

### Community 6 - "smoke.py"
Cohesion: 0.09
Nodes (6): upload(), main(), main(), issue_once_concurrently(), main(), svg_captcha()

### Community 7 - "operations.php"
Cohesion: 0.11
Nodes (22): {closure#10}(), {closure#13}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_select(), operations_case_to_api(), operations_cases() (+14 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.04
Nodes (76): AdminLoading(), AdminModalState, AdminSection, adminSections, BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel() (+68 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.13
Nodes (20): manager_for(), run(), shop(), submit(), run(), ready(), sql(), run() (+12 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.05
Nodes (33): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+25 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.10
Nodes (29): {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_db(), tamiran_domain_root(), tamiran_fail(), tamiran_forget_actor(), tamiran_is_https() (+21 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (22): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+14 more)

### Community 14 - "synthetic_imei"
Cohesion: 0.11
Nodes (19): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+11 more)

### Community 15 - "modules.tsx"
Cohesion: 0.07
Nodes (35): Address, CustomerAddress(), defaultAppearanceStates, defaultDeviceColors, DeviceColorOption, EmptyState(), followUpHistoryBody(), hotReturnLabels (+27 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+11 more)

### Community 17 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 18 - "tamiran_json_body"
Cohesion: 0.15
Nodes (17): tamiran_json_body(), tamiran_require_actor(), tamiran_require_shop_manager(), tamiran_require_writable_actor(), catalog_rows(), catalog_value(), {closure#1}(), {closure#2}() (+9 more)

### Community 19 - "v2-api.ts"
Cohesion: 0.10
Nodes (25): OperationsCaseWorkspace(), Task, tasks, createV2Estimate(), jsonPost(), OperationsFollowupReason, procurementV2Action(), sendV2Estimate() (+17 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.12
Nodes (31): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+23 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.21
Nodes (22): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "{closure#1}"
Cohesion: 0.16
Nodes (20): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, admin_user_mobile(), tamiran_client_ip(), tamiran_config() (+12 more)

### Community 24 - "admin-users.php"
Cohesion: 0.19
Nodes (13): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_payload(), {closure#9}(), shop_user_assert_managed() (+5 more)

### Community 25 - "technical-case-workspace.tsx"
Cohesion: 0.18
Nodes (23): formatToman(), MoneyInput(), moneyDigits(), tomanToRials(), blank(), costLabels, date(), Draft (+15 more)

### Community 26 - "technician-workbench.tsx"
Cohesion: 0.19
Nodes (17): readTechnicalScreen(), technicalCaseFromLocation(), TechnicalScreen, technicalScreens, technicalStageScreen(), writeTechnicalLocation(), HandoverItems(), HandoverSummary() (+9 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.25
Nodes (24): v2_require_permission(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload(), inventory_hot_review() (+16 more)

### Community 28 - "access.tsx"
Cohesion: 0.10
Nodes (31): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+23 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.20
Nodes (19): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+11 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "compact-receipt.tsx"
Cohesion: 0.12
Nodes (21): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, WorkspaceProfile, CompactReceipt(), CompactReceiptProps, dateText() (+13 more)

### Community 32 - "manager-operations.tsx"
Cohesion: 0.15
Nodes (17): fa(), FollowReason, followTitles, OperationsFollowups(), loadMore(), openCase(), saveNote(), OperationsPerformance() (+9 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "external_purchase_change"
Cohesion: 0.18
Nodes (12): external_purchase_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_rows(), external_purchase_view(), manager_followup_queue(), manager_operations_report() (+4 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "ModuleRouter"
Cohesion: 0.36
Nodes (20): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+12 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.29
Nodes (6): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.2, تغییرات 1.0.0-rc.3

### Community 39 - "CentralAdminPanel"
Cohesion: 0.19
Nodes (26): AdminEmpty(), AdminModal(), AdminOverview(), adminSectionFromLocation(), CentralAdminPanel(), daysRemaining(), errorMessage(), formatDate() (+18 more)

### Community 40 - "workflowV2Action"
Cohesion: 0.24
Nodes (11): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), changeExternalPurchase(), ExternalPurchase (+3 more)

### Community 41 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 42 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 48 - "{closure#2}"
Cohesion: 0.39
Nodes (10): v2_notify(), v2_stock_mutate(), {closure#1}(), {closure#2}(), inventory_v2_finalize_issue(), inventory_v2_issue(), inventory_v2_payload(), inventory_v2_reject_or_cancel() (+2 more)

### Community 49 - "TamiranApiException"
Cohesion: 0.17
Nodes (26): technician_require_receipt(), v2_require_capability(), tamiran_encrypt_secret(), tamiran_require_csrf(), TamiranApiException, tamiran_captcha_image(), {closure#1}(), {closure#14}() (+18 more)

### Community 50 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 52 - "ReceptionPage"
Cohesion: 0.14
Nodes (16): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, printCompactReceipt(), discardReceptionDraft(), lookupCustomer(), saveReceptionDraft() (+8 more)

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.29
Nodes (7): check_operations_browser(), check_quality_browser(), open_as(), run(), command(), create(), row()

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "finance_issue"
Cohesion: 0.40
Nodes (12): technician_unrepaired(), v2_financial_event(), tamiran_id(), {closure#2}(), finance_advance_readiness(), finance_draft_items(), finance_invoice_case(), finance_issue() (+4 more)

### Community 75 - "moduleErrorMessage"
Cohesion: 0.23
Nodes (19): createCatalogItem(), saveShopSetting(), updateCatalogItem(), updateShopSettings(), AccountSettings(), BaseDataSettings(), InventorySettings(), moduleErrorMessage() (+11 more)

### Community 76 - "case-stage-board.tsx"
Cohesion: 0.23
Nodes (12): react-dom@19.2.6, layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard() (+4 more)

### Community 77 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 78 - "{closure#1}"
Cohesion: 0.35
Nodes (10): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+2 more)

### Community 79 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 80 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 81 - "quality_run"
Cohesion: 0.43
Nodes (12): v2_has_permission(), {closure#1}(), quality_ack(), quality_authorize_case(), quality_payload(), quality_receipt(), quality_replace_template(), quality_result_row() (+4 more)

### Community 82 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 83 - "build.mjs"
Cohesion: 0.14
Nodes (6): document, localVite, output, result, root, vectors

### Community 84 - "directAdminRequest"
Cohesion: 0.24
Nodes (9): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), directAdminRequest(), loadTechnicalActivities(), loadTechnicalCase(), loadV2Procurement() (+1 more)

### Community 85 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.25
Nodes (7): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, آزمون‌های نسخهٔ توسعه

### Community 86 - "{closure#1}"
Cohesion: 0.57
Nodes (5): {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 87 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 90 - "services_test.php"
Cohesion: 0.40
Nodes (5): check(), {closure#1}(), {closure#2}(), {closure#3}(), denied()

### Community 91 - "case-mutations.ts"
Cohesion: 0.50
Nodes (4): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), RepairCaseStatus

## Knowledge Gaps
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `case_invoice_correct`, `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `tamiran_json_body`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `external_purchase_change`, `{closure#2}`, `{closure#2}`, `finance_issue`, `{closure#1}`, `quality_run`, `{closure#1}`, `tamiran_captcha_audio`, `{closure#1}`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Are the 208 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 208 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07822410147991543 - nodes in this community are weakly interconnected._
- **Why does `react` connect `technical-case-workspace.tsx` to `manager-operations.tsx`, `catalog-import.tsx`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `customer-portal.tsx`, `workflowV2Action`, `case-stage-board.tsx`, `shop-users.tsx`, `modules.tsx`, `client-diagnostics.ts`, `v2-api.ts`, `package.json`, `directAdminRequest`, `persian-date.ts`, `technician-workbench.tsx`, `access.tsx`, `compact-receipt.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Should `{closure#2}` be split into smaller, more focused modules?**
  _Cohesion score 0.07474747474747474 - nodes in this community are weakly interconnected._
- **Are the 61 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 61 INFERRED edges - model-reasoned connections that need verification._