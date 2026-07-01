IF NOT EXISTS (
  SELECT 1
  FROM sys.tables
  WHERE name = 'categories'
)
BEGIN
  CREATE TABLE categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE()
  );
END;
