-- Phase 4: Affiliate System Schema
-- Referral tracking and commission management

-- Affiliate status
CREATE TYPE affiliate_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Store owner
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  referral_code VARCHAR(20) UNIQUE NOT NULL, -- Auto-generated, e.g., 'ABC123'
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00, -- Default 20%
  custom_rates JSONB DEFAULT '{}', -- {product_id: rate}
  status affiliate_status NOT NULL DEFAULT 'pending',
  payment_info JSONB DEFAULT '{}', -- {bank_name, account_number, account_name, paypal_email}
  total_earned DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,
  pending_amount DECIMAL(12,2) DEFAULT 0,
  referral_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Affiliate Links (for custom tracking)
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  custom_slug VARCHAR(50),
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referral Clicks
CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
  referral_code VARCHAR(20) NOT NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commissions
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status commission_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payouts
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  commission_ids UUID[] NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50), -- 'bank_transfer', 'paypal', etc.
  payment_reference VARCHAR(255),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update purchases table to reference affiliates
ALTER TABLE purchases
  ADD CONSTRAINT fk_purchases_affiliate
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE SET NULL;

-- Update commissions table to reference payouts
ALTER TABLE commissions
  ADD CONSTRAINT fk_commissions_payout
  FOREIGN KEY (payout_id) REFERENCES affiliate_payouts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate_id ON affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_user_id ON referral_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_affiliate_id ON referral_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON referral_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_purchase_id ON commissions(purchase_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_user_id ON affiliate_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);

-- RLS Policies
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates policies
CREATE POLICY "Users can view own affiliates" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own affiliates" ON affiliates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own affiliates" ON affiliates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own affiliates" ON affiliates
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Affiliates can view own record by email" ON affiliates
  FOR SELECT USING (TRUE); -- Will filter by email in app

-- Affiliate links policies
CREATE POLICY "Users can view own affiliate links" ON affiliate_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE affiliates.id = affiliate_links.affiliate_id AND affiliates.user_id = auth.uid())
  );
CREATE POLICY "Affiliates can view own links" ON affiliate_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE affiliates.id = affiliate_links.affiliate_id)
  );
CREATE POLICY "Users can manage affiliate links" ON affiliate_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM affiliates WHERE affiliates.id = affiliate_links.affiliate_id AND affiliates.user_id = auth.uid())
  );

-- Referral clicks policies
CREATE POLICY "Users can view own referral clicks" ON referral_clicks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage referral clicks" ON referral_clicks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Commissions policies
CREATE POLICY "Users can view own commissions" ON commissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own commissions" ON commissions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Affiliates can view own commissions" ON commissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE affiliates.id = commissions.affiliate_id)
  );

-- Payouts policies
CREATE POLICY "Users can view own payouts" ON affiliate_payouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own payouts" ON affiliate_payouts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Affiliates can view own payouts" ON affiliate_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE affiliates.id = affiliate_payouts.affiliate_id)
  );

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create commission when purchase is completed
CREATE OR REPLACE FUNCTION create_commission_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_affiliate affiliates%ROWTYPE;
  v_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(10,2);
BEGIN
  -- Only process completed purchases with affiliate_id
  IF NEW.status = 'completed' AND NEW.affiliate_id IS NOT NULL AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Get affiliate info
    SELECT * INTO v_affiliate FROM affiliates WHERE id = NEW.affiliate_id AND status = 'approved';

    IF v_affiliate IS NOT NULL THEN
      -- Get commission rate (custom rate for product or default rate)
      v_rate := COALESCE(
        (v_affiliate.custom_rates->>NEW.product_id::text)::DECIMAL(5,2),
        v_affiliate.commission_rate
      );

      -- Calculate commission
      v_commission_amount := NEW.amount * (v_rate / 100);

      -- Create commission record
      INSERT INTO commissions (
        user_id, affiliate_id, purchase_id, product_id,
        sale_amount, commission_rate, commission_amount, status
      ) VALUES (
        NEW.user_id, NEW.affiliate_id, NEW.id, NEW.product_id,
        NEW.amount, v_rate, v_commission_amount, 'pending'
      );

      -- Update affiliate stats
      UPDATE affiliates
      SET
        conversion_count = conversion_count + 1,
        pending_amount = pending_amount + v_commission_amount,
        updated_at = NOW()
      WHERE id = NEW.affiliate_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_commission_on_purchase
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION create_commission_on_purchase();

-- Function to update affiliate stats when commission status changes
CREATE OR REPLACE FUNCTION update_affiliate_on_commission_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When commission is approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    UPDATE affiliates
    SET
      total_earned = total_earned + NEW.commission_amount,
      pending_amount = pending_amount - NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  -- When commission is paid
  IF NEW.status = 'paid' AND (OLD IS NULL OR OLD.status != 'paid') THEN
    UPDATE affiliates
    SET
      total_paid = total_paid + NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  -- When commission is cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    UPDATE affiliates
    SET
      pending_amount = pending_amount - NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    UPDATE affiliates
    SET
      total_earned = total_earned - NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_affiliate_on_commission_change
  AFTER UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_on_commission_change();
