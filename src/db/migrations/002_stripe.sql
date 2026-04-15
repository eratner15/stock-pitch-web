-- Migration: add Stripe customer ID to users (Phase 2c)
-- Run on prod with: wrangler d1 execute stock-pitch-db --remote --file=src/db/migrations/002_stripe.sql

ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
