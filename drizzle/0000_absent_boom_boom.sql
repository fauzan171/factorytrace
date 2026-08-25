CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`event_type` text NOT NULL,
	`station` text NOT NULL,
	`occurred_at` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_units` (
	`id` text PRIMARY KEY NOT NULL,
	`serial_number` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`work_order` text NOT NULL,
	`batch_number` text NOT NULL,
	`scenario` text NOT NULL,
	`vision_result` text NOT NULL,
	`barcode_result` text NOT NULL,
	`disposition` text NOT NULL,
	`reason_code` text,
	`label_offset_mm` real,
	`cap_confidence` real,
	`code_grade` text,
	`created_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_units_serial` ON `product_units` (`serial_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_units_sequence` ON `product_units` (`sequence_number`);