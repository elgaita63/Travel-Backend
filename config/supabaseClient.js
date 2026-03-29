const { createClient } = require('@supabase/supabase-js');

// Usamos la Service Role Key para tener acceso total al bucket privado
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const fetchWithTimeout = (url, options) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); 

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));
};

// Inicialización con privilegios de Administrador
const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  global: {
    fetch: fetchWithTimeout
  }
});

module.exports = supabase;