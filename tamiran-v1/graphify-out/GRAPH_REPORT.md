# Graph Report - tamiran-v1  (2026-11-26)

## Corpus Check
- 165 files · ~174,404 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .css 12, (none) 8, .woff2 3)

## Summary
- 1643 nodes · 4914 edges · 88 communities (64 shown, 24 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1103 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `91e93b56`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TamiranApiException
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
- client-diagnostics.ts
- modules.tsx
- expect
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- finance-case-view.tsx
- technical-case-workspace.tsx
- tamiran_audit
- access.tsx
- tamiran_require_csrf
- followups.php
- compact-receipt.tsx
- technician-workbench.tsx
- شواهد نسخهٔ PHP تعمیران
- external_purchase_change
- compilerOptions
- package.py
- catalog-similarity.ts
- CHANGELOG.md
- directadmin-api.ts
- ReceptionPage
- dependencies
- SectionTitle
- DATABASE-MIGRATIONS.md
- catalog-import.tsx
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- issue_once_concurrently
- shop-users.tsx
- tamiran_require_central_admin
- case-stage-board.tsx
- tamiran_db
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
- services_test.php
- آزمون‌های نسخهٔ توسعه
- delivery_warranty_case
- build.mjs
- quality_run
- run
- case-mutations.ts
- tamiran_captcha_audio
- scripts
- synthetic_imei
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

## Communities (88 total, 24 thin omitted)

### Community 0 - "TamiranApiException"
Cohesion: 0.12
Nodes (35): technician_require_receipt(), v2_require_capability(), v2_scope(), tamiran_encrypt_secret(), tamiran_json_body(), tamiran_require_csrf(), TamiranApiException, tamiran_captcha_image() (+27 more)

### Community 1 - "v2-api.ts"
Cohesion: 0.09
Nodes (26): fa, ProcurementDocuments(), ReceiveDocument(), Run, statusLabels, OperationsFollowupReason, procurementV2Action(), TechnicalActivity (+18 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.08
Nodes (39): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+31 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (42): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+34 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.10
Nodes (46): ProcurementForm(), directAdminRequest(), isOpenFinanceInvoice(), matchesQueueSearch(), deliveryV2Action(), inventoryControlV2Action(), jsonPost(), loadV2Delivery() (+38 more)

### Community 5 - "v2_case"
Cohesion: 0.15
Nodes (39): manager_update_case(), technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_diagnosis() (+31 more)

### Community 6 - "smoke.py"
Cohesion: 0.10
Nodes (5): check(), save(), upload(), main(), svg_captcha()

### Community 7 - "operations.php"
Cohesion: 0.12
Nodes (19): {closure#10}(), {closure#13}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_select(), operations_case_to_api(), operations_cases() (+11 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (82): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+74 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.11
Nodes (21): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+13 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.05
Nodes (38): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+30 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.12
Nodes (20): {closure#5}(), tamiran_api(), tamiran_domain_root(), tamiran_fail(), tamiran_is_https(), tamiran_log(), tamiran_log_response(), tamiran_request_id() (+12 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (23): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+15 more)

### Community 14 - "workflowV2Action"
Cohesion: 0.24
Nodes (11): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), changeExternalPurchase(), ExternalPurchase (+3 more)

### Community 15 - "ModuleRouter"
Cohesion: 0.31
Nodes (23): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+15 more)

### Community 16 - "expect"
Cohesion: 0.18
Nodes (11): run(), assert_true(), back(), check(), create(), no_complexity(), receive(), row() (+3 more)

### Community 17 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 18 - "modules.tsx"
Cohesion: 0.06
Nodes (37): Address, CustomerAddress(), defaultAppearanceStates, defaultDeviceColors, DeviceColorOption, EmptyState(), followUpHistoryBody(), hotReturnLabels (+29 more)

### Community 19 - "expect"
Cohesion: 0.19
Nodes (12): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+4 more)

### Community 20 - "package.json"
Cohesion: 0.13
Nodes (19): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+11 more)

### Community 21 - "v2-core.php"
Cohesion: 0.17
Nodes (24): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+16 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.21
Nodes (22): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "{closure#1}"
Cohesion: 0.17
Nodes (18): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, admin_user_mobile(), tamiran_config(), tamiran_decrypt_secret() (+10 more)

