# A4 reception receipt verification

- Compared the approved one-page PDF with a 100 dpi render of the implemented print output using the live local PHP/React application and a synthetic case with two issues. The shop identity, QR, financial summary, four-column issue table, conditions, appearance, signature and footer blocks follow the reference.
- Fixed a wrapped issue-table heading and a footer that moved onto a second page. Checked the final full page against the reference, the mobile preview for horizontal overflow and the printed date and values. Decoded the printed QR and opened its synthetic tracking link.
- The device views identify front and back. The document prints recorded appearance labels. The reference’s example damage markers carry no real case data.

final result: passed

# Technician UI design verification

- Reference: `references/tamiran-prototype-v7.html`, byte-for-byte identical to the approved attachment. The reference appears at left and the real PHP/React build at right in the comparison images delivered with rc.3.
- Verified in Chromium on a local PHP/MariaDB installation with synthetic repair records. Compared the queue, diagnosis, repair and handover at 1440px and 390px. Checked layout bounds at 320px, 390px, 768px and 1440px. Measured the handover dialog against the center of the viewport and exercised confirmation with the recipient account.
- Corrected the desktop toolbar wrapping and kept the existing authenticated application shell. The diagnosis screen includes the production assessment and optional diagnostic fee. The handover confirmation remains disabled until the required receipt items have been checked.
- Safari, Firefox and the production host were outside this verification.

final result: passed
