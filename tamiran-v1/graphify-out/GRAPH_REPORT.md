# Graph Report - tamiran-v1  (2026-11-26)

## Corpus Check
- 165 files · ~172,350 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: .css 11, (none) 8, .woff2 3)

## Summary
- 1618 nodes · 4845 edges · 85 communities (61 shown, 24 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1087 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9b538ea1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- technician-service.php
- technician-workbench.tsx
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
- modules.tsx
- expect
- client-diagnostics.ts
- tamiran_require_actor
- case_invoice_correct
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- case-procurement.tsx
- technical-case-workspace.tsx
- tamiran_audit
- access.tsx
- tamiran_require_csrf
- followups.php
- compact-receipt.tsx
- v2-api.ts
- شواهد نسخهٔ PHP تعمیران
- external_purchase_change
- compilerOptions
- package.py
- catalog-import.tsx
- CHANGELOG.md
- directadmin-api.ts
- TamiranApiException
- customer-portal.tsx
- catalog-similarity.php
- DATABASE-MIGRATIONS.md
- case-stage-board.tsx
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- issue_once_concurrently
- v2_stock_mutate
- run
- catalog-similarity.ts
- lucide-react
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- README.md
- run
- run
- finance_issue
- operations-case-workspace.tsx
- run
- frontend_contracts.test.mjs
- {closure#1}
- quality_run
- build.mjs
- آزمون‌های نسخهٔ توسعه
- synthetic_imei
- operations.ts
- design-qa.md

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 230 edges
2. `v2_text()` - 64 edges
3. `tamiran_id()` - 63 edges
4. `tamiran_audit()` - 60 edges
5. `expect()` - 52 edges
6. `Client` - 49 edges
7. `v2_require_permission()` - 43 edges
8. `v2_case()` - 43 edges
9. `tamiran_db()` - 40 edges
10. `Home()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `technician_projection()` --calls--> `case_invoice_public()`  [INFERRED]
  hosting/private/technician-service.php → hosting/private/case-invoice.php
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#1}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php

## Import Cycles
- None detected.

## Communities (85 total, 24 thin omitted)

### Community 0 - "technician-service.php"
Cohesion: 0.33
Nodes (19): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_diagnosis(), technician_editable() (+11 more)

### Community 1 - "technician-workbench.tsx"
Cohesion: 0.18
Nodes (16): OperationsPolicyForm(), save(), technicalCaseFromLocation(), writeTechnicalLocation(), HandoverItems(), HandoverSummary(), ItemCheck, Props (+8 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.08
Nodes (41): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), CapabilityCatalog(), stateLabels, CapabilitySnapshot (+33 more)

### Community 3 - "{closure#2}"
Cohesion: 0.10
Nodes (28): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+20 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.10
Nodes (39): matchesQueueSearch(), deliveryV2Action(), financeV2Action(), loadV2Delivery(), loadV2FinanceWorkspace(), loadV2InventoryControl(), loadV2Quality(), loadV2QualityCase() (+31 more)

### Community 5 - "v2_case"
Cohesion: 0.13
Nodes (29): manager_followup_queue(), manager_operations_report(), manager_update_case(), operations_policy(), v2_case(), v2_json(), v2_notify(), v2_require_case_access() (+21 more)

### Community 6 - "smoke.py"
Cohesion: 0.10
Nodes (5): check(), save(), upload(), main(), svg_captcha()

### Community 7 - "operations.php"
Cohesion: 0.09
Nodes (41): v2_identity_value(), v2_require_capability(), tamiran_encrypt_secret(), tamiran_tracking_token(), tamiran_uuid_v7(), tamiran_validate_national_code(), delivery_warranty_case(), {closure#10}() (+33 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (81): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+73 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.12
Nodes (22): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+14 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.05
Nodes (36): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+28 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.10
Nodes (30): admin_shop_summary(), {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_config(), tamiran_csrf_token(), tamiran_db(), tamiran_encryption_key() (+22 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.12
Nodes (31): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+23 more)

### Community 14 - "workflowV2Action"
Cohesion: 0.24
Nodes (11): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), changeExternalPurchase(), ExternalPurchase (+3 more)

### Community 15 - "modules.tsx"
Cohesion: 0.05
Nodes (100): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+92 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+11 more)

### Community 17 - "client-diagnostics.ts"
Cohesion: 0.27
Nodes (6): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State, react

### Community 18 - "tamiran_require_actor"
Cohesion: 0.17
Nodes (13): tamiran_require_actor(), tamiran_require_shop_manager(), tamiran_require_writable_actor(), catalog_rows(), catalog_value(), {closure#1}(), operations_scope(), {closure#2}() (+5 more)

### Community 19 - "case_invoice_correct"
Cohesion: 0.26
Nodes (10): case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line(), operations_policy_defaults() (+2 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.19
Nodes (21): v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized(), v2_legacy_status() (+13 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.20
Nodes (23): InvoiceCatalogForm(), addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay() (+15 more)

### Community 23 - "{closure#1}"
Cohesion: 0.15
Nodes (19): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_decrypt_secret(), tamiran_digits(), tamiran_mobile() (+11 more)

### Community 24 - "admin-users.php"
Cohesion: 0.18
Nodes (14): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+6 more)

### Community 25 - "case-procurement.tsx"
Cohesion: 0.15
Nodes (23): fa, ProcurementDocuments(), ProcurementForm(), ReceiveDocument(), Run, statusLabels, formatToman(), MoneyInput() (+15 more)

### Community 26 - "technical-case-workspace.tsx"
Cohesion: 0.14
Nodes (25): directAdminRequest(), blank(), costLabels, date(), Draft, message(), TechnicalCaseWorkspace(), titles (+17 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.22
Nodes (25): v2_require_permission(), v2_text(), tamiran_audit(), delivery_report_discrepancy(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload() (+17 more)

### Community 28 - "access.tsx"
Cohesion: 0.16
Nodes (21): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+13 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.24
Nodes (18): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+10 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "compact-receipt.tsx"
Cohesion: 0.18
Nodes (13): WorkspaceProfile, Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText() (+5 more)

### Community 32 - "v2-api.ts"
Cohesion: 0.09
Nodes (30): fa(), FollowReason, followTitles, OperationsFollowups(), loadMore(), openCase(), saveNote(), OperationsPerformance() (+22 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "external_purchase_change"
Cohesion: 0.47
Nodes (6): external_purchase_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_rows(), external_purchase_view()

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "catalog-import.tsx"
Cohesion: 0.22
Nodes (13): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), normalizeQueueSearch() (+5 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.17
Nodes (10): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.2, تغییرات 1.0.0-rc.3, تغییرات 1.0.0-rc.4, تغییرات 1.0.0-rc.5 (+2 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.06
Nodes (38): DeviceCatalogItem, initialDeviceCatalog, legacyDeviceTypeLabels, AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard (+30 more)

### Community 40 - "TamiranApiException"
Cohesion: 0.08
Nodes (30): v2_scope(), admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_temporary_password(), admin_text() (+22 more)

### Community 41 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 42 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 44 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "v2_stock_mutate"
Cohesion: 0.39
Nodes (10): inventory_v2_route_after_parts(), v2_stock_mutate(), {closure#1}(), {closure#2}(), inventory_v2_finalize_issue(), inventory_v2_issue(), inventory_v2_payload(), inventory_v2_reject_or_cancel() (+2 more)

### Community 50 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 51 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 52 - "lucide-react"
Cohesion: 0.22
Nodes (8): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, lucide-react, qrcode, react-dom

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.16
Nodes (11): check_case_procurement(), check_finance_delivery_browser(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser(), check_supply_browser(), open_as(), run() (+3 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "finance_issue"
Cohesion: 0.38
Nodes (13): technician_unrepaired(), v2_financial_event(), tamiran_id(), {closure#2}(), finance_advance_readiness(), finance_draft_items(), finance_invoice_case(), finance_issue() (+5 more)

### Community 75 - "operations-case-workspace.tsx"
Cohesion: 0.32
Nodes (6): OperationsCaseWorkspace(), Task, tasks, assignV2Case(), transitionV2Case(), V2WorkflowPayload

### Community 76 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 78 - "{closure#1}"
Cohesion: 0.21
Nodes (10): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+2 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 83 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 85 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.18
Nodes (10): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل, 1.0.0-rc.5 — نمایش پرونده در صف مالی (+2 more)

### Community 87 - "synthetic_imei"
Cohesion: 0.11
Nodes (19): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+11 more)

### Community 91 - "operations.ts"
Cohesion: 0.09
Nodes (22): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), CreateInventoryItemInput, CreatePartRequestInput, CreateRepairCaseInput, CustomerLookupResult, emptyOperationalSnapshot (+14 more)

## Knowledge Gaps
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `technician-service.php`, `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `tamiran_require_actor`, `case_invoice_correct`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `external_purchase_change`, `v2_stock_mutate`, `finance_issue`, `{closure#1}`, `quality_run`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Are the 208 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 208 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._
- **Why does `react` connect `client-diagnostics.ts` to `technician-workbench.tsx`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `workflowV2Action`, `modules.tsx`, `package.json`, `persian-date.ts`, `case-procurement.tsx`, `technical-case-workspace.tsx`, `access.tsx`, `compact-receipt.tsx`, `v2-api.ts`, `catalog-import.tsx`, `directadmin-api.ts`, `customer-portal.tsx`, `case-stage-board.tsx`, `lucide-react`, `operations-case-workspace.tsx`, `operations.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Should `{closure#2}` be split into smaller, more focused modules?**
  _Cohesion score 0.10365853658536585 - nodes in this community are weakly interconnected._
- **Are the 60 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 60 INFERRED edges - model-reasoned connections that need verification._