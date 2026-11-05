#!/usr/bin/env python3
"""Real loopback HTTP regressions for full dashboard scope and V2 ownership.

Creates one isolated TEST-TAMIRAN shop and 251 genuine reception records using
the application APIs. Requires the installed synthetic admin credentials through
TAMIRAN_SMOKE_ADMIN_PASSWORD. No real SMS/payment or external hosts are used.
"""
import argparse
import datetime as dt
import os
import secrets
import sys
from urllib.parse import urlsplit

from smoke import Client, Runner, SmokeFailure, expect


def run(args):
    url = urlsplit(args.url)
    expect(url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1"), "loopback HTTP only")
    password = os.environ["TAMIRAN_SMOKE_ADMIN_PASSWORD"]
    marker = "TEST-TAMIRAN-REG-" + secrets.token_hex(4).upper()
    prefix = "0999" + str(secrets.randbelow(90000) + 10000)
    runner = Runner(args.report)
    runner.metadata = {"fixture_marker": marker, "base_url": args.url, "synthetic_cases_created": 251}
    admin = Client(args.url)
    runner.check("administrator genuine captcha login", lambda: admin.login(args.admin_mobile, password))
    shop = runner.check("create isolated regression shop through API", lambda: admin.api("admin.php", "POST", {
        "name": marker, "repairType": "digital", "managerName": marker + "-MANAGER", "managerMobile": prefix + "01",
        "expiresAt": (dt.date.today() + dt.timedelta(days=365)).isoformat(), "productProfile": "pro",
        "inventoryMode": "off", "qcMode": "off", "modules": ["repair"], "maxUsers": 5,
        "idempotencyKey": marker + "-SHOP",
    }))
    manager = Client(args.url)
    actor = manager.login(prefix + "01", shop["temporaryPassword"])
    staff_password = "TEST-Tamiran!" + secrets.token_hex(10)
    manager.api("auth.php", "POST", {"action": "change_initial_password", "newPassword": staff_password, "confirmation": staff_password})
    manager.token()
    admin.api("admin-users.php", "POST", {"shopId": actor["shop"]["id"], "branchIds": [actor["branch"]["id"]],
        "displayName": marker + "-TECH", "mobile": prefix + "02", "password": staff_password, "role": "technician"})
    # A sole eligible technician is assigned automatically by the product's
    # singleton policy, even when queue mode is requested. Two technicians make
    # this a genuine unassigned queue fixture instead of testing that policy.
    admin.api("admin-users.php", "POST", {"shopId": actor["shop"]["id"], "branchIds": [actor["branch"]["id"]],
        "displayName": marker + "-SECOND-TECH", "mobile": prefix + "04", "password": staff_password, "role": "technician"})
    technician = Client(args.url)
    tech_actor = technician.login(prefix + "02", staff_password)
    catalog = manager.api("catalog.php", "POST", {"type": "موبایل", "brand": marker, "model": marker})
    model_id = next(row["id"] for row in catalog["items"] if row["model"] == marker)
    manager.api("settings.php", "PATCH", {"receiptTerms": {"title": marker, "body": marker + " synthetic acceptance terms"}})
    terms = manager.api("settings.php")["activeReceiptTerms"]
    created = []
    def create_all():
        for index in range(251):
            response = manager.api("operations.php", "POST", {
                "action": "create_case", "customerName": marker, "customerMobile": prefix + "03",
                "deviceModelId": model_id, "identifier": marker + f"-DEVICE-{index}", "declaredIssue": marker,
                "customerConsent": {"dataHandling": "no_erasure"}, "assignmentMode": "queue",
                "idempotencyKey": marker + f"-CASE-{index}",
                "receiptAcceptance": {"accepted": True, "publicId": terms["public_id"], "contentSha256": terms["content_sha256"]},
            })
            created.append(response["repairCase"])
        expect(len({row["id"] for row in created}) == 251, "created cases are not unique")
    runner.check("251 genuine reception cases persist", create_all)
    page = runner.check("first page returns capped list", lambda: manager.api("operations.php"))
    runner.check("full active aggregate exceeds list limit", lambda: expect(page["summary"]["activeCases"] == 251 and len(page["cases"]) == 250, "aggregate was truncated to page length"))
    runner.check("full awaiting-assignment aggregate exceeds list limit", lambda: expect(page["summary"]["awaitingAssignment"] == 251, "awaiting count truncated"))
    runner.check("first page exposes full scoped total and continuation", lambda: expect(page["casesPage"] == {"offset": 0, "limit": 250, "returned": 250, "total": 251, "hasMore": True}, "first-page metadata wrong"))
    last = runner.check("caseOffset250 returns remainder", lambda: manager.api("operations.php?caseOffset=250"))
    runner.check("second page has one case and no continuation", lambda: expect(len(last["cases"]) == 1 and last["casesPage"] == {"offset": 250, "limit": 250, "returned": 1, "total": 251, "hasMore": False}, "second-page metadata wrong"))
    runner.check("pagination has no duplicate or missing IDs", lambda: expect({row["id"] for row in page["cases"] + last["cases"]} == {row["id"] for row in created}, "pagination ID set wrong"))
    runner.check("second page preserves full aggregate", lambda: expect(last["summary"]["activeCases"] == 251, "aggregate depended on offset"))
    runner.check("unassigned technician sees no cases or aggregate", lambda: expect(technician.api("operations.php")["casesPage"]["total"] == 0 and technician.api("operations.php")["summary"]["activeCases"] == 0, "technician aggregate escaped assignment scope"))
    for offset in ("-1", "1.5", "10000000", "01", "bad"):
        runner.check("invalid offset rejected " + offset, lambda offset=offset: manager.api("operations.php?caseOffset=" + offset, expected=400))
    selected = created[0]
    expect(selected["hasWorkflow"] is True, "V2 case does not expose hasWorkflow")
    workflow_before = manager.api("workflow-v2.php?caseId=" + str(selected["id"]))["cases"][0]
    runner.check("ordinary PATCH cannot reassign V2 ownership", lambda: manager.api("operations.php", "PATCH", {
        "id": selected["id"], "expectedVersion": selected["expectedVersion"], "assignedToUserId": tech_actor["id"],
    }, expected=409))
    ordinary = manager.api("operations.php?receipt=" + str(selected["receiptSequence"]))["repairCase"]
    workflow_after = manager.api("workflow-v2.php?caseId=" + str(selected["id"]))["cases"][0]
    runner.check("rejected reassignment leaves both owners and versions unchanged", lambda: expect(
        ordinary["assignedToUserId"] == selected["assignedToUserId"] and ordinary["expectedVersion"] == selected["expectedVersion"]
        and workflow_after["primaryTechnicianUserId"] == workflow_before["primaryTechnicianUserId"]
        and workflow_after["lockVersion"] == workflow_before["lockVersion"], "rejected reassignment mutated a record"))
    runner.check("workflow assignment API accepts technician", lambda: manager.api("workflow-v2.php", "POST", {
        "action": "assign", "caseId": selected["id"], "technicianUserId": tech_actor["id"], "reason": marker,
    }))
    ordinary = manager.api("operations.php?receipt=" + str(selected["receiptSequence"]))["repairCase"]
    workflow = manager.api("workflow-v2.php?caseId=" + str(selected["id"]))["cases"][0]
    runner.check("workflow assignment updates both ownership records", lambda: expect(
        ordinary["assignedToUserId"] == tech_actor["id"] == workflow["primaryTechnicianUserId"] and workflow["status"] == "assigned", "assignment records diverged"))
    runner.check("assigned technician gets exactly one scoped case", lambda: expect(technician.api("operations.php")["casesPage"]["total"] == 1 and technician.api("operations.php")["summary"]["activeCases"] == 1, "assigned technician scope wrong"))
    runner.check("manager aggregate remains251 after workflow assignment", lambda: expect(manager.api("operations.php")["summary"]["activeCases"] == 251, "assignment changed total active count"))
    runner.save()
    print(f"SUMMARY {len(runner.results)} regression checks passed", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8085")
    parser.add_argument("--admin-mobile", default="09120000000")
    parser.add_argument("--report", default="/workspace/scratch/tamiran-php-regression.json")
    try:
        run(parser.parse_args())
    except Exception as error:
        print(f"REGRESSION FAILED: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
