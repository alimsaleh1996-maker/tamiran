# Graph Report - tamiran-v1  (2026-11-28)

## Corpus Check
- 181 files · ~204,477 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1953 nodes · 5867 edges · 100 communities (79 shown, 21 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1275 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28d7f13a`
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
- lucide-react
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
- SalesSection
- ModuleRouter
- Runner
- followups.php
- {closure#2}
- v2-api.ts
- شواهد نسخهٔ PHP تعمیران
- customer-portal.tsx
- compilerOptions
- package.py
- technician-workbench.tsx
- CHANGELOG.md
- shop-users.tsx
- v2_text
- run
- ReceptionPage
- workflow-v2.php
- formatRials
- check_quality_browser
- run
- package_test.py
- issue_once_concurrently
- case_invoice_correct
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
- catalog-similarity.php
- به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8
- run
- case-procurement.tsx
- run
- {closure#1}
- {closure#1}
- DEPLOYMENT.md
- build.mjs
- operations-policy.php
- design-qa.md
- گزارش تثبیت تعمیران
- case-mutations.ts
- JSONHandler
- {closure#1}
- TEST-REPORT.md
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
- `API، داده و ابزارها` --references--> `v2_case()`  [INFERRED]
  docs/STABILIZATION-FA.md → hosting/private/v2-core.php
- `1.0.0-dev.1 — تخصیص اتمی و ارجاع` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php
- `{closure#2}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php
- `check()` --indirect_call--> `receipt()`  [INFERRED]
  hosting/tests/stabilization_02.py → hosting/tests/stabilization_04.py

## Import Cycles
- None detected.

## Communities (100 total, 21 thin omitted)

### Community 0 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 1 - "modules.tsx"
Cohesion: 0.06
Nodes (43): DamageLocations, damagePlaces, damageTypes, exclusiveDamagePlaces, intakeAppearance, Address, CustomerAddress(), defaultAppearanceStates (+35 more)

### Community 2 - "page.tsx"
Cohesion: 0.07
Nodes (40): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+32 more)

### Community 3 - "{closure#2}"
Cohesion: 0.10
Nodes (28): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+20 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.08
Nodes (47): directAdminRequest(), fa, QueueFeedback(), useOperationalQueue(), inventoryControlV2Action(), loadManagerQueueOptions(), loadV2Delivery(), loadV2FinanceWorkspace() (+39 more)

### Community 5 - "technician-service.php"
Cohesion: 0.24
Nodes (29): manager_update_case(), technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_customer_approval_limit() (+21 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (6): main(), run(), create_all(), main(), svg_captcha(), synthetic_imei()

### Community 7 - "operations.php"
Cohesion: 0.11
Nodes (23): tamiran_validate_national_code(), {closure#11}(), {closure#14}(), {closure#3}(), {closure#5}(), operations_appearance_options(), operations_canonical_value(), operations_case_recallable() (+15 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.04
Nodes (81): AdminLoading(), AdminModal(), AdminModalState, AdminSection, adminSectionFromLocation(), adminSections, BackupSection(), BackupSettingsForm() (+73 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.10
Nodes (27): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+19 more)

### Community 11 - "UPGRADE-FA.md"
Cohesion: 0.09
Nodes (21): ارتقای 1.0.0-rc.10 به 1.0.0-rc.11, ارتقای 1.0.0-rc.11 به 1.0.0-rc.12, ارتقای 1.0.0-rc.12 به 1.0.0-rc.13, ارتقای 1.0.0-rc.13 به 1.0.0-rc.14, ارتقای 1.0.0-rc.14 به 1.0.0-rc.15, ارتقای 1.0.0-rc.15 به 1.0.0-rc.16, ارتقای 1.0.0-rc.2 به 1.0.0-rc.3, ارتقای 1.0.0-rc.3 به 1.0.0-rc.4 (+13 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.07
Nodes (50): admin_shop_summary(), auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context() (+42 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.17
Nodes (25): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+17 more)

### Community 14 - "react"
Cohesion: 0.20
Nodes (17): appearanceDescription(), CompactReceipt(), CompactReceiptProps, dateText(), DEFAULT_RECEIPT_SIZE, loadReceiptFont(), printCompactReceipt(), RECEIPT_FONT_FILE (+9 more)

### Community 15 - "lucide-react"
Cohesion: 0.10
Nodes (25): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp() (+17 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (20): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+12 more)

### Community 17 - "v2-core.php"
Cohesion: 0.16
Nodes (27): inventory_v2_route_after_parts(), v2_case_blockers(), v2_catalog_collisions(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_device_has_imei(), v2_finance_blockers() (+19 more)

### Community 18 - "run"
Cohesion: 0.10
Nodes (21): create(), create(), sms(), action(), blocked(), estimate(), higher_amount_blocks_completion(), new_case() (+13 more)

### Community 19 - "external_purchase_change"
Cohesion: 0.29
Nodes (10): external_purchase_add_catalog(), external_purchase_can_add_catalog(), external_purchase_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_requires_customer_authorization(), external_purchase_rows() (+2 more)

### Community 20 - "package.json"
Cohesion: 0.05
Nodes (55): dependencies, fflate@0.8.3, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, devDependencies, @types/node@22.19.19 (+47 more)

### Community 21 - "v2-core.php"
Cohesion: 0.23
Nodes (14): manager_case_queue(), v2_has_permission(), v2_queue_id(), v2_queue_offset(), v2_queue_term(), v2_require_queue_branch(), {closure#2}(), inventory_v2_finalize_issue() (+6 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.16
Nodes (28): InvoiceCatalogForm(), addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay() (+20 more)

### Community 23 - "TamiranApiException"
Cohesion: 0.09
Nodes (50): operations_intake_cost_policy(), operations_validate_intake_locations(), v2_require_capability(), v2_scope(), tamiran_db(), tamiran_json_body(), tamiran_require_actor(), tamiran_require_csrf() (+42 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (15): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+7 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.11
Nodes (29): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), isOpenFinanceInvoice() (+21 more)

### Community 26 - "manager-operations.php"
Cohesion: 0.17
Nodes (13): manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_queue_conditions(), manager_report_as_of(), manager_report_cases(), manager_report_dates(), manager_report_delay_sql() (+5 more)

### Community 27 - "SalesSection"
Cohesion: 0.18
Nodes (21): AdminEmpty(), AdminOverview(), daysRemaining(), formatDate(), formatMoney(), initials(), InvoiceDetails(), InvoiceDocument() (+13 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.32
Nodes (22): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+14 more)

### Community 29 - "Runner"
Cohesion: 0.17
Nodes (7): run(), upload(), Runner, run(), create(), receive(), row()

### Community 30 - "followups.php"
Cohesion: 0.28
Nodes (15): {closure#2}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories(), followup_patch() (+7 more)

### Community 31 - "{closure#2}"
Cohesion: 0.27
Nodes (8): admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_temporary_password(), admin_text(), {closure#2}()

### Community 32 - "v2-api.ts"
Cohesion: 0.06
Nodes (56): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, rialAmount(), fa(), FollowReason (+48 more)

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

### Community 37 - "technician-workbench.tsx"
Cohesion: 0.16
Nodes (16): WorkspaceProfile, technicalCaseFromLocation(), writeTechnicalLocation(), HandoverItems(), HandoverSummary(), ItemCheck, Props, TechnicianWorkbench() (+8 more)

### Community 38 - "CHANGELOG.md"
Cohesion: 0.07
Nodes (26): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+18 more)

### Community 39 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 40 - "v2_text"
Cohesion: 0.19
Nodes (27): v2_request_has_no_open_purchase_sql(), v2_require_permission(), v2_text(), tamiran_audit(), delivery_report_discrepancy(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide() (+19 more)

### Community 41 - "run"
Cohesion: 0.16
Nodes (15): browse(), check_catalog_browser(), check_concurrency(), wait_for_transactions(), check_grant_browser(), check_hot_browser(), check(), check_recall_browser() (+7 more)

### Community 42 - "ReceptionPage"
Cohesion: 0.13
Nodes (20): displayDeviceType(), imeiError(), normalizeImei(), createCatalogItem(), discardReceptionDraft(), loadCatalog(), lookupCustomer(), saveReceptionDraft() (+12 more)

### Community 43 - "workflow-v2.php"
Cohesion: 0.16
Nodes (20): v2_json(), v2_notify(), v2_stock_mutate(), tamiran_id(), inventory_v2_issue(), procurement_allocate_receipt(), procurement_receive(), workflow_v2_active_technician() (+12 more)

### Community 44 - "formatRials"
Cohesion: 0.17
Nodes (12): defaultIntakeCost, formatIntakeRials, IntakeAdvance, IntakeAdvanceEditor(), IntakeCostApproval, IntakeLocation, IntakeLocationSettings(), IntakeMethod (+4 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 46 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 49 - "case_invoice_correct"
Cohesion: 0.38
Nodes (8): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line()

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

### Community 51 - "moduleErrorMessage"
Cohesion: 0.29
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

### Community 72 - "v7_operations.py"
Cohesion: 0.13
Nodes (14): screens(), check_case_procurement(), check_cashier_referral(), check_finance_delivery_browser(), check_intake_print(), check_locked_finance_browser(), check_operations_browser(), check_quality_browser() (+6 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.24
Nodes (18): technician_money(), technician_unrepaired(), v2_financial_event(), v2_open_case_advances(), {closure#5}(), finance_advance(), finance_advance_case_search(), finance_advance_readiness() (+10 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 76 - "access.tsx"
Cohesion: 0.13
Nodes (24): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+16 more)

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.10
Nodes (44): formatRials(), MoneyInput(), restoreCaret(), moneyDigits(), parseRials(), OperationsCaseWorkspace(), Task, tasks (+36 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.14
Nodes (14): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.10 — اعتبارسنجی IMEI هنگام تحویل, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل (+6 more)

### Community 79 - "{closure#1}"
Cohesion: 0.16
Nodes (13): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+5 more)

### Community 80 - "UI-FIXES-FA.md"
Cohesion: 0.17
Nodes (10): Tamiran PHP hosting edition, نسخهٔ php.10 — میز کار مشترک مرکز عملیات, php.10 — اصلاح ورودی جاافتادهٔ مرکز عملیات, اصلاحات رابط — 2.0.0-php.7, سابقهٔ php.2, سابقهٔ php.6, سابقهٔ php.8, سابقهٔ اصلاحات (+2 more)

### Community 81 - "quality_run"
Cohesion: 0.44
Nodes (10): quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template(), quality_result_row(), quality_run(), quality_save_template() (+2 more)

### Community 82 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 83 - "به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8"
Cohesion: 0.25
Nodes (8): به‌روزرسانی از 2.0.0-php.6 به 2.0.0-php.7, به‌روزرسانی از 2.0.0-php.7 به 2.0.0-php.8, سابقهٔ php.7, سابقهٔ ارتقا از php.1 به php.2, سابقهٔ ارتقا از php.2 به php.3, سابقهٔ ارتقا از php.3 به php.4, سابقهٔ ارتقا از php.4 به php.5, سابقهٔ ارتقا از php.5 به php.6

### Community 84 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 85 - "case-procurement.tsx"
Cohesion: 0.21
Nodes (13): fa, ProcurementDocuments(), ProcurementForm(), loadRelated(), ReceiveDocument(), Run, statusLabels, loadPartRequestQueue() (+5 more)

### Community 86 - "run"
Cohesion: 0.26
Nodes (10): browser_checks(), run(), at(), case_row(), details(), history(), stage(), mutate() (+2 more)

### Community 87 - "{closure#1}"
Cohesion: 0.13
Nodes (24): tamiran_sms_estimate_recipient(), tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, {closure#3}(), tamiran_decrypt_secret() (+16 more)

### Community 88 - "{closure#1}"
Cohesion: 0.33
Nodes (7): tamiran_require_central_admin(), {closure#1}(), {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 90 - "DEPLOYMENT.md"
Cohesion: 0.25
Nodes (5): TAM-STAB-02، شناسه‌های مستقل دستگاه, ساختار داده, انتشار, خواندن نسخهٔ هاست, مسیر انتشار نسل جدید

### Community 91 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 92 - "operations-policy.php"
Cohesion: 0.52
Nodes (5): operations_intake_locations(), operations_intake_setting(), operations_policy_defaults(), operations_policy_validate(), operations_policy_with_defaults()

### Community 94 - "گزارش تثبیت تعمیران"
Cohesion: 0.20
Nodes (8): API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12, سابقهٔ پیاده‌سازی و آزمون, فهرست پیگیری بر اساس ممیزی مستقل rc.13 و آزمون rc.18, کنترل ۲۲ اصلاح, گزارش تثبیت تعمیران, تعمیران ۱٫۰٫۰

### Community 95 - "case-mutations.ts"
Cohesion: 0.50
Nodes (4): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), RepairCaseStatus

### Community 96 - "JSONHandler"
Cohesion: 0.22
Nodes (3): JSONHandler, Provider, Proxy

### Community 97 - "{closure#1}"
Cohesion: 0.67
Nodes (3): tamiran_domain_root(), {closure#1}(), tamiran_health_files()

### Community 98 - "TEST-REPORT.md"
Cohesion: 0.22
Nodes (8): آزمون‌های TAM-STAB-02 در 1.0.0-rc.16, آزمون‌های TAM-STAB-03 در 1.0.0-rc.17, آزمون‌های TAM-STAB-04 در 1.0.0-rc.18, آزمون‌های تثبیت 1.0.0-rc.11, آزمون‌های تکمیل 1.0.0-rc.12, آزمون‌های صف‌های عملیاتی 1.0.0-rc.15, آزمون‌های قبض پذیرش 1.0.0-rc.13, آزمون پذیرش و قبض rc.20

## Knowledge Gaps
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `technician-service.php`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `v2-core.php`, `external_purchase_change`, `v2-core.php`, `admin-users.php`, `manager-operations.php`, `followups.php`, `{closure#2}`, `v2_text`, `workflow-v2.php`, `case_invoice_correct`, `tamiran_id`, `{closure#1}`, `quality_run`, `{closure#1}`, `{closure#1}`, `operations-policy.php`, `{closure#1}`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 229 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 229 INFERRED edges - model-reasoned connections that need verification._
- **Should `modules.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05612244897959184 - nodes in this community are weakly interconnected._
- **Why does `react` connect `technical-case-workspace.tsx` to `client-diagnostics.ts`, `modules.tsx`, `customer-portal.tsx`, `v2-api.ts`, `v2-workspace.tsx`, `page.tsx`, `technician-workbench.tsx`, `shop-users.tsx`, `admin-panel.tsx`, `access.tsx`, `formatRials`, `react`, `lucide-react`, `case-stage-board.tsx`, `package.json`, `case-procurement.tsx`, `persian-date.ts`, `finance-case-view.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 72 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 72 INFERRED edges - model-reasoned connections that need verification._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07399577167019028 - nodes in this community are weakly interconnected._
- **Why does `v2_case()` connect `technician-service.php` to `v2_text`, `tamiran_id`, `workflow-v2.php`, `case_invoice_correct`, `v2-core.php`, `external_purchase_change`, `quality_run`, `v2-core.php`, `TamiranApiException`, `گزارش تثبیت تعمیران`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._