-- This migration creates the reports table and links it to users and categories.
-- Create reports table only if it does not already exist.
IF OBJECT_ID('reports', 'U') IS NULL
BEGIN
  CREATE TABLE reports (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(MAX) NOT NULL,
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6),
    location_address VARCHAR(255),
    -- Keep status constrained to known lifecycle values.
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved')),
    media_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Delete child reports if user is deleted.
    CONSTRAINT FK_reports_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    -- Keep report category linked to existing category rows.
    CONSTRAINT FK_reports_category_id FOREIGN KEY (category_id) REFERENCES categories(id)
  );
END;
