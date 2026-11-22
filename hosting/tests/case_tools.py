#!/usr/bin/env python3
"""Real loopback PHP/SQL checks for receipt issuance, private photos and case notes.

Requires the synthetic installation used by smoke.py. Audit failure injection is
restricted to the named synthetic database; no production destination is allowed.
"""
import argparse
import base64
import datetime as dt
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from smoke import Client, Runner, expect, synthetic_imei


def upload(client, case_id=None, purpose="other", content=None, csrf=True, expected=200):
    boundary = "TEST-" + secrets.token_hex(20)
    chunks = []
    fields = {"purpose": purpose}
    if case_id is not None:
        fields["caseId"] = str(case_id)
    for name, value in fields.items():
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="TEST.png"\r\nContent-Type: image/png\r\n\r\n'.encode())
    chunks.append(content if content is not None else base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=="))
    chunks.append(f'\r\n--{boundary}--\r\n'.encode())
    request = urllib.request.Request(client.base + "/api/files-v2.php", data=b"".join(chunks), method="POST", headers={
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Origin": client.base, "X-CSRF-Token": client.csrf if csrf else "", "Accept": "application/json",
    })
    try:
        response = client.opener.open(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    body = json.loads(response.read())
    expect(response.status == expected, f"upload expected {expected}, got {response.status}")
    return body.get("data", body)


def run(args):
    expect(urlsplit(args.url).hostname in ("127.0.0.1", "localhost", "::1"), "loopback only")
    runner = Runner(args.report)
    marker = "TEST-CASE-TOOLS-" + secrets.token_hex(5)
    prefix = "0995" + str(secrets.randbelow(90000) + 10000)
    password = "Test-Only!" + secrets.token_hex(18)
    admin = Client(args.url)
    admin.login("09990000000", os.environ["TAMIRAN_SMOKE_ADMIN_PASSWORD"])

    def manager_for(suffix):
        result = admin.api("admin.php", "POST", {
            "name": marker + suffix, "repairType": "digital", "managerName": marker + suffix,
            "managerMobile": prefix + suffix, "expiresAt": (dt.date.today() + dt.timedelta(days=365)).isoformat(),
            "productProfile": "pro", "inventoryMode": "off", "qcMode": "off", "maxUsers": 10,
            "modules": ["repair"], "idempotencyKey": marker + suffix,
        })
        client = Client(args.url)
        actor = client.login(prefix + suffix, result["temporaryPassword"])
        client.api("auth.php", "POST", {"action": "change_initial_password", "newPassword": password, "confirmation": password})
        client.token()
        return client, actor

    manager, actor = manager_for("01")
    foreign, _ = manager_for("02")
    tech_actors = []
    technicians = []
    for suffix in ("03", "04"):
        admin.api("admin-users.php", "POST", {
            "shopId": actor["shop"]["id"], "branchIds": [actor["branch"]["id"]],
            "displayName": marker + suffix, "mobile": prefix + suffix, "password": password, "role": "technician",
        })
        client = Client(args.url)
        tech_actors.append(client.login(prefix + suffix, password))
        technicians.append(client)
    tech, other = technicians
    catalog = manager.api("catalog.php", "POST", {"type": "موبایل", "brand": marker, "model": marker})
    model = next(item for item in catalog["items"] if item["model"] == marker)
    request = {
        "action": "create_case", "receiptMode": "issue_only", "deviceModelId": model["id"],
        "customerName": marker, "customerMobile": prefix + "05", "identifier": synthetic_imei(),
        "declaredIssue": "TEST touch issue", "customerConsent": {"dataHandling": "coordinate_first"},
        "assignedToUserId": tech_actors[0]["id"], "preapprovedAmount": 7500000, "idempotencyKey": marker,
    }
    case = runner.check("issue-only reception needs no fabricated customer acceptance", lambda: manager.api("operations.php", "POST", request))["repairCase"]
    cid = case["id"]

    def sql(query, read=False):
        code = "$c=require '/app/private/config.php';$d=$c['db'];if($d['host']!=='127.0.0.1'||$d['name']!=='tamiran_users_test')throw new RuntimeException('Synthetic DB required');$p=new PDO('mysql:host=127.0.0.1;port='.$d['port'].';dbname='.$d['name'],$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$q=file_get_contents('php://stdin');"
        code += "echo json_encode($p->query($q)->fetchAll(PDO::FETCH_ASSOC));" if read else "$p->exec($q);"
        result = subprocess.run(["docker", "exec", "-i", args.container, "php", "-r", code], input=query, text=True, check=True, capture_output=True)
        return json.loads(result.stdout) if read else None

    runner.check("issue-only retry returns same case", lambda: expect(manager.api("operations.php", "POST", request)["repairCase"]["id"] == cid, "duplicate reception"))
    runner.check("issue-only amount reads back as integer rials", lambda: expect(case["preapprovedAmount"] == 7500000, "wrong money unit"))
    runner.check("issue-only never writes a consent record", lambda: expect(int(sql(f"SELECT COUNT(*) AS n FROM repair_case_receipt_terms WHERE case_id={cid}", True)[0]["n"]) == 0, "fabricated acceptance"))
    metadata = json.loads(sql(f"SELECT metadata_json FROM repair_case_stage_events WHERE workflow_id=(SELECT id FROM repair_case_workflows WHERE case_id={cid}) AND from_status IS NULL LIMIT 1", True)[0]["metadata_json"])
    runner.check("issue-only event preserves terms snapshot without claiming consent", lambda: expect(metadata["receiptConsentRecorded"] is False and metadata["receiptTermsSnapshot"]["contentSha256"], "missing snapshot or false consent"))
    runner.check("reception retry rejects changed amount", lambda: manager.api("operations.php", "POST", {**request, "preapprovedAmount": 8000000}, expected=409))
    runner.check("upload requires genuine CSRF", lambda: upload(tech, cid, csrf=False, expected=419))
    runner.check("technician upload requires case association", lambda: upload(tech, expected=422))
    runner.check("unassigned technician cannot upload to same-shop case", lambda: upload(other, cid, expected=403))
    runner.check("foreign shop cannot upload to case", lambda: upload(foreign, cid, expected=404))
    runner.check("HTML disguised as PNG is rejected by actual MIME", lambda: upload(tech, cid, content=b"<html>TEST</html>", expected=422))
    runner.check("technician cannot upload identity documents", lambda: upload(tech, cid, "identity", expected=403))
    photo = runner.check("assigned technician uploads a private case photo", lambda: upload(tech, cid))
    public = photo["publicId"]
    runner.check("assigned technician lists own photo", lambda: expect(any(x["publicId"] == public for x in tech.api(f"files-v2.php?caseId={cid}")["files"]), "missing photo"))
    runner.check("assigned technician downloads actual image bytes", lambda: expect(tech.raw("/api/files-v2.php?id=" + public)[2].startswith(b"\x89PNG\r\n\x1a\n"), "not PNG"))
    runner.check("unassigned technician cannot list photos", lambda: other.api(f"files-v2.php?caseId={cid}", expected=403))
    runner.check("unassigned technician cannot download known photo ID", lambda: other.api("files-v2.php?id=" + public, expected=403))
    runner.check("foreign shop cannot download known photo ID", lambda: foreign.api("files-v2.php?id=" + public, expected=404))
    private_doc = upload(manager, cid, "identity")
    runner.check("identity document is absent from technician list", lambda: expect(not any(x["publicId"] == private_doc["publicId"] for x in tech.api(f"files-v2.php?caseId={cid}")["files"]), "identity exposed"))
    runner.check("identity document cannot be fetched by technician", lambda: tech.api("files-v2.php?id=" + private_doc["publicId"], expected=403))
    runner.check("manager can fetch scoped identity document", lambda: expect(manager.raw("/api/files-v2.php?id=" + private_doc["publicId"])[0] == 200, "manager denied"))
    report = {"action": "problem_report", "caseId": cid, "message": "TEST immutable issue report", "idempotencyKey": marker + "-note"}
    runner.check("problem report requires CSRF", lambda: tech.api("workflow-v2.php", "POST", report, expected=419, headers={"X-CSRF-Token": ""}))
    runner.check("unassigned technician cannot report a problem", lambda: other.api("workflow-v2.php", "POST", report, expected=403))
    runner.check("foreign shop cannot report a problem", lambda: foreign.api("workflow-v2.php", "POST", report, expected=404))
    runner.check("assigned technician records a problem", lambda: tech.api("workflow-v2.php", "POST", report))
    runner.check("same report retry is read-only", lambda: expect(tech.api("workflow-v2.php", "POST", report)["replayed"], "not replayed"))
    runner.check("changed report with same key is rejected", lambda: tech.api("workflow-v2.php", "POST", {**report, "message": "TEST changed"}, expected=409))
    runner.check("only one immutable problem event exists", lambda: expect(int(sql(f"SELECT COUNT(*) AS n FROM repair_case_events WHERE case_id={cid} AND event_type='problem_report'", True)[0]["n"]) == 1, "duplicate event"))
    runner.check("server timeline includes problem and workflow events", lambda: expect(any(e["description"] == report["message"] for e in tech.api(f"workflow-v2.php?caseId={cid}&activity=1")["events"]), "missing problem history"))
    runner.check("unassigned technician cannot read timeline", lambda: other.api(f"workflow-v2.php?caseId={cid}&activity=1", expected=403))
    # Grant and revoke collaboration through the real manager endpoint.
    manager.api("workflow-v2.php", "POST", {"action": "collaborator_add", "caseId": cid, "technicianUserId": tech_actors[1]["id"], "taskTitle": "TEST collaborate", "compensationModel": "fixed", "fixedFee": 0})
    runner.check("active collaborator can list scoped photos", lambda: other.api(f"files-v2.php?caseId={cid}"))
    sql(f"UPDATE repair_case_assignments SET ended_at=NOW() WHERE technician_user_id={tech_actors[1]['id']} AND workflow_id=(SELECT id FROM repair_case_workflows WHERE case_id={cid});")
    runner.check("ended collaborator immediately loses photo access", lambda: other.api("files-v2.php?id=" + public, expected=403))
    before = sql(f"SELECT COUNT(*) AS n FROM tamiran_private_files WHERE case_id={cid}", True)
    def disk_files():
        code = "$root='/app/private/files';$n=0;if(is_dir($root)){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS)) as $f)if($f->isFile())$n++;}echo $n;"
        return int(subprocess.check_output(["docker", "exec", args.container, "php", "-r", code], text=True))
    disk_before = disk_files()
    sql("CREATE TRIGGER TEST_case_tools_audit_failure BEFORE INSERT ON tamiran_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST rollback';")
    try:
        runner.check("audit failure rejects file upload", lambda: upload(tech, cid, expected=500))
        runner.check("failed upload rolls metadata back", lambda: expect(sql(f"SELECT COUNT(*) AS n FROM tamiran_private_files WHERE case_id={cid}", True) == before, "orphan metadata"))
        runner.check("failed upload deletes newly moved private file", lambda: expect(disk_files() == disk_before, "orphan file"))
        runner.check("audit failure rejects problem event", lambda: tech.api("workflow-v2.php", "POST", {**report, "idempotencyKey": marker + "-fail"}, expected=500))
        runner.check("failed problem event is rolled back", lambda: expect(int(sql(f"SELECT COUNT(*) AS n FROM repair_case_events WHERE case_id={cid} AND event_type='problem_report'", True)[0]["n"]) == 1, "partial problem event"))
    finally:
        sql("DROP TRIGGER TEST_case_tools_audit_failure;")
    # Seed a second synthetic branch; the current session remains in branch A.
    sql(f"INSERT INTO repair_branches(shop_id,branch_code,name,business_hours_json) VALUES({actor['shop']['id']},'{marker}-B','TEST branch B','{{}}');")
    branch_b = int(sql(f"SELECT id FROM repair_branches WHERE shop_id={actor['shop']['id']} AND branch_code='{marker}-B'", True)[0]["id"])
    sql(f"UPDATE repair_case_workflows SET branch_id={branch_b} WHERE case_id={cid}; UPDATE repair_cases SET branch_id={branch_b} WHERE id={cid};")
    try:
        runner.check("same-shop foreign branch cannot list photos", lambda: manager.api(f"files-v2.php?caseId={cid}", expected=404))
        runner.check("known photo ID cannot bypass linked case branch", lambda: manager.api("files-v2.php?id=" + public, expected=404))
        runner.check("same-shop foreign branch cannot read timeline", lambda: manager.api(f"workflow-v2.php?caseId={cid}&activity=1", expected=404))
        runner.check("same-shop foreign branch cannot append problem event", lambda: manager.api("workflow-v2.php", "POST", {**report, "idempotencyKey": marker + "-branch"}, expected=404))
    finally:
        sql(f"UPDATE repair_case_workflows SET branch_id={actor['branch']['id']} WHERE case_id={cid}; UPDATE repair_cases SET branch_id={actor['branch']['id']} WHERE id={cid};")
    sql(f"UPDATE repair_case_workflows SET locked_at=NOW(),process_status='closed' WHERE case_id={cid};")
    runner.check("closed case rejects new technician photo", lambda: upload(tech, cid, expected=409))
    runner.check("closed case rejects new problem report", lambda: tech.api("workflow-v2.php", "POST", {**report, "idempotencyKey": marker + "-closed"}, expected=409))
    runner.check("closed case still allows read-only photo history", lambda: tech.api(f"files-v2.php?caseId={cid}"))
    runner.save()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:9273")
    parser.add_argument("--container", default="tamiran-php6-web")
    parser.add_argument("--report", required=True)
    run(parser.parse_args())
