DROP INDEX IF EXISTS `idx_product_units_serial`;
--> statement-breakpoint
CREATE INDEX `idx_product_units_serial` ON `product_units` (`serial_number`);
