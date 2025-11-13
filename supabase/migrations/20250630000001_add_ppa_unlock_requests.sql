-- Create ppa_unlock_requests table
CREATE TABLE IF NOT EXISTS public.ppa_unlock_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    lock_id UUID NOT NULL REFERENCES public.ppa_locks(id),
    ppa_amount DECIMAL(20, 6) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    processed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ppa_unlock_requests_wallet_address ON public.ppa_unlock_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ppa_unlock_requests_lock_id ON public.ppa_unlock_requests(lock_id);
CREATE INDEX IF NOT EXISTS idx_ppa_unlock_requests_status ON public.ppa_unlock_requests(status);
CREATE INDEX IF NOT EXISTS idx_ppa_unlock_requests_created_at ON public.ppa_unlock_requests(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ppa_unlock_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own unlock requests
CREATE POLICY "Users can view their own unlock requests" ON public.ppa_unlock_requests
    FOR SELECT USING (true); -- Allow read access for all users

-- Create policy to allow users to create unlock requests for their own locks
CREATE POLICY "Users can create unlock requests for their own locks" ON public.ppa_unlock_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ppa_locks 
            WHERE id = lock_id AND wallet_address = ppa_unlock_requests.wallet_address
        )
    );

-- Create policy to allow platform admins to update unlock requests (for processing)
CREATE POLICY "Allow updates for processing" ON public.ppa_unlock_requests
    FOR UPDATE USING (true); -- Allow updates for processing by admins

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ppa_unlock_requests_updated_at 
    BEFORE UPDATE ON public.ppa_unlock_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.ppa_unlock_requests IS 'Stores unlock requests for expired PPA locks';
COMMENT ON COLUMN public.ppa_unlock_requests.wallet_address IS 'Wallet address that owns the lock';
COMMENT ON COLUMN public.ppa_unlock_requests.lock_id IS 'Reference to the ppa_locks table';
COMMENT ON COLUMN public.ppa_unlock_requests.ppa_amount IS 'Amount of PPA tokens to unlock';
COMMENT ON COLUMN public.ppa_unlock_requests.requested_at IS 'When the unlock was requested';
COMMENT ON COLUMN public.ppa_unlock_requests.status IS 'Status of the unlock request';
COMMENT ON COLUMN public.ppa_unlock_requests.processed_at IS 'When the request was processed';
COMMENT ON COLUMN public.ppa_unlock_requests.transaction_hash IS 'Transaction hash when tokens are returned'; 