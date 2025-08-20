-- Enable required PostgreSQL extensions for accounting system
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Cryptographic functions for hashing
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query performance monitoring