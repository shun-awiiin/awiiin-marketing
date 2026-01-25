-- Phase 3: Payment Schema
-- Stripe integration for one-time and subscription payments

-- Product types
CREATE TYPE product_type AS ENUM ('one_time', 'subscription');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'archived');

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_product_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  product_type product_type NOT NULL DEFAULT 'one_time',
  recurring_interval VARCHAR(20), -- 'month', 'year' for subscriptions
  recurring_interval_count INTEGER DEFAULT 1,
  image_url TEXT,
  status product_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers (extends contacts for payment info)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  address JSONB, -- {line1, line2, city, state, postal_code, country}
  lifetime_value DECIMAL(12,2) DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  first_purchase_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- Purchase status
CREATE TYPE purchase_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'cancelled');

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  status purchase_status NOT NULL DEFAULT 'pending',
  referrer_code VARCHAR(50), -- Affiliate code
  affiliate_id UUID, -- Will reference affiliates table
  funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Thank You Pages
CREATE TABLE IF NOT EXISTS thank_you_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}', -- {message, next_steps[], video_url}
  upsell_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  redirect_url TEXT,
  redirect_delay_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Subscriptions (for recurring payments)
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'paused');

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_stripe_product_id ON products(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_contact_id ON customers(contact_id);
CREATE INDEX IF NOT EXISTS idx_customers_stripe_customer_id ON customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_customer_id ON purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_checkout_session_id ON purchases(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_thank_you_pages_user_id ON thank_you_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_thank_you_pages_slug ON thank_you_pages(slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE thank_you_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Users can view own products" ON products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (status = 'active');

-- Customers policies
CREATE POLICY "Users can view own customers" ON customers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage customers" ON customers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Purchases policies
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own purchases" ON purchases
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage purchases" ON purchases
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Thank you pages policies
CREATE POLICY "Users can view own thank you pages" ON thank_you_pages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own thank you pages" ON thank_you_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own thank you pages" ON thank_you_pages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own thank you pages" ON thank_you_pages
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can view thank you pages" ON thank_you_pages
  FOR SELECT USING (TRUE);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update customer stats after purchase
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE customers
    SET
      purchase_count = purchase_count + 1,
      lifetime_value = lifetime_value + NEW.amount,
      last_purchase_at = NEW.completed_at,
      first_purchase_at = COALESCE(first_purchase_at, NEW.completed_at),
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_customer_stats
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- Function to record conversion event on purchase completion
CREATE OR REPLACE FUNCTION record_purchase_conversion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO conversion_events (
      user_id, contact_id, funnel_id, event_type, metadata
    )
    SELECT
      NEW.user_id,
      c.contact_id,
      NEW.funnel_id,
      'purchase',
      jsonb_build_object('purchase_id', NEW.id, 'amount', NEW.amount, 'product_id', NEW.product_id)
    FROM customers c
    WHERE c.id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_record_purchase_conversion
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION record_purchase_conversion();
