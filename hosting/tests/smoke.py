#!/usr/bin/env python3
"""Real loopback-only PHP/MariaDB smoke tests; no mocks, SMS or payment gateway calls.

Install into a fresh isolated database first. Run the PHP development server with
`-d disable_functions=imagecreatetruecolor` to exercise the supported SVG captcha
fallback. Pass the synthetic initial administrator password via
TAMIRAN_SMOKE_ADMIN_PASSWORD. This script creates TEST-TAMIRAN records and leaves
them available for inspection. It refuses non-loopback destinations.
"""

import argparse
import datetime as dt
import http.cookiejar
import json
import os
from pathlib import Path
import re
import secrets
import sys
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


class SmokeFailure(Exception):
    pass


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.cookies)
        )
        self.csrf = None

    def raw(self, path, method="GET", payload=None, headers=None):
        merged = {"Accept": "application/json"}
        if method != "GET":
            merged.update({"Content-Type": "application/json", "Origin": self.base})
            if self.csrf:
                merged["X-CSRF-Token"] = self.csrf
        merged.update(headers or {})
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=merged)
        try:
            response = self.opener.open(req, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        return response.status, response.headers, response.read()

    def api(self, endpoint, method="GET", payload=None, expected=200, headers=None):
        status, _, body = self.raw("/api/" + endpoint, method, payload, headers)
        try:
            result = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise SmokeFailure(f"{method} {endpoint}: HTTP {status}, response is not JSON") from None
        allowed = expected if isinstance(expected, tuple) else (expected,)
        if status not in allowed:
            error = result.get("error", {})
            message = error.get("message", "") if isinstance(error, dict) else str(error)
            raise SmokeFailure(f"{method} {endpoint}: expected {allowed}, got {status}: {message}")
        if status == 200:
            if result.get("success") is False or result.get("ok") is False:
                raise SmokeFailure(f"{method} {endpoint}: success=false with HTTP 200")
            return result.get("data", result)
        return result

    def token(self):
        self.csrf = self.api("csrf.php")["csrf_token"]
        assert isinstance(self.csrf, str) and len(self.csrf) >= 32
        return self.csrf

    def login(self, mobile, password):
        self.token()
        status, headers, body = self.raw("/api/captcha.php")
        assert status == 200 and "no-store" in headers.get("Cache-Control", "")
        answer = svg_captcha(body)
        result = self.api("auth.php", "POST", {
            "action": "identify", "mobile": mobile, "password": password,
            "captchaAnswer": answer,
        })
        if result.get("requiresContext"):
            raise SmokeFailure("Synthetic account unexpectedly requires multiple branch contexts")
        actor = result["actor"]
        self.token()  # Login regenerates both session ID and CSRF token.
        assert self.api("auth.php")["actor"]["id"] == actor["id"]
        return actor


def svg_captcha(body):
    """Read the actual public SVG's seven-segment image, without session access."""
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        raise SmokeFailure("Captcha must use SVG fallback: start PHP with -d disable_functions=imagecreatetruecolor") from None
    coordinates = {
        (3, 2, 17, 2): "a", (18, 3, 18, 17): "b", (18, 20, 18, 34): "c",
        (3, 35, 17, 35): "d", (2, 20, 2, 34): "e", (2, 3, 2, 17): "f",
        (3, 18, 17, 18): "g",
    }
    digits = {frozenset(segments): digit for digit, segments in {
        "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
        "6": "afgecd", "7": "abc", "8": "abcdefg", "9": "abcdfg",
    }.items()}
    answer = []
    for group in root.iter("{http://www.w3.org/2000/svg}g"):
        if not group.attrib.get("transform", "").startswith("rotate("):
            continue
        offset = 12 + len(answer) * 26
        segments = set()
        for line in group:
            values = tuple(int(line.attrib[key]) for key in ("x1", "y1", "x2", "y2"))
            relative = (values[0] - offset, values[1] - 8, values[2] - offset, values[3] - 8)
            segments.add(coordinates[relative])
        answer.append(digits[frozenset(segments)])
    if len(answer) != 5:
        raise SmokeFailure("Public captcha did not contain five recognized digits")
    return "".join(answer)


class Runner:
    def __init__(self, report):
        self.report = Path(report)
        self.results = []
        self.started = time.monotonic()
        self.metadata = {}

    def check(self, name, function):
        try:
            value = function()
        except Exception as error:
            self.results.append({"name": name, "status": "FAIL", "error": f"{type(error).__name__}: {error}"})
            self.save()
            print("FAIL " + name + ": " + str(error), flush=True)
            raise
        self.results.append({"name": name, "status": "PASS"})
        self.save()
        print("PASS " + name, flush=True)
        return value

    def save(self):
        self.report.parent.mkdir(parents=True, exist_ok=True)
        self.report.write_text(json.dumps({
            "suite": "PHP/MariaDB real HTTP synthetic smoke", "results": self.results,
            **self.metadata,
            "passed": sum(x["status"] == "PASS" for x in self.results),
            "failed": sum(x["status"] == "FAIL" for x in self.results),
            "seconds": round(time.monotonic() - self.started, 2),
            "limits": ["Loopback development HTTP, not shared-host HTTPS", "No browser visual/E2E", "No real SMS or payment gateway requests"],
        }, ensure_ascii=False, indent=2) + "\n")


def expect(value, message):
    if not value:
        raise SmokeFailure(message)
    return value


def run(args):
    parsed = urllib.parse.urlsplit(args.url)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise SmokeFailure("Only a literal loopback HTTP test server is permitted")
    password = os.environ.get("TAMIRAN_SMOKE_ADMIN_PASSWORD", "")
    if not password:
        raise SmokeFailure("Set TAMIRAN_SMOKE_ADMIN_PASSWORD for the synthetic installer admin")
    runner = Runner(args.report)
    marker = "TEST-TAMIRAN-" + (args.run_id or secrets.token_hex(4)).upper()
    runner.metadata = {"fixture_marker": marker, "base_url": args.url}
    prefix = "0999" + str(secrets.randbelow(90000) + 10000)
    mobile = lambda index: prefix + f"{index:02}"
    staff_password = "Test-Tamiran!" + secrets.token_hex(10)
    public = Client(args.url)
    admin = Client(args.url)
    def installed_wizard():
        status, _, body = public.raw("/install/")
        expect(status == 200 and "قبلاً نصب شده" in body.decode(), "installed wizard still open")
        expect(b'<form' not in body, "installer form remained available")
    runner.check("installer is locked after successful setup", installed_wizard)
    for path in ("/private/config.php", "/database/schema.sql", "/.env", "/tests/smoke.py"):
        runner.check("private path blocked " + path, lambda path=path: expect(public.raw(path)[0] in (403, 404), "private path served"))
    runner.check("anonymous operations denied", lambda: public.api("operations.php", expected=401))
    runner.check("staging role spoof does not authenticate", lambda: expect(public.api("auth.php?testRole=repair_manager").get("actor") is None, "testRole authenticated anonymous user"))
    runner.check("legacy setup API disabled", lambda: public.api("setup.php", "POST", {}, expected=(403, 410)))
    actor = runner.check("real captcha CSRF administrator login", lambda: admin.login(args.admin_mobile, password))
    runner.check("central administrator identity", lambda: expect(actor["role"] == "central_admin", "wrong central role"))
    runner.check("administrator central dashboard", lambda: admin.api("admin.php"))
    runner.check("central cannot access shop settings", lambda: admin.api("settings.php", expected=403))

    def create_shop(suffix, index):
        request = {
            "name": marker + "-SHOP-" + suffix, "repairType": "digital",
            "managerName": marker + "-MANAGER-" + suffix, "managerMobile": mobile(index),
            "branchName": marker + "-BRANCH-" + suffix,
            "expiresAt": (dt.date.today() + dt.timedelta(days=365)).isoformat(),
            "productProfile": "pro", "modules": ["repair", "finance", "inventory", "customer_portal"],
            "inventoryMode": "pro" if args.advanced else "simple", "qcMode": "independent" if args.advanced else "off", "maxUsers": 12,
            "idempotencyKey": marker + "-CREATE-" + suffix,
        }
        result = admin.api("admin.php", "POST", request)
        repeated = admin.api("admin.php", "POST", request)
        expect(repeated.get("replayed") and repeated["shopCode"] == result["shopCode"], "shop retry duplicated or changed shop")
        manager = Client(args.url)
        manager_actor = manager.login(mobile(index), result["temporaryPassword"])
        if manager_actor.get("mustChangePassword"):
            manager.api("operations.php", expected=403)
            manager.api("auth.php", "POST", {"action": "change_initial_password", "newPassword": staff_password, "confirmation": staff_password})
            manager.token()
        return manager, manager_actor

    manager, manager_actor = runner.check("create shop A branch manager and idempotent retry", lambda: create_shop("A", 1))
    other, other_actor = runner.check("create isolated shop B and manager", lambda: create_shop("B", 2))
    shop_id = manager_actor["shop"]["id"]
    branch_id = manager_actor["branch"]["id"]
    roles = {}
    for index, role in enumerate(("reception", "technician", "quality_control", "warehouse_keeper", "finance_cashier"), 3):
        def make_role(index=index, role=role):
            admin.api("admin-users.php", "POST", {"shopId": shop_id, "displayName": marker + "-" + role,
                "mobile": mobile(index), "password": staff_password, "role": role, "branchIds": [branch_id]})
            client = Client(args.url)
            profile = client.login(mobile(index), staff_password)
            expect(profile["role"] == role, "role mismatch")
            return client, profile
        roles[role] = runner.check("create and authenticate " + role, make_role)
    branch_reception = branch_warehouse = None
    if args.branch_fixture_php:
        helper = Path(__file__).with_name("create_synthetic_branch.php")
        second_branch = int(subprocess.check_output([args.branch_fixture_php, str(helper), str(shop_id), marker], text=True))
        def make_branch_staff(index, role):
            admin.api("admin-users.php", "POST", {"shopId": shop_id, "displayName": marker + "-BRANCH2-" + role,
                "mobile": mobile(index), "password": staff_password, "role": role, "branchIds": [second_branch]})
            client = Client(args.url)
            client.login(mobile(index), staff_password)
            return client
        branch_reception = runner.check("authenticate second branch reception", lambda: make_branch_staff(31, "reception"))
        branch_warehouse = runner.check("authenticate second branch warehouse", lambda: make_branch_staff(32, "warehouse_keeper"))
    reception = roles["reception"][0]
    technician, technician_actor = roles["technician"]
    finance = roles["finance_cashier"][0]
    warehouse = roles["warehouse_keeper"][0]
    for role, (client, _) in roles.items():
        runner.check(role + " cannot read central administration", lambda client=client: client.api("admin.php", expected=403))
    runner.check("manager cannot read central administration", lambda: manager.api("admin.php", expected=403))
    runner.check("reception cannot alter catalog", lambda: reception.api("catalog.php", "POST", {"type": "bad", "brand": "bad", "model": "bad"}, expected=403))
    runner.check("missing CSRF cannot mutate", lambda: manager.api("settings.php", "PATCH", {"key": "customer_address_policy", "value": {}}, expected=419, headers={"X-CSRF-Token": ""}))
    model_data = runner.check("manager creates device catalog through API", lambda: manager.api("catalog.php", "POST", {"type": "موبایل", "brand": marker, "model": marker + "-MODEL"}))
    model_id = next(int(row["id"]) for row in model_data["items"] if row["model"] == marker + "-MODEL")
    runner.check("manager publishes acceptance terms", lambda: manager.api("settings.php", "PATCH", {"receiptTerms": {"title": marker, "body": marker + " synthetic receipt acceptance text"}}))
    terms = manager.api("settings.php")["activeReceiptTerms"]
    draft_key = marker + "-DRAFT"
    draft_request = {"action": "save_reception_draft", "idempotencyKey": draft_key, "expectedVersion": 0, "payload": {"customerName": marker, "declaredIssue": "synthetic"}}
    saved = runner.check("reception saves draft", lambda: reception.api("operations.php", "POST", draft_request))
    runner.check("stale draft save rejected", lambda: reception.api("operations.php", "POST", draft_request, expected=409))
    runner.check("draft is visible to its owner", lambda: expect(any(row["publicId"] == saved["publicId"] for row in reception.api("operations.php")["receptionDrafts"]), "draft missing"))
    runner.check("draft hidden from another actor", lambda: expect(not any(row["publicId"] == saved["publicId"] for row in manager.api("operations.php")["receptionDrafts"]), "draft leaked to manager"))
    runner.check("another actor cannot overwrite draft key", lambda: manager.api("operations.php", "POST", {**draft_request, "expectedVersion": saved["version"]}, expected=403))
    discardable = runner.check("create independent discardable draft", lambda: reception.api("operations.php", "POST", {**draft_request, "idempotencyKey": marker + "-DISCARD"}))
    runner.check("stale draft discard rejected", lambda: reception.api("operations.php", "POST", {"action": "discard_reception_draft", "draftPublicId": discardable["publicId"], "expectedVersion": 0}, expected=409))
    runner.check("owner discards matching draft version", lambda: reception.api("operations.php", "POST", {"action": "discard_reception_draft", "draftPublicId": discardable["publicId"], "expectedVersion": discardable["version"]}))
    case_request = {
        "action": "create_case", "customerName": marker + "-CUSTOMER", "customerMobile": mobile(20),
        "deviceModelId": model_id, "identifier": marker + "-DEVICE", "declaredIssue": marker + "-ISSUE",
        "customerConsent": {"dataHandling": "no_erasure"}, "accessories": [], "appearanceStates": [],
        "assignedToUserId": technician_actor["id"], "assignmentMode": "automatic",
        "idempotencyKey": draft_key, "draftPublicId": saved["publicId"],
        "draftExpectedVersion": saved.get("version", saved.get("expectedVersion", 1)),
        "receiptAcceptance": {"accepted": True, "publicId": terms["public_id"], "contentSha256": terms["content_sha256"]},
    }
    created = runner.check("reception creates real customer device receipt and case", lambda: reception.api("operations.php", "POST", case_request))
    case = created["repairCase"]
    case_id = case["id"]
    admin.api("admin-users.php", "POST", {"shopId": shop_id, "displayName": marker + "-UNASSIGNED", "mobile": mobile(30), "password": staff_password, "role": "technician", "branchIds": [branch_id]})
    unassigned = Client(args.url)
    unassigned.login(mobile(30), staff_password)
    estimate_input = {"action": "estimate_create", "caseId": case_id, "items": [{"type": "labor", "title": marker, "quantity": 1, "unitPrice": 10000}]}
    runner.check("unassigned technician cannot create an estimate", lambda: unassigned.api("workflow-v2.php", "POST", estimate_input, expected=403))
    runner.check("case retry reuses receipt and device", lambda: expect(reception.api("operations.php", "POST", case_request)["repairCase"]["id"] == case_id, "case replay duplicated"))
    runner.check("changed idempotency payload conflicts", lambda: reception.api("operations.php", "POST", {**case_request, "declaredIssue": marker + "-ALTERED"}, expected=409))
    lookup = runner.check("customer lookup returns stored device", lambda: reception.api("operations.php?customerMobile=" + mobile(20)))
    device = next(row for row in lookup["customer"]["devices"] if int(row["id"]) == int(case["deviceId"]))
    second_request = {**case_request, "idempotencyKey": marker + "-EXISTING-DEVICE", "previousDeviceId": device["id"], "expectedDeviceVersion": device["expectedDeviceVersion"]}
    second_request.pop("draftPublicId")
    second_request.pop("draftExpectedVersion")
    runner.check("existing device stale version rejected", lambda: reception.api("operations.php", "POST", {**second_request, "expectedDeviceVersion": device["expectedDeviceVersion"] + 1}, expected=409))
    second = runner.check("existing device accepted with authoritative version", lambda: reception.api("operations.php", "POST", second_request))
    runner.check("repeat visit preserves customer and device IDs", lambda: expect(second["repairCase"]["deviceId"] == case["deviceId"] and second["repairCase"]["customerId"] == case["customerId"], "repeat visit duplicated device or customer"))
    estimate_input["caseId"] = second["repairCase"]["id"]
    estimate = runner.check("manager creates estimate above customer limit", lambda: manager.api("workflow-v2.php", "POST", estimate_input)["estimate"])
    runner.check("unassigned technician cannot send estimate", lambda: unassigned.api("workflow-v2.php", "POST", {"action": "estimate_send", "estimatePublicId": estimate["publicId"]}, expected=403))
    runner.check("foreign shop cannot send estimate", lambda: other.api("workflow-v2.php", "POST", {"action": "estimate_send", "estimatePublicId": estimate["publicId"]}, expected=404))
    if branch_reception:
        runner.check("other branch cannot send estimate", lambda: branch_reception.api("workflow-v2.php", "POST", {"action": "estimate_send", "estimatePublicId": estimate["publicId"]}, expected=(403, 404)))
        runner.check("other branch cannot decide estimate", lambda: branch_reception.api("workflow-v2.php", "POST", {"action": "estimate_decide", "estimatePublicId": estimate["publicId"], "decision": "approved", "channel": "recorded_phone"}, expected=(403, 404)))
    runner.check("manager sends estimate", lambda: manager.api("workflow-v2.php", "POST", {"action": "estimate_send", "estimatePublicId": estimate["publicId"]}))
    decision = {"action": "estimate_decide", "estimatePublicId": estimate["publicId"], "decision": "approved", "channel": "recorded_phone"}
    runner.check("reception records customer approval", lambda: reception.api("workflow-v2.php", "POST", decision))
    runner.check("customer decision cannot be repeated", lambda: reception.api("workflow-v2.php", "POST", decision, expected=409))
    rejected_estimate = runner.check("manager creates a new estimate revision", lambda: manager.api("workflow-v2.php", "POST", estimate_input)["estimate"])
    runner.check("manager sends revised estimate", lambda: manager.api("workflow-v2.php", "POST", {"action": "estimate_send", "estimatePublicId": rejected_estimate["publicId"]}))
    def advance_second(target):
        second_id = second["repairCase"]["id"]
        row = technician.api("workflow-v2.php?caseId=" + str(second_id))["cases"][0]
        return technician.api("workflow-v2.php", "POST", {"action": "transition", "caseId": second_id, "target": target, "lockVersion": row["lockVersion"], "idempotencyKey": marker + "-SECOND-" + target, "reason": marker})
    runner.check("second case enters diagnosis", lambda: advance_second("diagnosing"))
    runner.check("second case enters estimate stage", lambda: advance_second("estimate_pending"))
    runner.check("second case waits for customer decision", lambda: advance_second("awaiting_customer_approval"))
    reject = {"action": "estimate_decide", "estimatePublicId": rejected_estimate["publicId"], "decision": "rejected", "channel": "recorded_phone", "reason": marker}
    runner.check("reception records customer rejection", lambda: reception.api("workflow-v2.php", "POST", reject))
    runner.check("rejected estimate closes case without repair", lambda: expect(manager.api("workflow-v2.php?caseId=" + str(second["repairCase"]["id"]))["cases"][0]["status"] == "returned_unrepaired", "rejected case not closed"))
    patch = {"id": case_id, "expectedVersion": case["expectedVersion"], "operationReport": marker + "-DIAGNOSIS"}
    runner.check("assigned technician writes versioned case report", lambda: technician.api("operations.php", "PATCH", patch))
    runner.check("stale case patch cannot overwrite report", lambda: technician.api("operations.php", "PATCH", patch, expected=409))
    runner.check("tenant B cannot read tenant A case", lambda: expect(marker + "-CUSTOMER" not in json.dumps(other.api("operations.php"), ensure_ascii=False), "cross-tenant customer exposed"))
    runner.check("technician cannot create reception", lambda: technician.api("operations.php", "POST", case_request, expected=403))
    runner.check("warehouse cannot read finance", lambda: warehouse.api("finance-v2.php", expected=403))
    runner.check("finance can read financial workspace", lambda: finance.api("finance-v2.php"))
    runner.check("warehouse can read inventory workspace", lambda: warehouse.api("inventory-v2.php"))
    runner.check("manager creates real inventory and ledger", lambda: manager.api("operations.php", "POST", {"action": "create_inventory_item", "code": marker + "-STOCK", "title": marker + "-PART", "physicalQuantity": 5, "minimumQuantity": 1, "purchasePrice": 1000}))
    for endpoint in ("workflow-v2.php", "my-tasks-v2.php", "capabilities.php", "notifications-v2.php", "followups.php", "tickets.php"):
        runner.check("manager reads " + endpoint, lambda endpoint=endpoint: manager.api(endpoint))
    workflow = technician.api("workflow-v2.php?caseId=" + str(case_id))
    # Workflow shape is preserved from PHP: a list of cases, each with lockVersion.
    rows = workflow.get("cases", workflow.get("workflows", []))
    expect(rows, "created case missing from technician workflow")
    selected = next(row for row in rows if int(row.get("caseId", row.get("id", 0))) == case_id)
    version = int(selected.get("lockVersion", selected.get("lock_version", 0)))
    transition = {"action": "transition", "caseId": case_id, "target": "diagnosing", "lockVersion": version, "idempotencyKey": marker + "-DIAG", "reason": marker}
    runner.check("assigned technician starts diagnosis atomically", lambda: technician.api("workflow-v2.php", "POST", transition))
    runner.check("workflow idempotent transition retry", lambda: technician.api("workflow-v2.php", "POST", transition))
    runner.check("stale workflow update rejected", lambda: technician.api("workflow-v2.php", "POST", {**transition, "idempotencyKey": marker + "-STALE", "target": "repairing"}, expected=409))
    runner.check("foreign tenant cannot mutate case", lambda: other.api("workflow-v2.php", "POST", {**transition, "idempotencyKey": marker + "-FOREIGN"}, expected=(403, 404)))
    def advance(target):
        current = technician.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]
        return technician.api("workflow-v2.php", "POST", {"action": "transition", "caseId": case_id,
            "target": target, "lockVersion": int(current["lockVersion"]),
            "idempotencyKey": marker + "-" + target, "reason": marker})
    if args.advanced:
        inventory = warehouse.api("inventory-v2.php")
        item = next(row for row in inventory["items"] if row["item_code"] == marker + "-STOCK")
        warehouse_id = int(inventory["warehouse"]["id"])
        part = {"action": "request", "caseId": case_id, "itemId": item["id"], "quantity": 2}
        runner.check("assigned technician requests two parts", lambda: technician.api("inventory-v2.php", "POST", part))
        request = next(row for row in warehouse.api("inventory-v2.php")["requests"] if row["case_id"] == case_id)
        reserve = {"action": "reserve", "requestId": request["id"], "quantity": 2, "warehouseId": warehouse_id}
        runner.check("excess reservation is rejected", lambda: warehouse.api("inventory-v2.php", "POST", {**reserve, "quantity": 3}, expected=409))
        runner.check("warehouse reserves requested parts", lambda: warehouse.api("inventory-v2.php", "POST", reserve))
        issue = {"action": "issue", "requestId": request["id"], "quantity": 1, "warehouseId": warehouse_id, "technicianUserId": technician_actor["id"], "idempotencyKey": marker + "-ISSUE-1"}
        first = runner.check("warehouse issues first part", lambda: warehouse.api("inventory-v2.php", "POST", issue))
        if branch_warehouse:
            runner.check("other branch cannot replay issue", lambda: branch_warehouse.api("inventory-v2.php", "POST", issue, expected=(403, 404)))
        runner.check("issue retry is idempotent", lambda: expect(warehouse.api("inventory-v2.php", "POST", issue)["issuePublicId"] == first["issuePublicId"], "issue duplicated"))
        second_issue = runner.check("warehouse issues second part", lambda: warehouse.api("inventory-v2.php", "POST", {**issue, "idempotencyKey": marker + "-ISSUE-2"}))
        consume = {"action": "finalize_issue", "issuePublicId": first["issuePublicId"], "decision": "consumed"}
        returned = {"action": "finalize_issue", "issuePublicId": second_issue["issuePublicId"], "decision": "returned"}
        runner.check("technician consumes first part", lambda: technician.api("inventory-v2.php", "POST", consume))
        runner.check("unassigned technician cannot replay part finalization", lambda: unassigned.api("inventory-v2.php", "POST", consume, expected=403))
        runner.check("issue key cannot replay with different quantity", lambda: warehouse.api("inventory-v2.php", "POST", {**issue, "quantity": 2}, expected=409))
        runner.check("technician returns second part", lambda: technician.api("inventory-v2.php", "POST", returned))
        def stock_balanced():
            current = next(row for row in warehouse.api("inventory-v2.php")["items"] if row["id"] == item["id"])
            expect(current["physical_quantity"] == 4 and current["reserved_quantity"] == 0, "stock or reservations do not balance")
        runner.check("consumption and return balance stock", stock_balanced)
        current = technician.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]
        if current["status"] != "repairing":
            runner.check("technician resumes repair after parts", lambda: advance("repairing"))
        runner.check("repair enters parts closeout", lambda: advance("parts_closeout"))
        runner.check("parts closeout enters independent QC", lambda: advance("qc_pending"))
        if args.quality_browser_output:
            from phase3_quality_browser import check_quality_browser
            check_quality_browser(runner, args.url, manager, args.quality_browser_output)
        qc = roles["quality_control"][0]
        templates = qc.api("quality-v2.php")["templates"]
        workflow_code = technician.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]["workflowCode"]
        template = next(row for row in templates if row["workflow_code"] == workflow_code)
        answers = [{"templateItemId": int(row["id"]), "result": "passed"} for row in template["items"]]
        qc_request = {"action": "run", "caseId": case_id, "templateId": int(template["id"]), "idempotencyKey": marker + "-QC-FAIL", "result": "failed", "failureReason": marker, "items": answers}
        runner.check("independent QC fails repair", lambda: qc.api("quality-v2.php", "POST", qc_request))
        runner.check("failed QC routes to rework", lambda: expect(technician.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]["status"] == "qc_rework", "QC did not route to rework"))
        runner.check("technician starts rework", lambda: advance("repairing"))
        # A distinct transition key is necessary when returning to a previous state.
        def rework_advance(target):
            current = technician.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]
            return technician.api("workflow-v2.php", "POST", {"action": "transition", "caseId": case_id, "target": target, "lockVersion": current["lockVersion"], "idempotencyKey": marker + "-REWORK-" + target, "reason": marker})
        runner.check("rework enters parts closeout", lambda: rework_advance("parts_closeout"))
        runner.check("rework returns to QC", lambda: rework_advance("qc_pending"))
        if args.conditional:
            conditional = runner.check("manager records conditional QC after rework", lambda: manager.api("quality-v2.php", "POST", {**qc_request, "idempotencyKey": marker + "-QC-CONDITIONAL", "result": "conditional", "failureReason": "", "conditionalLimitations": marker}))
            ack = {"action": "ack_conditional", "qcRunPublicId": conditional["publicId"], "channel": "in_person_signature"}
            if branch_reception:
                runner.check("other branch cannot acknowledge conditional QC", lambda: branch_reception.api("quality-v2.php", "POST", ack, expected=(403, 404)))
            runner.check("reception records conditional QC acknowledgement", lambda: reception.api("quality-v2.php", "POST", ack))
            current = manager.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]
            runner.check("acknowledged conditional QC enters finance", lambda: manager.api("workflow-v2.php", "POST", {"action": "transition", "caseId": case_id, "target": "finance_pending", "lockVersion": current["lockVersion"], "idempotencyKey": marker + "-CONDITIONAL-FINANCE", "reason": marker}))
        else:
            runner.check("independent QC passes rework", lambda: qc.api("quality-v2.php", "POST", {**qc_request, "idempotencyKey": marker + "-QC-PASS", "result": "passed", "failureReason": ""}))
        runner.check("completed QC enters finance", lambda: expect(technician.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]["status"] == "finance_pending", "QC did not reach finance"))
    else:
        runner.check("technician advances diagnosis to repairing", lambda: advance("repairing"))
        runner.check("completed repair enters finance with QC disabled", lambda: advance("finance_pending"))
    invoice_request = {"action": "issue", "caseId": case_id, "idempotencyKey": marker + "-INVOICE",
        "items": [{"type": "labor", "title": marker + "-LABOR", "quantity": 1, "saleUnitPrice": 10000, "discountAmount": 0, "taxRate": 0}]}
    invoice = runner.check("finance issues integer-rial invoice", lambda: finance.api("finance-v2.php", "POST", invoice_request))
    runner.check("invoice total is exactly 10000 rials", lambda: expect(invoice["totalAmount"] == 10000, "invoice total mismatch"))
    unpaid_delivery = {"action": "complete", "caseId": case_id, "idempotencyKey": marker + "-UNPAID-DELIVERY", "recipientType": "customer", "recipientFullName": marker + "-CUSTOMER", "recipientMobile": mobile(20), "verificationMethod": "identity_document", "verificationEvidence": {"syntheticDocumentCheck": marker}, "accessoriesConfirmed": []}
    runner.check("unpaid case cannot be delivered", lambda: reception.api("delivery-v2.php", "POST", unpaid_delivery, expected=409))
    runner.check("invoice retry reuses original invoice", lambda: expect(finance.api("finance-v2.php", "POST", invoice_request)["publicId"] == invoice["publicId"], "invoice duplicated"))
    payment_request = {"action": "payment", "invoicePublicId": invoice["publicId"], "amount": 10000,
        "method": "cash", "idempotencyKey": marker + "-PAYMENT", "paidByName": marker}
    runner.check("overpayment rejected", lambda: finance.api("finance-v2.php", "POST", {**payment_request, "amount": 10001, "idempotencyKey": marker + "-OVERPAY"}, expected=409))
    payment = runner.check("record synthetic local cash payment", lambda: finance.api("finance-v2.php", "POST", payment_request))
    runner.check("cash payment settles full balance", lambda: expect(payment["remaining"] == 0, "balance not settled"))
    runner.check("payment retry does not double charge", lambda: expect(finance.api("finance-v2.php", "POST", payment_request)["publicId"] == payment["publicId"], "payment duplicated"))
    def check_ledger():
        stored = next(row for row in finance.api("finance-v2.php")["invoices"] if row["public_id"] == invoice["publicId"])
        expect(int(stored["paid_amount"]) == 10000 and int(stored["balance"]) == 0, "stored invoice balance wrong")
        expect(len(stored["payments"]) == 1, "duplicate payment persisted")
        expect(any(row["event_type"] == "payment_received" for row in stored["ledger"]), "payment ledger event missing")
    runner.check("persisted invoice payment and financial ledger agree", check_ledger)
    current = manager.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]
    runner.check("settlement automatically advances to ready for delivery", lambda: expect(current["status"] == "ready_for_delivery", "settled case did not advance automatically"))
    delivery_request = {"action": "complete", "caseId": case_id, "idempotencyKey": marker + "-DELIVERY",
        "recipientType": "customer", "recipientFullName": marker + "-CUSTOMER", "recipientMobile": mobile(20),
        "verificationMethod": "identity_document", "verificationEvidence": {"syntheticDocumentCheck": marker}, "accessoriesConfirmed": []}
    runner.check("technician cannot complete delivery", lambda: technician.api("delivery-v2.php", "POST", delivery_request, expected=403))
    runner.check("missing delivery evidence is rejected", lambda: reception.api("delivery-v2.php", "POST", {**delivery_request, "verificationEvidence": {}}, expected=409))
    delivery = runner.check("reception completes synthetic verified delivery", lambda: reception.api("delivery-v2.php", "POST", delivery_request))
    runner.check("delivery retry returns the same delivery", lambda: expect(reception.api("delivery-v2.php", "POST", delivery_request)["publicId"] == delivery["publicId"], "delivery duplicated"))
    runner.check("delivery key cannot replay for another case", lambda: reception.api("delivery-v2.php", "POST", {**delivery_request, "caseId": second["repairCase"]["id"]}, expected=409))
    runner.check("foreign tenant cannot replay delivery", lambda: other.api("delivery-v2.php", "POST", delivery_request, expected=(403, 404)))
    def delivered_state():
        stored = manager.api("operations.php?receipt=" + str(case["receiptSequence"]))["repairCase"]
        workflow = manager.api("workflow-v2.php?caseId=" + str(case_id))["cases"][0]
        expect(stored["status"] == "delivered" and workflow["status"] == "delivered", "delivery states diverged")
    runner.check("delivery persists both case and workflow final states", delivered_state)
    runner.check("new key cannot deliver an already delivered case", lambda: reception.api("delivery-v2.php", "POST", {**delivery_request, "idempotencyKey": marker + "-DELIVERY-AGAIN"}, expected=409))
    runner.check("foreign origin cannot mutate", lambda: manager.api("settings.php", "PATCH", {}, expected=403, headers={"Origin": "https://evil.invalid"}))
    replacement = Client(args.url)
    runner.check("second genuine login rotates operational session", lambda: replacement.login(mobile(3), staff_password))
    runner.check("previous operational session is revoked", lambda: reception.api("operations.php", expected=401))
    runner.check("new operational session can read cases", lambda: replacement.api("operations.php"))
    runner.check("logout releases session", lambda: replacement.api("auth.php", "DELETE", {}))
    runner.check("logged-out client cannot access cases", lambda: replacement.api("operations.php", expected=401))
    runner.save()
    print(f"SUMMARY {len(runner.results)} real HTTP checks passed; report={runner.report}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8088")
    parser.add_argument("--admin-mobile", default="09990000000")
    parser.add_argument("--run-id")
    parser.add_argument("--advanced", action="store_true", help="Exercise Pro inventory and independent QC")
    parser.add_argument("--quality-browser-output", help="Run real Chromium QC checks and save a synthetic screenshot")
    parser.add_argument("--conditional", action="store_true", help="Exercise conditional QC acknowledgement")
    parser.add_argument("--branch-fixture-php", help="PHP executable for strictly local synthetic branch fixture")
    parser.add_argument("--report", default="/workspace/scratch/tamiran-php-smoke.json")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as error:
        print(f"SMOKE FAILED: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
