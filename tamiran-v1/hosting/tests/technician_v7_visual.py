#!/usr/bin/env python3
"""Exercise the v7 technician panel against the real loopback PHP runtime."""
import argparse
import json
import secrets
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright
from smoke import Client, synthetic_imei


def run(args):
    fixture = json.loads(Path(args.fixture).read_text())
    base = fixture["base"]
    host = urlsplit(base).hostname
    assert host in ("127.0.0.1", "localhost", "::1")
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    manager = Client(base)
    manager.login(fixture["managerMobile"], fixture["password"])
    worker = Client(base)
    worker_id = worker.login(fixture["tech"]["phone"], fixture["password"])["id"]
    target = next(user for user in manager.api("admin-users.php")["users"]
                  if user["role"] == "technician" and user["id"] != worker_id)
    recipient = Client(base)
    recipient.login(target["phone"], fixture["password"])
    models = manager.api("catalog.php")["items"]
    model = next((row for row in models if row["brand"] == "اپل" and row["model"] == "iPhone 6s"), None)
    if model is None:
        manager.api("catalog.php", "POST", {"type": "موبایل", "brand": "اپل", "model": "iPhone 6s"})
        model = next(row for row in manager.api("catalog.php")["items"]
                     if row["brand"] == "اپل" and row["model"] == "iPhone 6s")

    def create(owner, issue):
        return manager.api("operations.php", "POST", {
            "action": "create_case", "receiptMode": "issue_only", "customerName": "مشتری آزمایشی",
            "customerMobile": fixture["customerMobile"], "deviceModelId": model["id"],
            "identifier": synthetic_imei(), "declaredIssue": issue, "assignedToUserId": owner,
            "customerConsent": {"dataHandling": "coordinate_first"}, "preapprovedAmount": 7500000,
            "idempotencyKey": secrets.token_hex(12),
        })["repairCase"]

    def case_entry(case_id):
        return manager.api(f"workflow-v2.php?caseId={case_id}")["cases"][0]

    def command(client, case_id, action, **values):
        return client.api("workflow-v2.php", "POST", {
            "action": action, "caseId": case_id, "idempotencyKey": secrets.token_hex(12), **values,
        })

    case = create(worker_id, "شارژ دستگاه قطع و وصل می‌شود")
    case_id = case["id"]
    create(worker_id, "نمایشگر روشن نمی‌شود")
    create(worker_id, "باتری زود خالی می‌شود")
    incoming = create(worker_id, "درگاه شارژ شل شده است")
    command(worker, incoming["id"], "technical_receive", lockVersion=case_entry(incoming["id"])["lockVersion"])
    command(worker, incoming["id"], "technical_activity", description="اتصال درگاه شارژ بررسی شد.")
    command(manager, incoming["id"], "handover_request", toUserId=target["id"], reason="آزمایش تحویل داخلی",
            reasonId="expertise", partsDisposition="transfer_to_new", hotReturnsDisposition="transfer_to_new")
    checks = []
    errors = []

    def passes(name):
        checks.append(name)
        print("PASS", name, flush=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])

        def page_for(client):
            context = browser.new_context(viewport={"width":1440,"height":950}, reduced_motion="reduce")
            context.add_cookies([{"name": cookie.name, "value": cookie.value, "domain": host,
                                  "path": cookie.path, "httpOnly": True, "sameSite": "Strict"} for cookie in client.cookies])
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            return page

        def capture(page, view):
            for width in (1440, 768, 390, 320):
                page.set_viewport_size({"width":width,"height":950})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+1"), view
                if width in (1440, 390):
                    page.evaluate("window.scrollTo(0,0)")
                    page.screenshot(path=output / f"app-{view}-{width}.png")
            passes(f"{view} fits 320, 390, 768, 1440")
            page.set_viewport_size({"width":1440,"height":950})

        page = page_for(worker)
        page.goto(base + "/?view=my-work", wait_until="networkidle")
        card = page.get_by_role("button", name="بازکردن پرونده " + case["receiptNumber"], exact=True)
        expect(card).to_be_visible()
        expect(page.locator(".tech-v7-stats button")).to_have_count(4)
        search = page.get_by_role("textbox", name="جستجوی دستگاه")
        search.fill("iPhone 6s")
        expect(card).to_be_visible()
        toolbar = page.locator(".tech-v7-toolbar")
        assert toolbar.evaluate("(el) => Math.abs(el.firstElementChild.offsetTop - el.lastElementChild.offsetTop) <= 3")
        assert page.locator(".tech-device-list").evaluate("(e)=>getComputedStyle(e).gridTemplateColumns.split(' ').length >= 2")
        capture(page, "queue")
        card.click()
        expect(page.get_by_role("heading", name="تأیید دریافت دستگاه", exact=True)).to_be_visible()
        assert case_entry(case_id)["receiptPending"]
        page.get_by_role("button", name="تأیید دریافت و شروع بررسی", exact=True).click()
        expect(page.get_by_role("heading", name="عیب‌یابی و برآورد", exact=True)).to_be_visible()
        expect(page.locator("#technical-report")).to_have_count(0)
        passes("card and receipt open the next real server stage")
        capture(page, "diagnosis")
        page.get_by_label("نتیجه بررسی ایراد پذیرش").select_option("confirmed")
        page.get_by_label("شرح عیب‌یابی", exact=True).fill("آزمایش قطع اتصال هنگام شارژ")
        page.get_by_label("شرح ایراد جدید", exact=True).fill("اتصال درگاه ناپایدار است")
        page.get_by_role("button", name="افزودن ایراد", exact=True).click()
        page.locator("#technical-labor").fill("۱۲۰٬۰۰۰")
        page.get_by_role("button", name="ثبت برآورد و ادامه", exact=True).click()
        expect(page.get_by_role("heading", name="عملیات تعمیر", exact=True)).to_be_visible()
        assert case_entry(case_id)["status"] == "repairing"
        passes("single visible diagnosis and estimate flow reaches repair")
        page.locator("#technical-report").fill("درگاه شارژ تعویض و آزمایش شد.")
        page.get_by_role("button", name="ثبت گزارش", exact=True).click()
        expect(page.locator(".tech-report-list")).to_contain_text("درگاه شارژ تعویض و آزمایش شد.")
        expect(page.get_by_role("heading", name="قطعات تعمیر", exact=True)).to_be_visible()
        capture(page, "repair")
        page.get_by_role("button", name="خلاصه پرونده", exact=True).click()
        summary = page.get_by_role("dialog", name="خلاصه عملیاتی پرونده", exact=True)
        expect(summary).to_contain_text("اتصال درگاه ناپایدار است")
        expect(summary).to_contain_text("درگاه شارژ تعویض و آزمایش شد.")
        page.keyboard.press("Escape")
        expect(summary).not_to_be_visible()
        passes("summary shows actual diagnosis and reports and closes with Escape")

        other = page_for(recipient)
        other.goto(base + "/?view=my-work", wait_until="networkidle")
        hand = other.locator(".tech-incoming li").filter(has_text=incoming["receiptNumber"])
        hand.get_by_role("button", name="بررسی رسید ارجاع", exact=True).click()
        dialog = other.get_by_role("dialog", name="رسید ارجاع دستگاه", exact=True)
        expect(dialog).to_contain_text("اتصال درگاه شارژ بررسی شد.")
        accept = dialog.get_by_role("button", name="تأیید دریافت و انتقال مسئولیت", exact=True)
        expect(accept).to_be_disabled()
        for width in (1440,390,320):
            other.set_viewport_size({"width":width,"height":950})
            box = dialog.bounding_box()
            assert box and abs(box["x"] + box["width"]/2-width/2) < 3
            assert abs(box["y"] + box["height"]/2-475) < 3
        capture(other, "handover")
        dialog.get_by_role("checkbox").first.check()
        expect(accept).to_be_enabled()
        accept.click()
        expect(other.get_by_role("heading", name="عیب‌یابی و برآورد", exact=True)).to_be_visible()
        assert case_entry(incoming["id"])["primaryTechnicianUserId"] == target["id"]
        passes("centered confirmation transfers responsibility to the recipient")
        assert not errors, errors
        passes("no browser JavaScript errors")
        browser.close()
    (output / "results.json").write_text(json.dumps({"passed":len(checks),"failed":0,"checks":checks},ensure_ascii=False))


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture",required=True)
    parser.add_argument("--output",required=True)
    run(parser.parse_args())
