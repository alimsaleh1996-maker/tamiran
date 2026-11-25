# Graph Report - tamiran-v1  (2026-11-25)

## Corpus Check
- 155 files · ~154,013 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 10, (none) 8, .woff2 3)

## Summary
- 1445 nodes · 4287 edges · 77 communities (49 shown, 28 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 960 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8928ffd9`
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
- ModuleRouter
- persian-date.ts
- {closure#1}
- admin-users.php
- TechnicalCaseWorkspace
- {closure#2}
- access.tsx
- tamiran_require_csrf
- followups.php
- react
- ReceptionPage
- شواهد نسخهٔ PHP تعمیران
- moduleErrorMessage
- compilerOptions
- package.py
- reception-draft-mutations.ts
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
- run
- case-stage-board.tsx
- KNOWN-ISSUES.md
- tamiran_captcha_audio
- PERMISSIONS.md
- frontend/README.md
- ROLLBACK.md
- WORKFLOW.md
- README.md
- shop-users.tsx
- run
- operations-case-workspace.tsx
- services_test.php
- {closure#1}

## God Nodes (most connected - your core abstractions)
1. `TamiranApiException` - 209 edges
2. `tamiran_id()` - 60 edges
3. `tamiran_audit()` - 55 edges
4. `v2_text()` - 52 edges
5. `Client` - 45 edges
6. `expect()` - 45 edges
7. `tamiran_db()` - 40 edges
8. `tamiran_require_csrf()` - 40 edges
9. `Home()` - 39 edges
10. `v2_require_permission()` - 38 edges

## Surprising Connections (you probably didn't know these)
- `آزمون‌های مرحلهٔ اول` --references--> `v2_transition()`  [INFERRED]
  docs/TEST-REPORT.md → hosting/private/v2-core.php
- `admin_shop_summary()` --calls--> `tamiran_license_state()`  [INFERRED]
  hosting/public_html/api/admin.php → hosting/public_html/api/bootstrap.php
- `{closure#1}()` --calls--> `tamiran_backup_verify()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/backup-engine.php
- `{closure#2}()` --calls--> `tamiran_sms_provider_from_row()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php
- `{closure#3}()` --calls--> `tamiran_sms_verify_otp()`  [INFERRED]
  hosting/tests/services_test.php → hosting/private/sms-service.php

## Import Cycles
- None detected.

## Communities (77 total, 28 thin omitted)

### Community 0 - "tamiran_id"
Cohesion: 0.06
Nodes (112): آزمون‌های مرحلهٔ اول, technician_access(), technician_activities(), technician_activity_add(), technician_billable_parts(), technician_cost_state(), technician_editable(), technician_event() (+104 more)

### Community 1 - "catalog-import.tsx"
Cohesion: 0.07
Nodes (32): fflate@0.8.3, document, localVite, output, result, root, buildCaseMutationRequest(), CaseMutationRequest (+24 more)

### Community 2 - "page.tsx"
Cohesion: 0.07
Nodes (48): invoke(), loadOperationalBootstrap(), OperationalBootstrapCore, OperationalBootstrapLoaders, AccessSessionLoader(), createInventoryItem(), createPartRequest(), createRepairCase() (+40 more)

### Community 3 - "{closure#2}"
Cohesion: 0.09
Nodes (33): tamiran_product_apply(), tamiran_product_assert_transition(), tamiran_product_change_precheck(), tamiran_product_change_service(), tamiran_product_config(), tamiran_product_modules(), tamiran_product_offerings(), tamiran_product_snapshot() (+25 more)

### Community 4 - "v2-workspace.tsx"
Cohesion: 0.09
Nodes (52): directAdminRequest(), createV2Estimate(), deliveryV2Action(), financeV2Action(), inventoryControlV2Action(), jsonPost(), loadTechnicalActivities(), loadTechnicalCase() (+44 more)

### Community 5 - "technical-case-workspace.tsx"
Cohesion: 0.18
Nodes (23): formatToman(), MoneyInput(), moneyDigits(), tomanToRials(), blank(), costLabels, date(), Draft (+15 more)

### Community 6 - "smoke.py"
Cohesion: 0.11
Nodes (3): upload(), main(), main()

### Community 7 - "operations.php"
Cohesion: 0.11
Nodes (35): {closure#10}(), {closure#13}(), {closure#14}(), {closure#4}(), operations_appearance_options(), operations_canonical_value(), operations_case_select(), operations_case_to_api() (+27 more)

### Community 8 - "admin-panel.tsx"
Cohesion: 0.05
Nodes (81): AdminEmpty(), AdminLoading(), AdminModal(), AdminModalState, AdminOverview(), AdminSection, adminSectionFromLocation(), adminSections (+73 more)

### Community 9 - "installer_test.php"
Cohesion: 0.09
Nodes (32): tamiran_install(), tamiran_install_check_config_publication(), tamiran_install_ensure_key(), tamiran_install_is_complete(), tamiran_install_log(), tamiran_install_mobile(), tamiran_install_preflight(), tamiran_install_publish_config() (+24 more)

### Community 10 - "Client"
Cohesion: 0.14
Nodes (20): manager_for(), run(), shop(), main(), submit(), run(), ready(), sql() (+12 more)

### Community 11 - "نصب تعمیران روی هاست PHP"
Cohesion: 0.06
Nodes (32): HTTPS و پراکسی, ثبت رویداد و عیب‌یابی, دامنهٔ آزمون این نسخه, عیب‌یابی, نصب تعمیران روی هاست PHP, نگهداری کلیدها و داده‌ها, پیامک و زمان‌بندی, پیش‌نیازها (+24 more)

### Community 12 - "bootstrap.php"
Cohesion: 0.10
Nodes (25): {closure#5}(), tamiran_api(), tamiran_config(), tamiran_domain_root(), tamiran_encrypt_secret(), tamiran_encryption_key(), tamiran_fail(), tamiran_forget_actor() (+17 more)

### Community 13 - "backup-engine.php"
Cohesion: 0.20
Nodes (23): {closure#1}(), {closure#2}(), tamiran_backup_capture(), tamiran_backup_cleanup(), tamiran_backup_config(), tamiran_backup_file_key(), tamiran_backup_health(), tamiran_backup_identifier() (+15 more)

### Community 14 - "synthetic_imei"
Cohesion: 0.11
Nodes (17): run(), main(), run(), create_all(), Runner, synthetic_imei(), run(), create() (+9 more)

### Community 15 - "modules.tsx"
Cohesion: 0.07
Nodes (30): Address, CustomerAddress(), FollowUpKind, FollowUpPriority, followUpPriorityLabels, FollowUpStatus, followUpStatusLabels, initialCaseFollowUps (+22 more)

### Community 16 - "expect"
Cohesion: 0.12
Nodes (17): expect(), run(), check_ledger(), delivered_state(), installed_wizard(), make_role(), stock_balanced(), SmokeFailure (+9 more)

### Community 17 - "case-tools.tsx"
Cohesion: 0.11
Nodes (24): dependencies, lucide-react@1.31.0, qrcode@1.5.4, react@19.2.6, WorkspaceProfile, Activity, Attachment, CaseTools() (+16 more)

### Community 18 - "TamiranApiException"
Cohesion: 0.09
Nodes (32): v2_require_capability(), v2_scope(), tamiran_db(), tamiran_json_body(), tamiran_require_actor(), tamiran_require_central_admin(), tamiran_require_debug_token(), tamiran_require_shop_manager() (+24 more)

### Community 19 - "directadmin-api.ts"
Cohesion: 0.07
Nodes (31): CapabilityCatalog(), stateLabels, DeviceCatalogItem, initialDeviceCatalog, legacyDeviceTypeLabels, AdminBranch, AdminDashboard, AdminShop (+23 more)

### Community 20 - "package.json"
Cohesion: 0.10
Nodes (24): react-dom@19.2.6, devDependencies, @types/node@22.19.19, @types/qrcode@1.5.6, @types/react@19.2.14, @types/react-dom@19.2.3, typescript@5.9.3, vite@8.3.7 (+16 more)

### Community 21 - "ModuleRouter"
Cohesion: 0.33
Nodes (21): AuditPage(), CaseDetailsModal(), DeliveryPage(), DetailValue(), downloadCsv(), FollowUpComposer(), FollowUpDetailsModal(), HotReturnsPage() (+13 more)

### Community 22 - "persian-date.ts"
Cohesion: 0.20
Nodes (23): InvoiceCatalogForm(), addGregorianDays(), addPersianMonths(), daysInPersianMonth(), formatPersianDate(), gregorianToPersian(), isoFromUtcDate(), isSamePersianDay() (+15 more)

### Community 23 - "{closure#1}"
Cohesion: 0.15
Nodes (19): tamiran_sms_otp_hash(), tamiran_sms_provider_from_row(), tamiran_sms_queue_event(), tamiran_sms_verify_otp(), TamiranKavenegarProvider, tamiran_decrypt_secret(), tamiran_digits(), tamiran_mobile() (+11 more)

### Community 24 - "admin-users.php"
Cohesion: 0.17
Nodes (15): admin_user_assert_mobile_available(), admin_user_assign_branches(), admin_user_branch_ids(), admin_user_clean_email(), admin_user_display_name(), admin_user_mobile(), admin_user_payload(), {closure#9}() (+7 more)

### Community 25 - "TechnicalCaseWorkspace"
Cohesion: 0.21
Nodes (11): readTechnicalScreen(), technicalCaseFromLocation(), TechnicalScreen, technicalScreens, writeTechnicalLocation(), Props, TechnicianWorkbench(), loadV2Workflow() (+3 more)

### Community 26 - "{closure#2}"
Cohesion: 0.24
Nodes (9): admin_date(), admin_module_changes(), admin_modules(), admin_random_public_shop_code(), admin_random_shop_code(), admin_shop_summary(), admin_temporary_password(), admin_text() (+1 more)

### Community 28 - "access.tsx"
Cohesion: 0.16
Nodes (20): diagnosticFetch(), accessErrorMessage(), AccessGateway(), normalizeMobile(), planLabels, profileFromActor(), repairTypeLabels, changeInitialPassword() (+12 more)

### Community 29 - "tamiran_require_csrf"
Cohesion: 0.17
Nodes (23): auth_begin_actor(), auth_candidate_users(), auth_change_initial_password(), auth_contexts(), auth_identify(), auth_profile_from_row(), auth_select_context(), auth_throttle_check() (+15 more)

### Community 30 - "followups.php"
Cohesion: 0.26
Nodes (17): {closure#2}(), {closure#3}(), followup_activity(), followup_due_at(), followup_due_label(), followup_find(), followup_get(), followup_histories() (+9 more)

### Community 31 - "react"
Cohesion: 0.29
Nodes (5): ClientDiagnosticKind, installClientDiagnostics(), reportClientDiagnostic(), DiagnosticBoundary, State

### Community 32 - "ReceptionPage"
Cohesion: 0.15
Nodes (17): displayDeviceType(), printCompactReceipt(), createCatalogItem(), discardReceptionDraft(), lookupCustomer(), saveReceptionDraft(), updateCatalogItem(), BaseDataSettings() (+9 more)

### Community 33 - "شواهد نسخهٔ PHP تعمیران"
Cohesion: 0.12
Nodes (15): اصلاحات مهم نسبت به مرجع, بررسی‌های php.10 — مرکز عملیات و کارهای من, بررسی‌های php.8, بررسی‌های جاری php.5, بررسی‌های جاری php.6, بررسی‌های جاری php.7, بررسی‌های نسخهٔ جاری, سابقهٔ php.7 (+7 more)

### Community 34 - "moduleErrorMessage"
Cohesion: 0.30
Nodes (15): saveShopSetting(), updateShopSettings(), AccountSettings(), InventorySettings(), moduleErrorMessage(), ReceiptSettings(), SectionTitle(), SecuritySettings() (+7 more)

### Community 35 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 36 - "package.py"
Cohesion: 0.29
Nodes (7): digest(), main(), required(), runtime_files(), source_files(), update_files(), write_zip()

### Community 37 - "reception-draft-mutations.ts"
Cohesion: 0.21
Nodes (10): buildDraftDiscardRequest(), buildDraftDiscardSelection(), checkedDraftReference(), createReceptionDraftMutationQueue(), isDraftVersionConflict(), ReceptionDraftDiscardRequest, ReceptionDraftDiscardSelection, ReceptionDraftMutationQueue (+2 more)

### Community 39 - "reception-ui-contract.ts"
Cohesion: 0.21
Nodes (11): ActiveReceiptTerms, buildDraftSubmissionSelection(), buildPreviousDeviceSelection(), buildReceiptAcceptance(), DraftSubmissionSelection, parseActiveReceiptTerms(), positiveInteger(), PreviousDeviceSelection (+3 more)

### Community 40 - "{closure#1}"
Cohesion: 0.38
Nodes (9): tamiran_capability_catalog(), tamiran_capability_discoverable(), tamiran_capability_event(), tamiran_capability_find(), tamiran_capability_permission(), tamiran_capability_require(), tamiran_capability_snapshot(), tamiran_capability_sync_legacy() (+1 more)

### Community 41 - "customer-portal.tsx"
Cohesion: 0.33
Nodes (9): CustomerPortal(), money(), normalizeDigits(), portalError(), statusLabels, CustomerPortalPayload, loadCustomerPortal(), requestCustomerPortalOtp() (+1 more)

### Community 42 - "catalog-similarity.php"
Cohesion: 0.47
Nodes (9): catalog_brand(), catalog_compact(), catalog_distance(), catalog_existing_match(), catalog_existing_spelling(), catalog_match(), catalog_model_signature(), catalog_text() (+1 more)

### Community 44 - "captcha_audio.py"
Cohesion: 0.25
Nodes (3): check(), save(), svg_captcha()

### Community 45 - "check_quality_browser"
Cohesion: 0.36
Nodes (5): assert_fits(), assert_no_errors(), assert_single_column(), check_quality_browser(), contrast()

### Community 49 - "run"
Cohesion: 0.50
Nodes (3): run(), check(), save()

### Community 50 - "case-stage-board.tsx"
Cohesion: 0.29
Nodes (10): layers, lock(), locks, unlock(), useModalFocus(), CaseActionDialog(), CaseStageBoard(), initialStageForStatuses() (+2 more)

### Community 72 - "shop-users.tsx"
Cohesion: 0.23
Nodes (12): createAdminUser(), loadShopUsers(), ShopUser, ShopUserData, updateAdminUser(), Field, fieldError(), Form (+4 more)

### Community 73 - "run"
Cohesion: 0.23
Nodes (8): run(), capture(), check(), create(), save(), simple(), visit(), yes()

### Community 74 - "operations-case-workspace.tsx"
Cohesion: 0.38
Nodes (6): OperationsCaseWorkspace(), Task, tasks, assignV2Case(), transitionV2Case(), V2WorkflowPayload

### Community 75 - "services_test.php"
Cohesion: 0.40
Nodes (5): check(), {closure#1}(), {closure#2}(), {closure#3}(), denied()

## Knowledge Gaps
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TamiranApiException` connect `TamiranApiException` to `tamiran_id`, `{closure#2}`, `operations.php`, `{closure#1}`, `installer_test.php`, `bootstrap.php`, `backup-engine.php`, `{closure#1}`, `tamiran_captcha_audio`, `{closure#1}`, `admin-users.php`, `{closure#2}`, `tamiran_require_csrf`, `followups.php`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 187 inferred relationships involving `TamiranApiException` (e.g. with `tamiran_backup_capture()` and `tamiran_backup_file_key()`) actually correct?**
  _`TamiranApiException` has 187 INFERRED edges - model-reasoned connections that need verification._
- **Should `tamiran_id` be split into smaller, more focused modules?**
  _Cohesion score 0.06165665320594898 - nodes in this community are weakly interconnected._
- **Why does `react` connect `technical-case-workspace.tsx` to `catalog-import.tsx`, `page.tsx`, `v2-workspace.tsx`, `admin-panel.tsx`, `customer-portal.tsx`, `operations-case-workspace.tsx`, `shop-users.tsx`, `modules.tsx`, `case-tools.tsx`, `case-stage-board.tsx`, `directadmin-api.ts`, `package.json`, `persian-date.ts`, `TechnicalCaseWorkspace`, `access.tsx`, `react`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 57 inferred relationships involving `tamiran_id()` (e.g. with `tamiran_backup_restore_shop()` and `tamiran_backup_run()`) actually correct?**
  _`tamiran_id()` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Should `catalog-import.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07272727272727272 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `case-tools.tsx` to `catalog-import.tsx`, `page.tsx`, `v2-workspace.tsx`, `admin-panel.tsx`, `customer-portal.tsx`, `operations-case-workspace.tsx`, `shop-users.tsx`, `modules.tsx`, `case-stage-board.tsx`, `directadmin-api.ts`, `package.json`, `persian-date.ts`, `access.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._