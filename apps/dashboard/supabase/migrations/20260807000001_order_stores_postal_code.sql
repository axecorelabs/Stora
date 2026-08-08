-- Live checkout code (ivma-store's order_stores insert) writes postal_code,
-- a real store-address field missed in the initial schema pass.

ALTER TABLE order_stores ADD COLUMN postal_code VARCHAR(20);
