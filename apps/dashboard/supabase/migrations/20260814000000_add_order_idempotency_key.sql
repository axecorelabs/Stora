-- Idempotency key for order creation: lets the client safely retry a checkout
-- request (double-click, network retry) without creating a duplicate order.
-- Nullable + partial unique index so existing rows are unaffected, but two
-- inserts with the same non-null key collide at the DB level -- that's the
-- real concurrency guard, not just an app-level "check first" (which would
-- itself be racy under concurrent identical requests).

ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(100);

CREATE UNIQUE INDEX orders_idempotency_key_idx
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
