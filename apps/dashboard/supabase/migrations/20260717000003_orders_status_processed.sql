-- 'processed' is a real order status found in live Mongo data (and present in
-- the Sequelize Order model's enum), missed when the initial CHECK was written.

ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending','confirmed','processing','shipped','delivered','cancelled','refunded','failed','processed'
));
