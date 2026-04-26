-- Persistent API rate limits for public endpoints that can consume storage or
-- compute. The application calls this through the service role.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage API rate limits"
  ON public.api_rate_limits;

CREATE POLICY "Service role can manage API rate limits"
  ON public.api_rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  key_param TEXT,
  limit_param INTEGER,
  window_seconds_param INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.api_rate_limits%ROWTYPE;
  now_value TIMESTAMPTZ := NOW();
  retry_after_seconds INTEGER;
BEGIN
  IF key_param IS NULL OR length(trim(key_param)) = 0 THEN
    RAISE EXCEPTION 'rate limit key is required';
  END IF;

  IF limit_param < 1 OR window_seconds_param < 1 THEN
    RAISE EXCEPTION 'invalid rate limit configuration';
  END IF;

  DELETE FROM public.api_rate_limits
  WHERE updated_at < now_value - INTERVAL '2 days';

  SELECT *
  INTO current_row
  FROM public.api_rate_limits
  WHERE key = key_param
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.api_rate_limits(key, window_start, count, updated_at)
    VALUES (key_param, now_value, 1, now_value);

    RETURN jsonb_build_object(
      'ok', true,
      'limit', limit_param,
      'remaining', limit_param - 1,
      'retryAfterMs', window_seconds_param * 1000
    );
  END IF;

  IF current_row.window_start <= now_value - make_interval(secs => window_seconds_param) THEN
    UPDATE public.api_rate_limits
    SET window_start = now_value,
        count = 1,
        updated_at = now_value
    WHERE key = key_param;

    RETURN jsonb_build_object(
      'ok', true,
      'limit', limit_param,
      'remaining', limit_param - 1,
      'retryAfterMs', window_seconds_param * 1000
    );
  END IF;

  retry_after_seconds := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (
      current_row.window_start
      + make_interval(secs => window_seconds_param)
      - now_value
    )))::INTEGER
  );

  IF current_row.count >= limit_param THEN
    UPDATE public.api_rate_limits
    SET updated_at = now_value
    WHERE key = key_param;

    RETURN jsonb_build_object(
      'ok', false,
      'limit', limit_param,
      'remaining', 0,
      'retryAfterMs', retry_after_seconds * 1000
    );
  END IF;

  UPDATE public.api_rate_limits
  SET count = count + 1,
      updated_at = now_value
  WHERE key = key_param;

  RETURN jsonb_build_object(
    'ok', true,
    'limit', limit_param,
    'remaining', limit_param - current_row.count - 1,
    'retryAfterMs', retry_after_seconds * 1000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;
