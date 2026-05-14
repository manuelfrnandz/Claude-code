// Loaded before any test file — sets env vars before the config module evaluates
process.env['NODE_ENV'] = 'development';
process.env['APP_SECRET_KEY'] = 'test-secret-key-minimum-32-characters!!';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-role-key';
process.env['OPENAI_API_KEY'] = 'sk-test';
process.env['META_APP_SECRET'] = 'test-meta-secret';
process.env['META_VERIFY_TOKEN'] = 'test-verify-token';
process.env['ADMIN_SECRET'] = 'test-admin-secret-32-chars-minimum!!';
