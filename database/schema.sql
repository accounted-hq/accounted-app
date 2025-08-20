-- Accountanted Database Schema
-- Multi-tenant accounting system with Row-Level Security (RLS)
-- Compliant with German accounting standards (UGB)

-- Enable Row Level Security and necessary extensions
CREATE
EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE
EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenant management table
CREATE TABLE tenants
(
    id         UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    name       VARCHAR(255)       NOT NULL,
    code       VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active     BOOLEAN                  DEFAULT true,
    settings   JSONB                    DEFAULT '{}'::jsonb
);

-- User management with role-based access
CREATE TYPE user_role AS ENUM ('accountant', 'auditor', 'admin', 'integration-bot');

CREATE TABLE users
(
    id         UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id  UUID                NOT NULL REFERENCES tenants (id),
    email      VARCHAR(255) UNIQUE NOT NULL,
    role       user_role           NOT NULL,
    active     BOOLEAN                  DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings   JSONB                    DEFAULT '{}'::jsonb
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see users from their own tenant
CREATE
POLICY tenant_isolation_users ON users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Chart of accounts with hierarchical structure
CREATE TABLE accounts
(
    id           UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id    UUID         NOT NULL REFERENCES tenants (id),
    code         VARCHAR(20)  NOT NULL,
    name         VARCHAR(255) NOT NULL,
    parent_id    UUID REFERENCES accounts (id),
    account_type VARCHAR(50)  NOT NULL, -- asset, liability, equity, revenue, expense
    is_active    BOOLEAN                  DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_accounts ON accounts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Periods for period-based posting control
CREATE TYPE period_status AS ENUM ('open', 'closing', 'closed');

CREATE TABLE periods
(
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID    NOT NULL REFERENCES tenants (id),
    year      INTEGER NOT NULL,
    month     INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12
) ,
    status period_status DEFAULT 'open',
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, year, month)
);

ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_periods ON periods
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Currency support
CREATE TABLE currencies
(
    code           CHAR(3) PRIMARY KEY, -- ISO 4217
    name           VARCHAR(100) NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    active         BOOLEAN DEFAULT true
);

