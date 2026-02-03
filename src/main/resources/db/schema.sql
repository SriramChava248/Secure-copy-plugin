-- Secure Clipboard Database Schema
-- This script initializes the database tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'USER' NOT NULL,
    total_storage_used BIGINT DEFAULT 0 NOT NULL,
    recent_snippet_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'))
);

-- Snippets metadata table
CREATE TABLE IF NOT EXISTS snippets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    source_url VARCHAR(2048),
    total_chunks INT NOT NULL,
    total_size BIGINT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    status VARCHAR(50) DEFAULT 'PROCESSING' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT snippets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT snippets_status_check CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
);

-- Snippet chunks table (stores compressed chunks)
CREATE TABLE IF NOT EXISTS snippet_chunks (
    id BIGSERIAL PRIMARY KEY,
    snippet_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    content BYTEA NOT NULL,
    content_hash VARCHAR(64),
    is_compressed BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chunks_snippet_fk FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
    CONSTRAINT chunks_snippet_index_unique UNIQUE (snippet_id, chunk_index)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_snippets_user_created ON snippets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snippets_user_status ON snippets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_chunks_snippet_index ON snippet_chunks(snippet_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON snippet_chunks(content_hash);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_snippets_updated_at BEFORE UPDATE ON snippets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();












