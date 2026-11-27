# Graph Report - tamiran-v1  (2026-11-28)

## Corpus Check
- 181 files · ~204,255 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1950 nodes · 5864 edges · 97 communities (75 shown, 22 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1275 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f973406`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- client-diagnostics.ts
- modules.tsx
- page.tsx
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
- operations.ts
- expect
- v2-core.php
- run
- external_purchase_change
- package.json
- v2-core.php
- persian-date.ts
- TamiranApiException
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
- operations-case-workspace.tsx
- CHANGELOG.md
- directadmin-api.ts
- v2_text
- run
- react
- workflow-v2.php
- formatRials
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
- v7_operations.py
- run
- tamiran_id
- reception-ui-contract.ts
- access.tsx
- technical-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- UI-FIXES-FA.md
- quality_run
- operational-bootstrap.ts
- به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8
- run
- v2-api.ts
- run
- {closure#1}
- TamiranKavenegarProvider
- DEPLOYMENT.md
- design-qa.md
- گزارش تثبیت تعمیران
- JSONHandler
- TEST-REPORT.md
- tamiran_db
- {closure#2}

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 251 edges
2. `v2_text()` - 76 edges
3. `expect()` - 70 edges
4. `Client` - 67 edges
5. `tamiran_id()` - 65 edges
6. `tamiran_audit()` - 61 edges
7. `v2_require_permission()` - 52 edges
8. `v2_case()` - 51 edges
9. `{closure#8}()` - 41 edges
10. `tamiran_db()` - 40 edges

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

## Communities (97 total, 22 thin omitted)

### Community 0 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 1 - "modules.tsx"
Cohesion: 0.08
Nodes (42): buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), displayDeviceType(), createCatalogItem(), discardReceptionDraft(), loadCatalog(), loadRepairCase(), lookupCustomer() (+34 more)

### Community 2 - "page.tsx"
Cohesion: 0.07
Nodes (47): diagnosticFetch(), AccessSessionLoader(), createPartRequest(), createRepairCase(), loadCapabilities(), loadOperations(), loadShopSettings(), restoreSession() (+39 more)

### Community 3 - "{closure#2}"
Cohesion: 0.07
Nodes (42): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+34 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.06
Nodes (58): createInventoryItem(), directAdminRequest(), formatHandoverTime(), printHandoverReceipt(), timeFormatter, fa, QueueFeedback(), useOperationalQueue() (+50 more)

### Community 5 - "technician-service.php"
Cohesion: 0.18
Nodes (33): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line() (+25 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (6): main(), run(), create_all(), main(), svg_captcha(), synthetic_imei()

### Community 7 - "operations.php"
Cohesion: 0.10
Nodes (24): {closure#11}(), {closure#14}(), {closure#3}(), {closure#5}(), operations_appearance_options(), operations_canonical_value(), operations_case_recallable(), operations_case_select() (+16 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (82): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+74 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.10
Nodes (27): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+19 more)

### Community 11 - "UPGRADE-FA.md"
Cohesion: 0.10
Nodes (20): ارتقای 1.0.0-rc.10 به 1.0.0-rc.11, ارتقای 1.0.0-rc.11 به 1.0.0-rc.12, ارتقای 1.0.0-rc.12 به 1.0.0-rc.13, ارتقای 1.0.0-rc.13 به 1.0.0-rc.14, ارتقای 1.0.0-rc.14 به 1.0.0-rc.15, ارتقای 1.0.0-rc.15 به 1.0.0-rc.16, ارتقای 1.0.0-rc.2 به 1.0.0-rc.3, ارتقای 1.0.0-rc.3 به 1.0.0-rc.4 (+12 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.10
Nodes (30): {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_config(), tamiran_csrf_token(), tamiran_domain_root(), tamiran_fail(), tamiran_forget_actor() (+22 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.17
Nodes (25): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+17 more)

### Community 14 - "react"
Cohesion: 0.13
Nodes (24): WorkspaceProfile, appearanceDescription(), DamageLocations, damagePlaces, damageTypes, exclusiveDamagePlaces, intakeAppearance, CompactReceipt() (+16 more)

### Community 15 - "operations.ts"
Cohesion: 0.09
Nodes (23): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), CreateInventoryItemInput, CreatePartRequestInput, CreateRepairCaseInput, CustomerLookupResult, emptyOperationalSnapshot (+15 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (20): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+12 more)

### Community 17 - "v2-core.php"
Cohesion: 0.10
Nodes (35): inventory_v2_route_after_parts(), v2_case_blockers(), v2_catalog_collisions(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_device_has_imei(), v2_finance_blockers() (+27 more)

### Community 18 - "run"
Cohesion: 0.10
Nodes (21): create(), create(), sms(), action(), blocked(), estimate(), higher_amount_blocks_completion(), new_case() (+13 more)

### Community 19 - "external_purchase_change"
Cohesion: 0.19
Nodes (15): external_purchase_add_catalog(), external_purchase_can_add_catalog(), external_purchase_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_requires_customer_authorization(), external_purchase_rows() (+7 more)

### Community 20 - "package.json"
Cohesion: 0.05
Nodes (45): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6 (+37 more)

### Community 21 - "v2-core.php"
Cohesion: 0.24
Nodes (17): manager_case_queue(), v2_queue_id(), v2_queue_offset(), v2_queue_term(), v2_require_queue_branch(), v2_stock_mutate(), {closure#2}(), {closure#3}() (+9 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.21
Nodes (22): addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay(), pad() (+14 more)

### Community 23 - "TamiranApiException"
Cohesion: 0.14
Nodes (33): operations_intake_cost_policy(), operations_validate_intake_locations(), tamiran_sms_estimate_recipient(), tamiran_sms_queue_event(), technician_require_receipt(), v2_require_capability(), tamiran_encrypt_secret(), tamiran_json_body() (+25 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (16): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+8 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.12
Nodes (28): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), isOpenFinanceInvoice() (+20 more)

### Community 26 - "manager-operations.php"
Cohesion: 0.18
Nodes (11): manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_queue_conditions(), manager_report_as_of(), manager_report_cases(), manager_report_dates(), manager_report_delay_sql() (+3 more)

### Community 27 - "auth_identify"
Cohesion: 0.26
Nodes (16): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+8 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.34
Nodes (21): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+13 more)

### Community 29 - "Runner"
Cohesion: 0.17
Nodes (7): run(), upload(), Runner, run(), create(), receive(), row()

### Community 30 - "followups.php"
Cohesion: 0.13
Nodes (30): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+22 more)

### Community 31 - "catalog-import.tsx"
Cohesion: 0.16
Nodes (16): fflate@0.8.3, DeviceCatalogItem, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), initialDeviceCatalog, legacyDeviceTypeLabels (+8 more)

### Community 32 - "v2-api.ts"
Cohesion: 0.11
Nodes (27): fa(), FollowReason, followTitles, formatReportDeadline(), managerMetricLabels, ManagerPulse(), openManagerQueueCase(), OperationsFollowups() (+19 more)

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
Cohesion: 0.12
Nodes (16): digest(), git(), main(), release_manifest(), release_source(), release_version(), required(), runtime_files() (+8 more)

### Community 37 - "operations-case-workspace.tsx"
Cohesion: 0.15
Nodes (21): accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp(), submit(), restoreCaret(), moneyDigits(), OperationsCaseWorkspace() (+13 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.07
Nodes (25): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+17 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (36): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+28 more)

### Community 40 - "v2_text"
Cohesion: 0.23
Nodes (24): v2_request_has_no_open_purchase_sql(), v2_require_permission(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload() (+16 more)

### Community 41 - "run"
Cohesion: 0.16
Nodes (15): browse(), check_catalog_browser(), check_concurrency(), wait_for_transactions(), check_grant_browser(), check_hot_browser(), check(), check_recall_browser() (+7 more)

### Community 42 - "react"
Cohesion: 0.15
Nodes (12): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), Address, CustomerAddress(), evidenceMethods, Run (+4 more)

### Community 43 - "workflow-v2.php"
Cohesion: 0.17
Nodes (22): v2_json(), v2_notify(), v2_require_case_access(), {closure#8}(), workflow_v2_active_technician(), workflow_v2_activity(), workflow_v2_add_collaborator(), workflow_v2_add_manual_part() (+14 more)

### Community 44 - "formatRials"
Cohesion: 0.20
Nodes (13): defaultIntakeCost, formatIntakeRials, IntakeAdvance, IntakeAdvanceEditor(), IntakeCostApproval, IntakeLocation, IntakeLocationSettings(), IntakeRialInput() (+5 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 46 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 49 - "workflowV2Action"
Cohesion: 0.22
Nodes (11): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, rialAmount(), changeExternalPurchase(), ExternalPurchase (+3 more)

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

### Community 51 - "moduleErrorMessage"
Cohesion: 0.27
Nodes (17): saveShopSetting(), updateShopSettings(), OperationsPolicyForm(), save(), AccountSettings(), InventorySettings(), moduleErrorMessage(), ReceiptSettings() (+9 more)

### Community 52 - "reception-draft-mutations.ts"
Cohesion: 0.19
Nodes (11): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+3 more)

### Community 69 - "بازگشت نسخه"
Cohesion: 0.50
Nodes (3): بازگشت از نامزد rc.19 به rc.13, بازگشت نسخه, نسخهٔ آرشیوی

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 71 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.18
Nodes (11): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+3 more)

### Community 72 - "v7_operations.py"
Cohesion: 0.13
Nodes (14): screens(), check_case_procurement(), check_cashier_referral(), check_finance_delivery_browser(), check_intake_print(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser() (+6 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.21
Nodes (20): technician_money(), technician_unrepaired(), v2_financial_event(), v2_open_case_advances(), tamiran_id(), {closure#5}(), finance_advance(), finance_advance_case_search() (+12 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.27
Nodes (9): ActiveReceiptTerms, buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection, ReceiptAcceptance, receiptTermsKey() (+1 more)

### Community 76 - "access.tsx"
Cohesion: 0.29
Nodes (10): accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword(), completeLogin() (+2 more)

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.10
Nodes (39): blank(), costLabels, date(), DevicePassword(), reveal(), diagnosisOptions, Draft, message() (+31 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.14
Nodes (14): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.10 — اعتبارسنجی IMEI هنگام تحویل, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل (+6 more)

### Community 79 - "{closure#1}"
Cohesion: 0.20
Nodes (14): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+6 more)

### Community 80 - "UI-FIXES-FA.md"
Cohesion: 0.17
Nodes (10): Tamiran PHP hosting edition, نسخهٔ php.10 — میز کار مشترک مرکز عملیات, php.10 — اصلاح ورودی جاافتادهٔ مرکز عملیات, اصلاحات رابط — 2.0.0-php.7, سابقهٔ php.2, سابقهٔ php.6, سابقهٔ php.8, سابقهٔ اصلاحات (+2 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 82 - "operational-bootstrap.ts"
Cohesion: 0.50
Nodes (4): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders

### Community 83 - "به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8"
Cohesion: 0.25
Nodes (8): به‌روزرسانی از 2.0.0-php.6 به 2.0.0-php.7, به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8, سابقهٔ php.7, سابقهٔ ارتقا از php.1 به php.2, سابقهٔ ارتقا از php.2 به php.3, سابقهٔ ارتقا از php.3 به php.4, سابقهٔ ارتقا از php.4 به php.5, سابقهٔ ارتقا از php.5 به php.6

### Community 84 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 85 - "v2-api.ts"
Cohesion: 0.09
Nodes (32): fa, ProcurementDocuments(), ProcurementForm(), loadRelated(), ReceiveDocument(), Run, statusLabels, createV2Estimate() (+24 more)

### Community 86 - "run"
Cohesion: 0.26
Nodes (10): browser_checks(), run(), at(), case_row(), details(), history(), stage(), mutate() (+2 more)

### Community 87 - "{closure#1}"
Cohesion: 0.17
Nodes (19): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_verify_otp(), {closure#3}(), tamiran_decrypt_secret(), tamiran_digits(), tamiran_encryption_key(), tamiran_runtime_secret() (+11 more)

### Community 90 - "DEPLOYMENT.md"
Cohesion: 0.25
Nodes (5): TAM-STAB-02، شناسه‌های مستقل دستگاه, ساختار داده, انتشار, خواندن نسخهٔ هاست, مسیر انتشار نسل جدید

### Community 94 - "گزارش تثبیت تعمیران"
Cohesion: 0.20
Nodes (8): API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12, سابقهٔ پیاده‌سازی و آزمون, فهرست پیگیری بر اساس ممیزی مستقل rc.13 و آزمون rc.18, کنترل ۲۲ اصلاح, گزارش تثبیت تعمیران, تعمیران ۱٫۰٫۰

### Community 96 - "JSONHandler"
Cohesion: 0.22
Nodes (3): JSONHandler, Provider, Proxy

### Community 98 - "TEST-REPORT.md"
Cohesion: 0.22
Nodes (8): آزمون‌های TAM-STAB-02 در 1.0.0-rc.16, آزمون‌های TAM-STAB-03 در 1.0.0-rc.17, آزمون‌های TAM-STAB-04 در 1.0.0-rc.18, آزمون‌های تثبیت 1.0.0-rc.11, آزمون‌های تکمیل 1.0.0-rc.12, آزمون‌های صف‌های عملیاتی 1.0.0-rc.15, آزمون‌های قبض پذیرش 1.0.0-rc.13, آزمون پذیرش و قبض rc.20

### Community 99 - "tamiran_db"
Cohesion: 0.21
Nodes (10): tamiran_db(), tamiran_native_sql(), tamiran_public_rate_limit(), tamiran_release_active_session(), tamiran_verify_stored_password(), TamiranPDO, TamiranPDOStatement, {closure#1}() (+2 more)

## Knowledge Gaps
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `technician-service.php`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `v2-core.php`, `external_purchase_change`, `v2-core.php`, `admin-users.php`, `manager-operations.php`, `auth_identify`, `followups.php`, `v2_text`, `workflow-v2.php`, `tamiran_id`, `{closure#1}`, `quality_run`, `{closure#1}`, `TamiranKavenegarProvider`, `tamiran_db`, `{closure#2}`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 229 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 229 INFERRED edges - model-reasoned connections that need verification._
- **Should `modules.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0753045404208195 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `client-diagnostics.ts`, `modules.tsx`, `page.tsx`, `v2-workspace.tsx`, `admin-panel.tsx`, `react`, `operations.ts`, `package.json`, `persian-date.ts`, `finance-case-view.tsx`, `catalog-import.tsx`, `v2-api.ts`, `customer-portal.tsx`, `operations-case-workspace.tsx`, `directadmin-api.ts`, `formatRials`, `workflowV2Action`, `case-stage-board.tsx`, `access.tsx`, `technical-case-workspace.tsx`, `v2-api.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 72 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 72 INFERRED edges - model-reasoned connections that need verification._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07315233785822021 - nodes in this community are weakly interconnected._
- **Are the 62 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 62 INFERRED edges - model-reasoned connections that need verification._