-- Exchange rates with immutability after posting
CREATE TABLE exchange_rates
(
    id             UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id      UUID           NOT NULL REFERENCES tenants (id),
    from_currency  CHAR(3)        NOT NULL REFERENCES currencies (code),
    to_currency    CHAR(3)        NOT NULL REFERENCES currencies (code),
    rate           DECIMAL(18, 8) NOT NULL,
    effective_date DATE           NOT NULL,
    source         VARCHAR(50)              DEFAULT 'ECB', -- ECB, manual, etc.
    is_posted      BOOLEAN                  DEFAULT false,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_exchange_rates ON exchange_rates
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Journals with cryptographic hash chaining for immutability
CREATE TABLE journals
(
    id                  UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id           UUID    NOT NULL REFERENCES tenants (id),
    journal_number      SERIAL,
    reference           VARCHAR(100),
    description         TEXT,
    posting_date        DATE    NOT NULL,
    period_year         INTEGER NOT NULL,
    period_month        INTEGER NOT NULL,
    created_by          UUID    NOT NULL REFERENCES users (id),
    posted_at           TIMESTAMP WITH TIME ZONE,
    posted_by           UUID REFERENCES users (id),
    is_posted           BOOLEAN                  DEFAULT false,
    is_reversal         BOOLEAN                  DEFAULT false,
    reversed_journal_id UUID REFERENCES journals (id),

    -- Cryptographic hash chaining
    hash_prev           VARCHAR(64), -- SHA256 of previous journal
    hash_self           VARCHAR(64), -- SHA256 of this journal's data + hash_prev

    -- Multi-currency support
    base_currency       CHAR(3) NOT NULL REFERENCES currencies (code),

    -- Metadata
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata            JSONB                    DEFAULT '{}'::jsonb,

    FOREIGN KEY (tenant_id, period_year, period_month)
        REFERENCES periods (tenant_id, year, month),
    UNIQUE (tenant_id, journal_number)
);

ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_journals ON journals
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Journal entries (the individual debit/credit lines)
CREATE TABLE journal_entries
(
    id                UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id         UUID           NOT NULL REFERENCES tenants (id),
    journal_id        UUID           NOT NULL REFERENCES journals (id),
    line_number       INTEGER        NOT NULL,
    account_id        UUID           NOT NULL REFERENCES accounts (id),

    -- Multi-currency amounts
    original_currency CHAR(3)        NOT NULL REFERENCES currencies (code),
    original_amount   DECIMAL(18, 4) NOT NULL,
    exchange_rate     DECIMAL(18, 8) NOT NULL  DEFAULT 1.0,
    base_amount       DECIMAL(18, 4) NOT NULL, -- amount in base currency

    -- Debit/Credit indicator
    debit_amount      DECIMAL(18, 4)           DEFAULT 0,
    credit_amount     DECIMAL(18, 4)           DEFAULT 0,

    description       TEXT,
    reference         VARCHAR(100),

    -- Tax information
    tax_code          VARCHAR(20),
    tax_amount        DECIMAL(18, 4)           DEFAULT 0,
    tax_base_amount   DECIMAL(18, 4)           DEFAULT 0,

    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (debit_amount = 0 AND credit_amount > 0)
        ),
    CONSTRAINT valid_base_amount CHECK (
        base_amount = CASE
                          WHEN debit_amount > 0 THEN debit_amount
                          ELSE credit_amount
            END
        ),
    UNIQUE (tenant_id, journal_id, line_number)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_journal_entries ON journal_entries
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Idempotency keys for API requests (30-day retention)
CREATE TABLE idempotency_keys
(
    id           UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id    UUID         NOT NULL REFERENCES tenants (id),
    key          VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64)  NOT NULL, -- SHA256 of request payload
    response     JSONB        NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at   TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    UNIQUE (tenant_id, key)
);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_idempotency_keys ON idempotency_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Audit log for all mutations (immutable, 10-year retention)
CREATE TABLE audit_log
(
    id         UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id  UUID         NOT NULL REFERENCES tenants (id),
    table_name VARCHAR(100) NOT NULL,
    operation  VARCHAR(10)  NOT NULL, -- INSERT, UPDATE, DELETE
    record_id  UUID         NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id    UUID REFERENCES users (id),
    request_id VARCHAR(100),
    timestamp  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signature  VARCHAR(255)           -- Cryptographic signature for integrity
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_audit_log ON audit_log
    FOR
SELECT -- Audit log is read-only via policy
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Bank import tracking for deduplication
CREATE TABLE bank_imports
(
    id          UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants (id),
    ext_uid     VARCHAR(255), -- External unique identifier from bank
    file_hash   VARCHAR(64),  -- SHA256 of import data
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    journal_id  UUID REFERENCES journals (id),
    status      VARCHAR(50)              DEFAULT 'imported',
    metadata    JSONB                    DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, ext_uid),
    UNIQUE (tenant_id, file_hash)
);

ALTER TABLE bank_imports ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_bank_imports ON bank_imports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Tax configurations per tenant
CREATE TABLE tax_configurations
(
    id          UUID PRIMARY KEY         DEFAULT uuid_generate_v4(),
    tenant_id   UUID          NOT NULL REFERENCES tenants (id),
    tax_code    VARCHAR(20)   NOT NULL,
    description VARCHAR(255)  NOT NULL,
    rate        DECIMAL(5, 4) NOT NULL, -- e.g., 0.1900 for 19%
    account_id  UUID          NOT NULL REFERENCES accounts (id),
    is_active   BOOLEAN                  DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, tax_code)
);

ALTER TABLE tax_configurations ENABLE ROW LEVEL SECURITY;
CREATE
POLICY tenant_isolation_tax_configurations ON tax_configurations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Indexes for performance
CREATE INDEX idx_journals_tenant_posting_date ON journals (tenant_id, posting_date);
CREATE INDEX idx_journals_tenant_period ON journals (tenant_id, period_year, period_month);
CREATE INDEX idx_journal_entries_tenant_account ON journal_entries (tenant_id, account_id);
CREATE INDEX idx_journal_entries_journal_id ON journal_entries (journal_id);
CREATE INDEX idx_audit_log_tenant_timestamp ON audit_log (tenant_id, timestamp);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);

