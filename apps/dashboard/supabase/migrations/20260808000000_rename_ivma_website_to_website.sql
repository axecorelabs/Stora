-- Rebrand: rename stores.ivma_website to stores.website following the IVMA -> Stora rename.
ALTER TABLE stores RENAME COLUMN ivma_website TO website;
