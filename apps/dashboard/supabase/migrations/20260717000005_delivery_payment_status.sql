-- 'cash_on_delivery' is a real payment_status value found in live delivery data.

ALTER TABLE delivery_schedules DROP CONSTRAINT delivery_schedules_payment_status_check;
ALTER TABLE delivery_schedules ADD CONSTRAINT delivery_schedules_payment_status_check CHECK (payment_status IN (
  'pending','paid','partially_paid','failed','cash_on_delivery'
));
