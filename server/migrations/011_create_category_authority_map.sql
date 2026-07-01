-- =============================================================
-- Migration 011: Create category_authority_map table

-- Description: Join table to route categories to authorities
-- =============================================================

IF NOT EXISTS (
  SELECT 1
  FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[category_authority_map]')
    AND type = N'U'
)
BEGIN
  CREATE TABLE dbo.category_authority_map (
    category_id  INT NOT NULL,
    authority_id INT NOT NULL,
    created_at   DATETIMEOFFSET NOT NULL
      CONSTRAINT DF_category_authority_map_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_category_authority_map PRIMARY KEY (category_id, authority_id),
    CONSTRAINT FK_category_authority_map_category
      FOREIGN KEY (category_id) REFERENCES dbo.categories(id) ON DELETE CASCADE,
    CONSTRAINT FK_category_authority_map_authority
      FOREIGN KEY (authority_id) REFERENCES dbo.authorities(id) ON DELETE CASCADE
  );
END;
