-- TAM-STAB-02. Add typed identifiers; legacy values stay exactly as recorded.
-- Run with the selected Tamiran database and application writes paused.

SET @tamiran_identity_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='repair_customer_devices' AND COLUMN_NAME='serial_number'),
    'DO 0', 'ALTER TABLE repair_customer_devices ADD COLUMN serial_number VARCHAR(180) NULL');
PREPARE tamiran_identity_stmt FROM @tamiran_identity_ddl;
EXECUTE tamiran_identity_stmt;
DEALLOCATE PREPARE tamiran_identity_stmt;

SET @tamiran_identity_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='repair_customer_devices' AND COLUMN_NAME='imei'),
    'DO 0', 'ALTER TABLE repair_customer_devices ADD COLUMN imei CHAR(15) NULL');
PREPARE tamiran_identity_stmt FROM @tamiran_identity_ddl;
EXECUTE tamiran_identity_stmt;
DEALLOCATE PREPARE tamiran_identity_stmt;

SET @tamiran_identity_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='repair_cases' AND COLUMN_NAME='serial_number_snapshot'),
    'DO 0', 'ALTER TABLE repair_cases ADD COLUMN serial_number_snapshot VARCHAR(180) NULL');
PREPARE tamiran_identity_stmt FROM @tamiran_identity_ddl;
EXECUTE tamiran_identity_stmt;
DEALLOCATE PREPARE tamiran_identity_stmt;

SET @tamiran_identity_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='repair_cases' AND COLUMN_NAME='imei_snapshot'),
    'DO 0', 'ALTER TABLE repair_cases ADD COLUMN imei_snapshot CHAR(15) NULL');
PREPARE tamiran_identity_stmt FROM @tamiran_identity_ddl;
EXECUTE tamiran_identity_stmt;
DEALLOCATE PREPARE tamiran_identity_stmt;

INSERT IGNORE INTO tamiran_schema_versions(version) VALUES ('2.0.0-beta.8');
SET @tamiran_identity_ddl = NULL;