-- Insert default currencies
INSERT INTO currencies (code, name, decimal_places)
VALUES ('EUR', 'Euro', 2),
       ('USD', 'US Dollar', 2),
       ('GBP', 'British Pound', 2),
       ('CHF', 'Swiss Franc', 2),
       ('JPY', 'Japanese Yen', 0);

-- Function to calculate journal hash
CREATE
OR REPLACE FUNCTION calculate_journal_hash(
    p_journal_id UUID,
    p_hash_prev VARCHAR(64)
) RETURNS VARCHAR(64) AS $$
DECLARE
v_journal_data TEXT;
    v_hash
VARCHAR(64);
BEGIN
    -- Serialize journal data in deterministic order
SELECT j.journal_number || '|' ||
       j.posting_date || '|' ||
       j.description || '|' ||
       STRING_AGG(
               je.line_number || ':' ||
               je.account_id || ':' ||
               je.base_amount || ':' ||
               COALESCE(je.debit_amount, 0) || ':' ||
               COALESCE(je.credit_amount, 0),
               '|' ORDER BY je.line_number
       )
INTO v_journal_data
FROM journals j
         JOIN journal_entries je ON j.id = je.journal_id
WHERE j.id = p_journal_id
GROUP BY j.journal_number, j.posting_date, j.description;

-- Calculate SHA256 hash
v_hash
:= encode(digest(v_journal_data || COALESCE(p_hash_prev, ''), 'sha256'), 'hex');

RETURN v_hash;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for audit logging
CREATE
OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
v_old_data JSONB;
    v_new_data
JSONB;
    v_tenant_id
UUID;
BEGIN
    -- Extract tenant_id from the row
    IF
TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
        v_old_data
:= row_to_json(OLD);
ELSE
        v_tenant_id := NEW.tenant_id;
        v_new_data
:= row_to_json(NEW);
        IF
TG_OP = 'UPDATE' THEN
            v_old_data := row_to_json(OLD);
END IF;
END IF;
    
    -- Insert audit record
INSERT INTO audit_log (tenant_id,
                       table_name,
                       operation,
                       record_id,
                       old_values,
                       new_values,
                       user_id,
                       request_id)
VALUES (v_tenant_id,
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        v_old_data,
        v_new_data,
        NULLIF(current_setting('app.current_user_id', true), '')::uuid,
        NULLIF(current_setting('app.current_request_id', true), ''));

RETURN COALESCE(NEW, OLD);
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for all main tables
CREATE TRIGGER audit_trigger_journals
    AFTER INSERT OR
UPDATE OR
DELETE
ON journals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_journal_entries
    AFTER INSERT OR
UPDATE OR
DELETE
ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_accounts
    AFTER INSERT OR
UPDATE OR
DELETE
ON accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Function to automatically clean up expired idempotency keys
CREATE
OR REPLACE FUNCTION cleanup_expired_idempotency_keys() RETURNS INTEGER AS $$
DECLARE
v_deleted_count INTEGER;
BEGIN
DELETE
FROM idempotency_keys
WHERE expires_at < NOW();
GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
RETURN v_deleted_count;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate period posting (only open periods)
CREATE
OR REPLACE FUNCTION validate_period_posting(
    p_tenant_id UUID,
    p_year INTEGER,
    p_month INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
v_status period_status;
BEGIN
SELECT status
INTO v_status
FROM periods
WHERE tenant_id = p_tenant_id
          AND year = p_year
          AND month = p_month;

IF
v_status IS NULL THEN
        -- Create period if it doesn't exist (default to open)
        INSERT INTO periods (tenant_id, year, month, status)
        VALUES (p_tenant_id, p_year, p_month, 'open');
RETURN true;
END IF;

RETURN v_status = 'open';
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;