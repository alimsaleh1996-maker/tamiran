-- LOCAL TEST ONLY: synthetic receipt terms, no real consent or signature.
INSERT INTO repair_receipt_term_versions(id,public_id,shop_id,version_number,title,body_text,content_sha256,effective_from,created_by_user_id)
VALUES (1,'TEST-TAM-1010F-TERMA',1,1,'آزمایشی — شرایط الف','آزمایشی — شرایط پذیرش و حفظ اطلاعات دستگاه','bb667b05ec45c013994f4ed74c0eac60dbd7a0198aea20d1d3c8eaab1877d873','2026-10-10 00:00:00',2),
(2,'TEST-TAM-1010F-TERMB',2,1,'آزمایشی — شرایط ب','آزمایشی — شرایط پذیرش و حفظ اطلاعات دستگاه','bb667b05ec45c013994f4ed74c0eac60dbd7a0198aea20d1d3c8eaab1877d873','2026-10-10 00:00:00',8);
