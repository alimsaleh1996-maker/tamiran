# Graph Report - tamiran-v1  (2026-11-26)

## Corpus Check
- 165 files · ~171,661 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: .css 11, (none) 8, .woff2 3)

## Summary
- 1609 nodes · 4826 edges · 89 communities (64 shown, 25 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1085 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4cabfba9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- technician-service.php
- tamiran_json_body
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
- {closure#2}
- case_invoice_correct
- catalog-import.tsx
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
- ModuleRouter
- CHANGELOG.md
- directadmin-api.ts
- {closure#2}
- customer-portal.tsx
- catalog-similarity.php
- DATABASE-MIGRATIONS.md
- case-stage-board.tsx
- check_quality_browser
- DEPLOYMENT.md
- package_test.py
- issue_once_concurrently
- TamiranApiException
- run
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
- useModalFocus
- shop-users.tsx
- {closure#1}
- reception-draft-mutations.ts
- reception-ui-contract.ts
- quality_run
- build.mjs
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- synthetic_imei
- captcha_audio.py
- tamiran_captcha_audio
- operations.ts
- design-qa.md

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 230 edges
2. `v2_text()` - 64 edges
3. `tamiran_id()` - 63 edges
4. `tamiran_audit()` - 60 edges
5. `expect()` - 52 edges
6. `Client` - 49 edges
7. `v2_case()` - 43 edges
8. `v2_require_permission()` - 42 edges
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
- `ReceptionPage()` --indirect_call--> `createReceptionDraftMutationQueue()`  [INFERRED]
  hosting/frontend/src/app/tamiran/modules.tsx → hosting/frontend/src/app/software/reception-draft-mutations.ts

## Import Cycles
- None detected.

## Communities (89 total, 25 thin omitted)

### Community 0 - "technician-service.php"
Cohesion: 0.29
Nodes (23): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_diagnosis(), technician_editable() (+15 more)

### Community 1 - "tamiran_json_body"
Cohesion: 0.17
Nodes (9): tamiran_json_body(), client_error_text(), {closure#1}(), {closure#1}(), {closure#2}(), price_catalog_rows(), {closure#1}(), ticket_require_access() (+1 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.09
Nodes (36): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+28 more)

### Community 3 - "{closure#2}"
Cohesion: 0.10
Nodes (28): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+20 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.09
Nodes (48): directAdminRequest(), createV2Estimate(), deliveryV2Action(), financeV2Action(), inventoryControlV2Action(), jsonPost(), loadV2Delivery(), loadV2Finance() (+40 more)

### Community 5 - "v2_case"
Cohesion: 0.14
Nodes (28): manager_followup_queue(), manager_operations_report(), manager_update_case(), v2_case(), v2_json(), v2_notify(), v2_require_case_access(), v2_transition_role_allowed() (+20 more)

### Community 7 - "operations.php"
Cohesion: 0.10
Nodes (39): tamiran_encrypt_secret(), tamiran_tracking_token(), tamiran_uuid_v7(), tamiran_validate_national_code(), {closure#10}(), {closure#13}(), {closure#14}(), {closure#4}() (+31 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (81): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+73 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.13
Nodes (21): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+13 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.05
Nodes (35): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+27 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.08
Nodes (35): admin_shop_summary(), {closure#1}(), {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_db(), tamiran_domain_root(), tamiran_fail() (+27 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.16
Nodes (26): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+18 more)

### Community 14 - "workflowV2Action"
Cohesion: 0.24
Nodes (11): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), changeExternalPurchase(), ExternalPurchase (+3 more)

### Community 15 - "modules.tsx"
Cohesion: 0.08
Nodes (26): Address, CustomerAddress(), FollowUpKind, FollowUpPriority, followUpPriorityLabels, FollowUpStatus, followUpStatusLabels, initialCaseFollowUps (+18 more)

### Community 16 - "expect"
Cohesion: 0.12
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), run() (+11 more)

### Community 17 - "client-diagnostics.ts"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 18 - "{closure#2}"
Cohesion: 0.46
Nodes (5): {closure#2}(), purchase_list(), purchase_optional(), purchase_scope(), purchase_update()

### Community 19 - "case_invoice_correct"
Cohesion: 0.36
Nodes (8): case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line(), technician_money()

### Community 20 - "catalog-import.tsx"
Cohesion: 0.06
Nodes (51): dependencies, fflate@0.8.3, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, devDependencies, @types/node@22.19.19 (+43 more)

### Community 21 - "v2-core.php"
Cohesion: 0.12
Nodes (24): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_hold_reason(), v2_identity_normalized(), v2_identity_value() (+16 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.20
Nodes (23): InvoiceCatalogForm(), addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay() (+15 more)

### Community 23 - "{closure#1}"
Cohesion: 0.14
Nodes (21): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, admin_user_mobile(), tamiran_config(), tamiran_decrypt_secret() (+13 more)

### Community 24 - "admin-users.php"
Cohesion: 0.18
Nodes (14): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_payload(), {closure#9}(), shop_user_assert_managed() (+6 more)

### Community 25 - "case-procurement.tsx"
Cohesion: 0.18
Nodes (20): fa, ProcurementDocuments(), ProcurementForm(), ReceiveDocument(), Run, statusLabels, formatToman(), MoneyInput() (+12 more)

### Community 26 - "technical-case-workspace.tsx"
Cohesion: 0.11
Nodes (34): blank(), costLabels, date(), Draft, message(), TechnicalCaseWorkspace(), titles, TechnicalFile (+26 more)

### Community 27 - "tamiran_audit"
Cohesion: 0.24
Nodes (23): v2_require_permission(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide(), inventory_control_payload(), inventory_hot_review() (+15 more)

### Community 28 - "access.tsx"
Cohesion: 0.15
Nodes (22): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+14 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.21
Nodes (20): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+12 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "compact-receipt.tsx"
Cohesion: 0.12
Nodes (18): WorkspaceProfile, Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText() (+10 more)

### Community 32 - "v2-api.ts"
Cohesion: 0.07
Nodes (34): fa(), FollowReason, followTitles, OperationsFollowups(), loadMore(), openCase(), saveNote(), OperationsPerformance() (+26 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "external_purchase_change"
Cohesion: 0.27
Nodes (9): external_purchase_add_catalog(), external_purchase_change(), external_purchase_event(), external_purchase_receive_into_stock(), external_purchase_rows(), external_purchase_view(), operations_policy(), operations_policy_defaults() (+1 more)

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
Cohesion: 0.18
Nodes (9): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.2, تغییرات 1.0.0-rc.3, تغییرات 1.0.0-rc.4, تغییرات 1.0.0-rc.5 (+1 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (31): CapabilityCatalog(), stateLabels, DeviceCatalogItem, initialDeviceCatalog, legacyDeviceTypeLabels, AdminBranch, AdminDashboard, AdminShop (+23 more)

### Community 40 - "{closure#2}"
Cohesion: 0.27
Nodes (8): admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_temporary_password(), admin_text(), {closure#2}()

### Community 41 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 42 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 44 - "case-stage-board.tsx"
Cohesion: 0.71
Nodes (4): CaseStageBoard(), initialStageForStatuses(), repairStages, stageForStatus()

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "TamiranApiException"
Cohesion: 0.18
Nodes (19): v2_require_capability(), v2_scope(), v2_stock_mutate(), TamiranApiException, tamiran_captcha_image(), {closure#1}(), {closure#2}(), inventory_v2_finalize_issue() (+11 more)

### Community 50 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 52 - "ReceptionPage"
Cohesion: 0.16
Nodes (15): displayDeviceType(), printCompactReceipt(), createCatalogItem(), discardReceptionDraft(), lookupCustomer(), saveReceptionDraft(), Field(), normalizeDeviceColors() (+7 more)

### Community 70 - "WORKFLOW.md"
Cohesion: 0.50
Nodes (3): دریافت فیزیکی, عیب‌یابی، خرید و پایان تعمیر, گردش مرحلهٔ اول

### Community 72 - "run"
Cohesion: 0.18
Nodes (10): check_case_procurement(), check_finance_delivery_browser(), check_operations_browser(), check_quality_browser(), check_supply_browser(), open_as(), run(), command() (+2 more)

### Community 73 - "run"
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "finance_issue"
Cohesion: 0.44
Nodes (11): v2_financial_event(), tamiran_id(), {closure#2}(), finance_advance_readiness(), finance_draft_items(), finance_invoice_case(), finance_issue(), finance_payload() (+3 more)

### Community 75 - "moduleErrorMessage"
Cohesion: 0.27
Nodes (17): saveShopSetting(), updateCatalogItem(), updateShopSettings(), AccountSettings(), BaseDataSettings(), InventorySettings(), moduleErrorMessage(), ReceiptSettings() (+9 more)

### Community 76 - "useModalFocus"
Cohesion: 0.38
Nodes (6): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog()

### Community 77 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 78 - "{closure#1}"
Cohesion: 0.38
Nodes (9): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+1 more)

### Community 79 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 80 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 83 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 85 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.20
Nodes (9): 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت, 1.0.0-rc.1 — گردش کامل تعمیر در محیط آزمایشی, 1.0.0-rc.2 — صف پیگیری و بازکاری, 1.0.0-rc.3 — تطبیق پنل تکنسین با نمونهٔ نسخهٔ هفتم, 1.0.0-rc.4 — تأمین قطعه، مدیریت، کنترل کیفیت و تحویل, 1.0.0-rc.5 — نمایش پرونده در صف مالی (+1 more)

### Community 86 - "{closure#1}"
Cohesion: 0.57
Nodes (5): {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 87 - "synthetic_imei"
Cohesion: 0.09
Nodes (23): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+15 more)

### Community 88 - "captcha_audio.py"
Cohesion: 0.20
Nodes (4): check(), save(), SmokeFailure, svg_captcha()

### Community 91 - "operations.ts"
Cohesion: 0.09
Nodes (22): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), CreateInventoryItemInput, CreatePartRequestInput, CreateRepairCaseInput, CustomerLookupResult, emptyOperationalSnapshot (+14 more)

## Knowledge Gaps
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `technician-service.php`, `tamiran_json_body`, `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `{closure#2}`, `case_invoice_correct`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_audit`, `tamiran_require_csrf`, `followups.php`, `external_purchase_change`, `{closure#2}`, `finance_issue`, `{closure#1}`, `quality_run`, `{closure#1}`, `tamiran_captcha_audio`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 208 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 208 INFERRED edges - model-reasoned connections that need verification._
- **Should `directadmin-api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08636977058029689 - nodes in this community are weakly interconnected._
- **Why does `react` connect `case-procurement.tsx` to `v2-api.ts`, `directadmin-api.ts`, `v2-workspace.tsx`, `directadmin-api.ts`, `admin-panel.tsx`, `customer-portal.tsx`, `useModalFocus`, `case-stage-board.tsx`, `workflowV2Action`, `modules.tsx`, `shop-users.tsx`, `client-diagnostics.ts`, `catalog-import.tsx`, `persian-date.ts`, `technical-case-workspace.tsx`, `operations.ts`, `access.tsx`, `compact-receipt.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Should `{closure#2}` be split into smaller, more focused modules?**
  _Cohesion score 0.10365853658536585 - nodes in this community are weakly interconnected._
- **Are the 60 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 60 INFERRED edges - model-reasoned connections that need verification._