"""Optional real-browser QC checks invoked by smoke.py at qc_pending.

Uses the smoke suite's synthetic loopback shop and existing manager session.
"""
from pathlib import Path
from urllib.parse import urlsplit


def check_quality_browser(runner, base_url, manager, output):
    from playwright.sync_api import sync_playwright, expect

    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    host = urlsplit(base_url).hostname
    assert host in ('127.0.0.1', 'localhost', '::1')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 375, 'height': 812})
        context.add_cookies([{'name': cookie.name, 'value': cookie.value, 'domain': host, 'path': cookie.path,
                              'httpOnly': True, 'secure': False, 'sameSite': 'Strict'} for cookie in manager.cookies])
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base_url, wait_until='networkidle')
        page.locator('button[aria-controls=workspace-navigation]').click()
        page.get_by_role('button', name='کنترل کیفیت', exact=True).click()
        card = page.locator('.v2-queue-card').first
        runner.check('QC queue announces unselected case', lambda: expect(card).to_have_attribute('aria-pressed', 'false'))
        runner.check('mobile QC card uses one readable column', lambda: assert_single_column(card))
        card.focus()
        page.keyboard.press('Enter')
        runner.check('keyboard selection announces selected QC case', lambda: expect(card).to_have_attribute('aria-pressed', 'true'))
        def contrast():
            values = card.evaluate('''e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor]}''')
            import re
            def luminance(color):
                channels = [int(x) / 255 for x in re.findall(r'\d+', color)[:3]]
                linear = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in channels]
                return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]
            fg, bg = map(luminance, values)
            assert (max(fg, bg) + .05) / (min(fg, bg) + .05) >= 4.5, values
        runner.check('selected QC case text contrast is at least 4.5', contrast)
        page.locator('.v2-qc-test-item select').first.select_option('failed')
        note = page.get_by_placeholder('شرح ایراد این تست (الزامی)')
        runner.check('failed checklist note has specific visible label', lambda: expect(note).to_have_accessible_name(__import__('re').compile('شرح ایراد.*الزامی')))
        page.get_by_role('button', name='+ افزودن تست اختصاصی').click()
        custom = page.locator('.v2-qc-custom-tests .v2-qc-test-item').first
        custom.locator('input').first.fill('آزمایش مصنوعی')
        custom.locator('select').select_option('failed')
        runner.check('failed custom test note identifies test', lambda: expect(custom.get_by_placeholder('شرح ایراد تست سفارشی (الزامی)')).to_have_accessible_name('شرح ایراد تست آزمایش مصنوعی (الزامی)'))
        for width, height in ((375, 812), (768, 1024), (812, 375), (1440, 1000)):
            page.set_viewport_size({'width': width, 'height': height})
            runner.check(f'QC layout fits viewport {width}x{height}', lambda: assert_fits(page))
        page.set_viewport_size({'width': 375, 'height': 812})
        page.evaluate('document.activeElement.blur(); window.scrollTo(0, 0)')
        page.wait_for_timeout(500)  # Let the responsive navigation animation settle.
        page.screenshot(path=str(out / 'quality-mobile.png'), full_page=True, animations='disabled')
        runner.check('QC browser has no JavaScript errors', lambda: assert_no_errors(errors))
        browser.close()


def assert_single_column(card):
    assert len(card.evaluate("e=>getComputedStyle(e).gridTemplateColumns").split()) == 1, 'mobile queue card is cramped'


def assert_fits(page):
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'horizontal overflow'


def assert_no_errors(errors):
    assert not errors, str(errors)
