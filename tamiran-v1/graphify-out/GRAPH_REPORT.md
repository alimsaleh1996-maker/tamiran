# Graph Report - tamiran-v1  (2026-11-26)

## Corpus Check
- 168 files · ~186,686 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 15, (none) 8, .woff2 3)

## Summary
- 1743 nodes · 5223 edges · 96 communities (72 shown, 24 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1155 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bcfbf2a3`
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
- operations.ts
- expect
- {closure#2}
- run
- workflow-v2.php
- package.json
- v2-core.php
- persian-date.ts
- {closure#1}
- admin-users.php
- finance-case-view.tsx
- technician-workbench.tsx
- customer-portal.tsx
- ModuleRouter
- tamiran_require_csrf
- followups.php
- catalog-import.tsx
- manager-operations.tsx
- شواهد نسخهٔ PHP تعمیران
- external_purchase_change
- compilerOptions
- package.py
- run
- CHANGELOG.md
- directadmin-api.ts
- v2_text
- CentralAdminPanel
- SalesSection
- DATABASE-MIGRATIONS.md
- moduleErrorMessage
- check_quality_browser
- DEPLOYMENT.md
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
- README.md
- run
- run
- tamiran_id
- reception-ui-contract.ts
- tamiran_require_actor
- technical-case-workspace.tsx
- آزمون‌های نسخهٔ توسعه
- {closure#1}
- TamiranApiException
- quality_run
- run
- modules.tsx
- catalog-similarity.ts
- jsonPost
- case_invoice_correct
- synthetic_imei
- catalog-similarity.php
- build.mjs
- captcha_audio.py
- dependencies
- frontend_contracts.test.mjs
- design-qa.md
- SupportTickets
- version.ts

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
- `{closure#1}()` --calls--> `TamiranApiException`  [INFERRED]
  hosting/public_html/api/inventory-v2.php → hosting/public_html/api/bootstrap.php
- `ReceptionPage()` --indirect_call--> `createReceptionDraftMutationQueue()`  [INFERRED]
  hosting/frontend/src/app/tamiran/modules.tsx → hosting/frontend/src/app/software/reception-draft-mutations.ts

## Import Cycles
- None detected.

## Communities (96 total, 24 thin omitted)

### Community 0 - "access.tsx"
Cohesion: 0.11
Nodes (25): ClientDiagnosticKind, diagnosticFetch(), installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State, accessErrorMessage(), AccessGateway() (+17 more)

### Community 1 - "MoneyInput"
Cohesion: 0.14
Nodes (23): WorkspaceProfile, fa, ProcurementDocuments(), ProcurementForm(), ReceiveDocument(), Run, statusLabels, formatToman() (+15 more)

### Community 2 - "directadmin-api.ts"
Cohesion: 0.10
Nodes (34): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+26 more)

### Community 3 - "{closure#2}"
Cohesion: 0.08
Nodes (36): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+28 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.08
Nodes (49): directAdminRequest(), formatHandoverTime(), printHandoverReceipt(), timeFormatter, matchesQueueSearch(), loadV2Delivery(), loadV2FinanceWorkspace(), loadV2Inventory() (+41 more)

### Community 5 - "v2_case"
Cohesion: 0.28
Nodes (22): technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_confirm_receipt(), technician_cost_state(), technician_declared_issues(), technician_device_password() (+14 more)

### Community 6 - "smoke.py"
Cohesion: 0.12
Nodes (3): main(), main(), main()

### Community 7 - "operations.php"
Cohesion: 0.10
Nodes (40): tamiran_require_csrf(), tamiran_tracking_token(), tamiran_uuid_v7(), tamiran_validate_national_code(), {closure#10}(), {closure#13}(), {closure#14}(), {closure#2}() (+32 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.06
Nodes (40): AdminModalState, AdminSection, adminSections, BackupSection(), BackupSettingsForm(), BackupState(), backupTableLabel(), billingPeriodLabels (+32 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.13
Nodes (21): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+13 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.04
Nodes (43): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+35 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.09
Nodes (33): admin_shop_summary(), {closure#3}(), {closure#5}(), tamiran_actor(), tamiran_api(), tamiran_config(), tamiran_csrf_token(), tamiran_db() (+25 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.17
Nodes (25): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+17 more)

### Community 14 - "compact-receipt.tsx"
Cohesion: 0.16
Nodes (19): Activity, Attachment, CaseTools(), CaseToolsDisclosure(), CompactReceipt(), CompactReceiptProps, dateText(), DEFAULT_RECEIPT_SIZE (+11 more)

### Community 15 - "operations.ts"
Cohesion: 0.09
Nodes (23): buildCaseMutationRequest(), CaseMutationRequest, checkedInteger(), CreateInventoryItemInput, CreatePartRequestInput, CreateRepairCaseInput, CustomerLookupResult, emptyOperationalSnapshot (+15 more)

### Community 16 - "expect"
Cohesion: 0.11
Nodes (19): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+11 more)

### Community 17 - "{closure#2}"
Cohesion: 0.46
Nodes (5): {closure#2}(), purchase_list(), purchase_optional(), purchase_scope(), purchase_update()

### Community 18 - "run"
Cohesion: 0.18
Nodes (10): run(), check_cashier_invoice(), create(), estimate(), finish(), projection(), queued_case(), receive() (+2 more)

### Community 19 - "workflow-v2.php"
Cohesion: 0.18
Nodes (25): external_purchase_catalog(), v2_case(), v2_json(), v2_require_case_access(), tamiran_request_id(), {closure#8}(), workflow_v2_active_technician(), workflow_v2_activity() (+17 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (22): devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7, @vitejs/plugin-react@6.0.2 (+14 more)

### Community 21 - "v2-core.php"
Cohesion: 0.12
Nodes (28): inventory_v2_route_after_parts(), v2_case_blockers(), v2_closure_outcome(), v2_delivery_identity(), v2_delivery_replay(), v2_finance_blockers(), v2_hold_reason(), v2_identity_normalized() (+20 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.14
Nodes (31): InvoiceCatalogForm(), fa(), OperationsPerformance(), detailButton(), load(), moreDetails(), openCompleted(), addGregorianDays() (+23 more)

### Community 23 - "{closure#1}"
Cohesion: 0.15
Nodes (19): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_decrypt_secret(), tamiran_digits(), tamiran_mobile() (+11 more)

### Community 24 - "admin-users.php"
Cohesion: 0.18
Nodes (14): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+6 more)

### Community 25 - "finance-case-view.tsx"
Cohesion: 0.12
Nodes (28): AdvancePaymentView(), clearPayment(), submit(), ConfirmAmount(), count, dateLabel(), FinanceHeader(), isOpenFinanceInvoice() (+20 more)

### Community 26 - "technician-workbench.tsx"
Cohesion: 0.16
Nodes (19): readTechnicalScreen(), technicalCaseFromLocation(), TechnicalScreen, technicalScreens, technicalStageScreen(), writeTechnicalLocation(), HandoverItems(), HandoverSummary() (+11 more)

### Community 27 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 28 - "ModuleRouter"
Cohesion: 0.30
Nodes (23): printCompactReceipt(), AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal() (+15 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.23
Nodes (17): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+9 more)

### Community 30 - "followups.php"
Cohesion: 0.18
Nodes (21): tamiran_json_body(), tamiran_require_writable_actor(), {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find() (+13 more)

### Community 31 - "catalog-import.tsx"
Cohesion: 0.22
Nodes (13): fflate@0.8.3, CatalogImport(), CatalogImportRow, catalogTemplate(), parseCatalogRows(), CatalogName, importCatalogItems(), normalizeQueueSearch() (+5 more)

### Community 32 - "manager-operations.tsx"
Cohesion: 0.07
Nodes (40): disposals, ExternalPurchasePanel(), addCatalog(), submit(), labels, toman(), FollowReason, followTitles (+32 more)

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
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 38 - "CHANGELOG.md"
Cohesion: 0.11
Nodes (17): تغییرات 1.0.0-dev.1, تغییرات 1.0.0-dev.2, تغییرات 1.0.0-dev.3, تغییرات 1.0.0-rc.1, تغییرات 1.0.0-rc.10, تغییرات 1.0.0-rc.11, تغییرات 1.0.0-rc.12, تغییرات 1.0.0-rc.13 (+9 more)

### Community 39 - "directadmin-api.ts"
Cohesion: 0.08
Nodes (24): AdminBranch, AdminDashboard, AdminShop, AdminUser, BackupDashboard, BackupHealth, BackupJob, BackupRestore (+16 more)

### Community 40 - "v2_text"
Cohesion: 0.18
Nodes (33): v2_notify(), v2_require_permission(), v2_stock_mutate(), v2_text(), tamiran_audit(), {closure#2}(), inventory_adjustment(), inventory_adjustment_decide() (+25 more)

### Community 41 - "CentralAdminPanel"
Cohesion: 0.20
Nodes (18): AdminEmpty(), AdminLoading(), AdminOverview(), adminSectionFromLocation(), CentralAdminPanel(), daysRemaining(), formatDate(), initials() (+10 more)

### Community 42 - "SalesSection"
Cohesion: 0.15
Nodes (18): errorMessage(), formatMoney(), InvoiceDetails(), InvoiceDocument(), invoiceItemsForShop(), PriceCatalogSection(), ProductChangeFlow(), productLabel() (+10 more)

### Community 44 - "moduleErrorMessage"
Cohesion: 0.25
Nodes (18): saveShopSetting(), updateCatalogItem(), updateShopSettings(), save(), AccountSettings(), BaseDataSettings(), InventorySettings(), moduleErrorMessage() (+10 more)

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "{closure#1}"
Cohesion: 0.24
Nodes (8): tamiran_require_central_admin(), {closure#2}(), price_catalog_rows(), {closure#1}(), product_change_count(), product_change_operation_row(), product_change_precheck(), product_change_shop()

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

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
Cohesion: 0.25
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "tamiran_id"
Cohesion: 0.19
Nodes (23): operations_policy(), operations_policy_defaults(), operations_policy_validate(), operations_policy_with_defaults(), technician_money(), technician_unrepaired(), v2_financial_event(), v2_open_case_advances() (+15 more)

### Community 75 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 76 - "tamiran_require_actor"
Cohesion: 0.23
Nodes (9): tamiran_require_actor(), tamiran_require_shop_manager(), catalog_rows(), catalog_value(), {closure#1}(), operations_scope(), {closure#1}(), ticket_require_access() (+1 more)

### Community 77 - "technical-case-workspace.tsx"
Cohesion: 0.13
Nodes (29): blank(), costLabels, date(), DevicePassword(), reveal(), diagnosisOptions, Draft, message() (+21 more)

### Community 78 - "آزمون‌های نسخهٔ توسعه"
Cohesion: 0.09
Nodes (21): API، داده و ابزارها, آزمون، بسته و استقرار, تکمیل پنج مورد در 1.0.0-rc.12, کنترل ۲۲ اصلاح, گزارش تثبیت تعمیران, 1.0.0-dev.1 — تخصیص اتمی و ارجاع, 1.0.0-dev.2 — دریافت فیزیکی دستگاه, 1.0.0-dev.3 — رسید ارجاع و رسیدگی به مغایرت (+13 more)

### Community 79 - "{closure#1}"
Cohesion: 0.36
Nodes (9): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+1 more)

### Community 80 - "TamiranApiException"
Cohesion: 0.11
Nodes (23): manager_followup_queue(), manager_operations_report(), manager_pulse(), manager_report_cases(), manager_report_dates(), manager_report_params(), manager_report_sources(), manager_update_case() (+15 more)

### Community 81 - "quality_run"
Cohesion: 0.38
Nodes (13): v2_has_permission(), {closure#2}(), quality_ack(), quality_authorize_case(), quality_case_context(), quality_payload(), quality_receipt(), quality_replace_template() (+5 more)

### Community 82 - "run"
Cohesion: 0.33
Nodes (4): run(), capture(), create(), passes()

### Community 83 - "modules.tsx"
Cohesion: 0.06
Nodes (44): DeviceCatalogItem, displayDeviceType(), initialDeviceCatalog, legacyDeviceTypeLabels, Address, CustomerAddress(), createCatalogItem(), discardReceptionDraft() (+36 more)

### Community 84 - "catalog-similarity.ts"
Cohesion: 0.36
Nodes (10): brandAliases, catalogBrand(), catalogDistance(), catalogMatch(), catalogText(), catalogType(), compact(), digits() (+2 more)

### Community 85 - "jsonPost"
Cohesion: 0.29
Nodes (11): accessoryLabels(), DeliveryCaseForm(), reportDiscrepancy(), sendOtp(), submit(), deliveryImeiError(), evidenceMethods, normalizeDeliveryImei() (+3 more)

### Community 86 - "case_invoice_correct"
Cohesion: 0.38
Nodes (8): case_invoice_authorized_amount(), case_invoice_correct(), case_invoice_default(), case_invoice_preview(), case_invoice_public(), case_invoice_record(), case_invoice_saved(), case_invoice_service_line()

### Community 87 - "synthetic_imei"
Cohesion: 0.17
Nodes (10): run(), upload(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+2 more)

### Community 88 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 89 - "build.mjs"
Cohesion: 0.22
Nodes (5): document, localVite, output, result, root

### Community 90 - "captcha_audio.py"
Cohesion: 0.25
Nodes (3): check(), save(), svg_captcha()

### Community 91 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, react-dom@19.2.6, qrcode, react-dom

### Community 94 - "SupportTickets"
Cohesion: 0.40
Nodes (5): AdminModal(), SupportTickets(), changeTicket(), createTicket(), loadTickets()

### Community 95 - "version.ts"
Cohesion: 0.50
Nodes (3): APP_BUILD_ID, APP_CHANNEL, APP_VERSION

## Knowledge Gaps
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `{closure#2}`, `v2_case`, `operations.php`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `{closure#2}`, `workflow-v2.php`, `v2-core.php`, `{closure#1}`, `admin-users.php`, `tamiran_require_csrf`, `followups.php`, `external_purchase_change`, `v2_text`, `{closure#1}`, `tamiran_id`, `tamiran_require_actor`, `{closure#1}`, `quality_run`, `case_invoice_correct`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 217 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 217 INFERRED edges - model-reasoned connections that need verification._
- **Should `access.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._
- **Why does `react` connect `technical-case-workspace.tsx` to `access.tsx`, `MoneyInput`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `compact-receipt.tsx`, `operations.ts`, `package.json`, `persian-date.ts`, `finance-case-view.tsx`, `technician-workbench.tsx`, `customer-portal.tsx`, `catalog-import.tsx`, `manager-operations.tsx`, `case-stage-board.tsx`, `shop-users.tsx`, `modules.tsx`, `jsonPost`, `dependencies`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 67 inferred relationships involving `v2_text()` (e.g. with `case_invoice_correct()` and `case_invoice_preview()`) actually correct?**
  _`v2_text()` has 67 INFERRED edges - model-reasoned connections that need verification._
- **Should `MoneyInput` be split into smaller, more focused modules?**
  _Cohesion score 0.14039408866995073 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `compact-receipt.tsx` to `access.tsx`, `MoneyInput`, `directadmin-api.ts`, `v2-workspace.tsx`, `admin-panel.tsx`, `customer-portal.tsx`, `technical-case-workspace.tsx`, `operations.ts`, `case-stage-board.tsx`, `modules.tsx`, `package.json`, `jsonPost`, `persian-date.ts`, `shop-users.tsx`, `finance-case-view.tsx`, `technician-workbench.tsx`, `dependencies`, `catalog-import.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._