-- This migration creates the users table with role support and timestamps.
-- Create users table only if it does not already exist.
IF OBJECT_ID('users', 'U') IS NULL
BEGIN
  CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- Keep roles constrained to known application roles.
    role VARCHAR(20) DEFAULT 'resident' CHECK (role IN ('resident', 'authority', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
END;
