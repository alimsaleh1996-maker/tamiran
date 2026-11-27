# Graph Report - tamiran-v1  (2026-11-27)

## Corpus Check
- 179 files · ~201,724 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1918 nodes · 5764 edges · 102 communities (81 shown, 21 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1256 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4076f7f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- access.tsx
- modules.tsx
- directadmin-api.ts
- {closure#2}
- v2-workspace.tsx
- technician-service.php
- smoke.py
- operations.php
- admin-panel.tsx
- installer_test.php
- Client
- UPGRADE-FA.md
- bootstrap.php
- backup-engine.php
- react
- ReceptionPage
- expect
- v2-core.php
- run
- external_purchase_change
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- finance-case-view.tsx
- manager-operations.php
- auth_identify
- ModuleRouter
- Runner
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
- tamiran_json_body
- check_quality_browser
- run
- package_test.py
- issue_once_concurrently
- workflowV2Action
- case-stage-board.tsx
- moduleErrorMessage
- reception-draft-mutations.ts
- PERMISSIONS.md
- frontend/README.md
- بازگشت نسخه
- WORKFLOW.md
- نصب تعمیران روی هاست PHP
- synthetic_imei
- run
- tamiran_id
- reception-ui-contract.ts
- sms
- technical-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- UI-FIXES-FA.md
- quality_run
- frontend_contracts.test.mjs
- به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8
- catalog-similarity.ts
- v2-api.ts
- run
- services_test.php
- case_invoice_correct
- build.mjs
- DEPLOYMENT.md
- tamiran_captcha_audio
- tamiran_db
- design-qa.md
- گزارش تثبیت تعمیران
- catalog-similarity.php
- JSONHandler
- captcha_audio.py
- TEST-REPORT.md
- {closure#2}
- {closure#1}
- case-mutations.ts

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 249 edges
2. `v2_text()` - 74 edges
3. `expect()` - 70 edges
4. `Client` - 67 edges
5. `tamiran_id()` - 65 edges
6. `tamiran_audit()` - 61 edges
7. `v2_require_permission()` - 51 edges
8. `v2_case()` - 51 edges
9. `{closure#8}()` - 41 edges
10. `synthetic_imei()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `API، داده و ابزارها` --references--> `v2_case()`  [INFERRED]
  docs/STABILIZATION-FA.md → hosting/private/v2-core.php
- `{closure#2}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php
- `admin_shop_summary()` --calls--> `tamiran_license_state()`  [INFERRED]
  hosting/public_html/api/admin.php → hosting/public_html/api/bootstrap.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php

## Import Cycles
- None detected.

## Communities (102 total, 21 thin omitted)

### Community 0 - "access.tsx"
Cohesion: 0.11
Nodes (26): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+18 more)

### Community 1 - "modules.tsx"
Cohesion: 0.06
Nodes (38): Address, CustomerAddress(), defaultAppearanceStates, defaultDeviceColors, DefaultIssue, defaultReceptionIssues, DeviceColorOption, EmptyState() (+30 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.09
Nodes (35): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+27 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (37): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+29 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.07
Nodes (55): directAdminRequest(), isOpenFinanceInvoice(), formatHandoverTime(), printHandoverReceipt(), fa, QueueFeedback(), useOperationalQueue(), loadManagerCaseQueue() (+47 more)

### Community 5 - "technician-service.php"
Cohesion: 0.28
Nodes (22): manager_update_case(), technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_declared_issues() (+14 more)

### Community 6 - "smoke.py"
Cohesion: 0.09
Nodes (10): upload(), main(), main(), browse(), check_catalog_browser(), check_grant_browser(), check_hot_browser(), check_recall_browser() (+2 more)

### Community 7 - "operations.php"
Cohesion: 0.10
Nodes (24): {closure#10}(), {closure#13}(), {closure#2}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_recallable(), operations_case_select() (+16 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (82): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+74 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.09
Nodes (29): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+21 more)

### Community 11 - "UPGRADE-FA.md"
Cohesion: 0.10
Nodes (19): ارتقای 1.0.0-rc.10 به 1.0.0-rc.11, ارتقای 1.0.0-rc.11 به 1.0.0-rc.12, ارتقای 1.0.0-rc.12 به 1.0.0-rc.13, ارتقای 1.0.0-rc.13 به 1.0.0-rc.14, ارتقای 1.0.0-rc.14 به 1.0.0-rc.15, ارتقای 1.0.0-rc.15 به 1.0.0-rc.16, ارتقای 1.0.0-rc.2 به 1.0.0-rc.3, ارتقای 1.0.0-rc.3 به 1.0.0-rc.4 (+11 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.12
Nodes (25): {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_credential_stamp(), tamiran_csrf_token(), tamiran_fail(), tamiran_forget_actor(), tamiran_is_https() (+17 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (23): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+15 more)

### Community 14 - "react"
Cohesion: 0.10
Nodes (29): qrcode@1.5.4, Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText() (+21 more)

### Community 15 - "ReceptionPage"
Cohesion: 0.10
Nodes (23): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, imeiError(), normalizeImei(), createCatalogItem(), discardReceptionDraft() (+15 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+11 more)

### Community 17 - "v2-core.php"
Cohesion: 0.17
Nodes (25): v2_case_blockers(), v2_catalog_collisions(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_device_has_imei(), v2_finance_blockers(), v2_hold_reason() (+17 more)

### Community 18 - "run"
Cohesion: 0.22
Nodes (8): run(), check_cashier_invoice(), estimate(), finish(), projection(), receive(), row(), transition()

### Community 19 - "external_purchase_change"
Cohesion: 0.32
Nodes (8): external_purchase_add_catalog(), external_purchase_can_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_requires_customer_authorization(), external_purchase_rows(), external_purchase_view()

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.27
Nodes (15): inventory_v2_route_after_parts(), v2_queue_id(), v2_require_queue_branch(), v2_stock_mutate(), {closure#2}(), {closure#3}(), inventory_v2_finalize_issue(), inventory_v2_issue() (+7 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.16
Nodes (27): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad(), parseIso() (+19 more)

### Community 23 - "{closure#1}"
Cohesion: 0.14
Nodes (22): tamiran_sms_estimate_recipient(), tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, {closure#3}(), tamiran_config() (+14 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (15): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+7 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.12
Nodes (26): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), Line (+18 more)

### Community 26 - "manager-operations.php"
Cohesion: 0.12
Nodes (20): manager_case_queue(), manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_queue_conditions(), manager_report_as_of(), manager_report_cases(), manager_report_dates() (+12 more)

### Community 27 - "auth_identify"
Cohesion: 0.24
Nodes (18): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+10 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.30
Nodes (23): printCompactReceipt(), AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal() (+15 more)

### Community 29 - "Runner"
Cohesion: 0.11
Nodes (17): run(), main(), run(), Runner, check_concurrency(), wait_for_transactions(), run(), command() (+9 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "catalog-import.tsx"
Cohesion: 0.24
Nodes (12): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), importCatalogItems(), normalizeQueueSearch(), columnIndex() (+4 more)

### Community 32 - "v2-api.ts"
Cohesion: 0.08
Nodes (42): fa(), FollowReason, followTitles, formatReportDeadline(), managerMetricLabels, ManagerPulse(), openManagerQueueCase(), OperationsFollowups() (+34 more)

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
Cohesion: 0.15
Nodes (11): digest(), git(), main(), release_manifest(), release_source(), release_version(), required(), runtime_files() (+3 more)

### Community 37 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 38 - "CHANGELOG.md"
Cohesion: 0.08
Nodes (24): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+16 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (36): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+28 more)

### Community 40 - "v2_text"
Cohesion: 0.22
Nodes (25): v2_request_has_no_open_purchase_sql(), v2_require_permission(), v2_text(), tamiran_audit(), delivery_report_discrepancy(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide() (+17 more)

### Community 41 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, lucide-react@1.31.0, react@19.2.6, react-dom@19.2.6, react-dom

### Community 42 - "TamiranApiException"
Cohesion: 0.14
Nodes (30): technician_require_receipt(), v2_require_capability(), v2_scope(), tamiran_encrypt_secret(), tamiran_tracking_token(), tamiran_uuid_v7(), tamiran_validate_national_code(), TamiranApiException (+22 more)

### Community 43 - "workflow-v2.php"
Cohesion: 0.18
Nodes (25): external_purchase_catalog(), v2_case(), v2_json(), v2_notify(), v2_require_case_access(), {closure#8}(), workflow_v2_active_technician(), workflow_v2_activity() (+17 more)

### Community 44 - "tamiran_json_body"
Cohesion: 0.17
Nodes (9): tamiran_json_body(), client_error_text(), {closure#1}(), {closure#1}(), {closure#2}(), price_catalog_rows(), {closure#1}(), ticket_require_access() (+1 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 46 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 49 - "workflowV2Action"
Cohesion: 0.18
Nodes (15): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), DevicePassword(), reveal() (+7 more)

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

### Community 51 - "moduleErrorMessage"
Cohesion: 0.28
Nodes (16): saveShopSetting(), updateShopSettings(), save(), AccountSettings(), InventorySettings(), moduleErrorMessage(), ReceiptSettings(), SectionTitle() (+8 more)

### Community 52 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 69 - "بازگشت نسخه"
Cohesion: 0.50
Nodes (3): بازگشت از نامزد rc.19 به rc.13, بازگشت نسخه, نسخهٔ آرشیوی

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 71 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.18
Nodes (11): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+3 more)

### Community 72 - "synthetic_imei"
Cohesion: 0.10
Nodes (23): run(), create_all(), synthetic_imei(), check(), create(), Lab, receipt(), run() (+15 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.21
Nodes (20): technician_money(), technician_unrepaired(), v2_financial_event(), v2_open_case_advances(), tamiran_id(), {closure#5}(), finance_advance(), finance_advance_case_search() (+12 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 76 - "sms"
Cohesion: 0.26
Nodes (9): sms(), action(), blocked(), estimate(), higher_amount_blocks_completion(), new_case(), otp_request(), provider() (+1 more)

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.14
Nodes (28): formatToman(), MoneyInput(), restoreCaret(), moneyDigits(), tomanToRials(), blank(), costLabels, date() (+20 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.14
Nodes (14): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.10 — اعتبارسنجی IMEI هنگام تحویل, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل (+6 more)

### Community 79 - "{closure#1}"
Cohesion: 0.20
Nodes (10): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+2 more)

### Community 80 - "UI-FIXES-FA.md"
Cohesion: 0.17
Nodes (10): Tamiran PHP hosting edition, نسخهٔ php.10 — میز کار مشترک مرکز عملیات, php.10 — اصلاح ورودی جاافتادهٔ مرکز عملیات, اصلاحات رابط — 2.0.0-php.7, سابقهٔ php.2, سابقهٔ php.6, سابقهٔ php.8, سابقهٔ اصلاحات (+2 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 83 - "به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8"
Cohesion: 0.25
Nodes (8): به‌روزرسانی از 2.0.0-php.6 به 2.0.0-php.7, به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8, سابقهٔ php.7, سابقهٔ ارتقا از php.1 به php.2, سابقهٔ ارتقا از php.2 به php.3, سابقهٔ ارتقا از php.3 به php.4, سابقهٔ ارتقا از php.4 به php.5, سابقهٔ ارتقا از php.5 به php.6

### Community 84 - "catalog-similarity.ts"
Cohesion: 0.32
Nodes (11): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), CatalogName, catalogText(), catalogType(), compact() (+3 more)

### Community 85 - "v2-api.ts"
Cohesion: 0.06
Nodes (49): WorkspaceProfile, fa, ProcurementDocuments(), ProcurementForm(), loadRelated(), ReceiveDocument(), Run, statusLabels (+41 more)

### Community 86 - "run"
Cohesion: 0.26
Nodes (10): browser_checks(), run(), at(), case_row(), details(), history(), stage(), mutate() (+2 more)

### Community 87 - "services_test.php"
Cohesion: 0.40
Nodes (5): check(), {closure#1}(), {closure#2}(), {closure#3}(), denied()

### Community 88 - "case_invoice_correct"
Cohesion: 0.38
Nodes (8): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line()

### Community 89 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 90 - "DEPLOYMENT.md"
Cohesion: 0.25
Nodes (5): TAM-STAB-02، شناسه‌های مستقل دستگاه, ساختار داده, انتشار, خواندن نسخهٔ هاست, مسیر انتشار نسل جدید

### Community 92 - "tamiran_db"
Cohesion: 0.17
Nodes (10): tamiran_db(), tamiran_domain_root(), tamiran_native_sql(), tamiran_public_rate_limit(), tamiran_verify_stored_password(), TamiranPDO, TamiranPDOStatement, {closure#1}() (+2 more)

### Community 94 - "گزارش تثبیت تعمیران"
Cohesion: 0.20
Nodes (8): API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12, سابقهٔ پیاده‌سازی و آزمون, فهرست پیگیری بر اساس ممیزی مستقل rc.13 و آزمون rc.18, کنترل ۲۲ اصلاح, گزارش تثبیت تعمیران, تعمیران ۱٫۰٫۰

### Community 95 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 96 - "JSONHandler"
Cohesion: 0.31
Nodes (3): JSONHandler, Provider, Proxy

### Community 97 - "captcha_audio.py"
Cohesion: 0.25
Nodes (3): check(), save(), svg_captcha()

### Community 98 - "TEST-REPORT.md"
Cohesion: 0.25
Nodes (7): آزمون‌های TAM-STAB-02 در 1.0.0-rc.16, آزمون‌های TAM-STAB-03 در 1.0.0-rc.17, آزمون‌های TAM-STAB-04 در 1.0.0-rc.18, آزمون‌های تثبیت 1.0.0-rc.11, آزمون‌های تکمیل 1.0.0-rc.12, آزمون‌های صف‌های عملیاتی 1.0.0-rc.15, آزمون‌های قبض پذیرش 1.0.0-rc.13

### Community 99 - "{closure#2}"
Cohesion: 0.46
Nodes (5): {closure#2}(), purchase_list(), purchase_optional(), purchase_scope(), purchase_update()

### Community 100 - "{closure#1}"
Cohesion: 0.57
Nodes (5): {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 101 - "case-mutations.ts"
Cohesion: 0.50
Nodes (4): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), RepairCaseStatus

## Knowledge Gaps
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `technician-service.php`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `v2-core.php`, `external_purchase_change`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `manager-operations.php`, `auth_identify`, `followups.php`, `v2_text`, `workflow-v2.php`, `tamiran_json_body`, `tamiran_id`, `{closure#1}`, `quality_run`, `case_invoice_correct`, `tamiran_captcha_audio`, `tamiran_db`, `{closure#2}`, `{closure#1}`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 227 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 227 INFERRED edges - model-reasoned connections that need verification._
- **Should `access.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11494252873563218 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `access.tsx`, `modules.tsx`, `customer-portal.tsx`, `v2-api.ts`, `v2-workspace.tsx`, `client-diagnostics.ts`, `directadmin-api.ts`, `directadmin-api.ts`, `admin-panel.tsx`, `dependencies`, `technical-case-workspace.tsx`, `workflowV2Action`, `case-stage-board.tsx`, `package.json`, `v2-api.ts`, `persian-date.ts`, `finance-case-view.tsx`, `catalog-import.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 70 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 70 INFERRED edges - model-reasoned connections that need verification._
- **Should `modules.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06090808416389812 - nodes in this community are weakly interconnected._
- **Are the 62 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 62 INFERRED edges - model-reasoned connections that need verification._