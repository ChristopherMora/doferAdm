-- Add print file columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS print_file TEXT,
ADD COLUMN IF NOT EXISTS print_file_name TEXT;

COMMENT ON COLUMN orders.print_file IS 'Path or URL to the print file (STL/3MF/GCODE)';
COMMENT ON COLUMN orders.print_file_name IS 'Original filename of the print file';