### Community 24 - "admin-users.php"
Cohesion: 0.18
Nodes (14): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_payload(), {closure#9}(), shop_user_assert_managed() (+6 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.15
Nodes (20): ConfirmAmount(), count, dateLabel(), FinanceHeader(), Line, lineAmount(), lineNames, methods (+12 more)

### Community 26 - "technical-case-workspace.tsx"
Cohesion: 0.13
Nodes (32): formatToman(), MoneyInput(), moneyDigits(), tomanToRials(), OperationsCaseWorkspace(), Task, tasks, blank() (+24 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.16
Nodes (35): v2_notify(), v2_require_permission(), v2_stock_mutate(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide() (+27 more)

### Community 28 - "access.tsx"
Cohesion: 0.12
Nodes (25): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+17 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.21
Nodes (19): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+11 more)

### Community 30 - "followups.php"
Cohesion: 0.08
Nodes (46): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+38 more)

### Community 31 - "compact-receipt.tsx"
Cohesion: 0.16
Nodes (14): WorkspaceProfile, Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText() (+6 more)

### Community 32 - "technician-workbench.tsx"
Cohesion: 0.10
Nodes (32): fa(), FollowReason, followTitles, OperationsFollowups(), loadMore(), openCase(), saveNote(), OperationsPerformance() (+24 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "external_purchase_change"
Cohesion: 0.19
Nodes (11): external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_rows(), external_purchase_view(), manager_followup_queue(), manager_operations_report(), operations_policy() (+3 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "catalog-similarity.ts"
Cohesion: 0.21
Nodes (11): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+3 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.14
Nodes (12): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.2, تغییرات 1.0.0-rc.3, تغییرات 1.0.0-rc.4, تغییرات 1.0.0-rc.5 (+4 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (33): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, AdminBranch, AdminDashboard, AdminShop (+25 more)

### Community 40 - "ReceptionPage"
Cohesion: 0.14
Nodes (17): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, createCatalogItem(), discardReceptionDraft(), lookupCustomer(), saveReceptionDraft() (+9 more)

### Community 41 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, qrcode, react-dom

### Community 42 - "SectionTitle"
Cohesion: 0.20
Nodes (17): printCompactReceipt(), saveShopSetting(), updateShopSettings(), save(), AccountSettings(), Field(), InventorySettings(), ReceiptSettings() (+9 more)

### Community 44 - "catalog-import.tsx"
Cohesion: 0.22
Nodes (13): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), normalizeQueueSearch() (+5 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 50 - "tamiran_require_central_admin"
Cohesion: 0.29
Nodes (4): tamiran_require_central_admin(), {closure#1}(), {closure#2}(), price_catalog_rows()

### Community 51 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

### Community 52 - "tamiran_db"
Cohesion: 0.23
Nodes (9): tamiran_actor(), tamiran_db(), tamiran_forget_actor(), tamiran_license_state(), tamiran_native_sql(), tamiran_release_active_session(), tamiran_verify_stored_password(), TamiranPDO (+1 more)

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.16
Nodes (11): check_case_procurement(), check_finance_delivery_browser(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser(), check_supply_browser(), open_as(), run() (+3 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.18
Nodes (25): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line() (+17 more)

### Community 75 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 76 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 77 - "services_test.php"
Cohesion: 0.40
Nodes (5): check(), {closure#1}(), {closure#2}(), {closure#3}(), denied()

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.15
Nodes (12): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل, 1.0.0-rc.5 — نمایش پرونده در صف مالی (+4 more)

### Community 79 - "delivery_warranty_case"
Cohesion: 0.27
Nodes (6): tamiran_tracking_token(), tamiran_uuid_v7(), {closure#4}(), delivery_payload(), delivery_report_discrepancy(), delivery_warranty_case()

### Community 80 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 82 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 83 - "case-mutations.ts"
Cohesion: 0.50
Nodes (4): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), RepairCaseStatus

### Community 85 - "scripts"
Cohesion: 0.67
Nodes (3): scripts, build, typecheck

### Community 87 - "synthetic_imei"
Cohesion: 0.11
Nodes (20): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+12 more)

## Knowledge Gaps
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `external_purchase_change`, `tamiran_require_central_admin`, `tamiran_db`, `tamiran_id`, `delivery_warranty_case`, `quality_run`, `tamiran_captcha_audio`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 210 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 210 INFERRED edges - model-reasoned connections that need verification._
- **Should `TamiranApiException` be split into smaller, more focused modules?**
  _Cohesion score 0.12292358803986711 - nodes in this community are weakly interconnected._
- **Why does `react` connect `technical-case-workspace.tsx` to `technician-workbench.tsx`, `v2-api.ts`, `directadmin-api.ts`, `v2-workspace.tsx`, `directadmin-api.ts`, `admin-panel.tsx`, `dependencies`, `catalog-import.tsx`, `workflowV2Action`, `client-diagnostics.ts`, `modules.tsx`, `case-stage-board.tsx`, `package.json`, `shop-users.tsx`, `persian-date.ts`, `finance-case-view.tsx`, `access.tsx`, `compact-receipt.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Should `v2-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._
- **Are the 59 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 59 INFERRED edges - model-reasoned connections that need verification._