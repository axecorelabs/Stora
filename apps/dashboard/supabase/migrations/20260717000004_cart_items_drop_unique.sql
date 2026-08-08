-- A cart can legitimately hold the same base product twice as separate line
-- items (different variant/color/size chosen separately) -- confirmed by
-- real Mongo cart data. The UNIQUE(cart_id, product_id) constraint was wrong.

ALTER TABLE cart_items DROP CONSTRAINT cart_items_cart_id_product_id_key;

-- Same reasoning applies to wishlist_items (product + optional variant preference).
ALTER TABLE wishlist_items DROP CONSTRAINT wishlist_items_wishlist_id_product_id_key;
