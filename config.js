// Configuración pública del panel.
// La clave publicable de Supabase es segura en el navegador: los permisos (RLS) de la base de datos
// solo dejan ver y editar a los correos registrados en la tabla `administradores`.
// NUNCA pongas aquí la clave secreta (service_role).
export const CONFIG = {
  negocio: 'Huevos de la Naza',
  supabaseUrl: 'https://grvdcfbexzgfkadtstow.supabase.co',
  supabaseKey: 'sb_publishable_uwTnNqjbVmRr8N77UaHzqA_ewhBD56Z',
  // Webhook de n8n para acciones que avisan al cliente (en camino, entregado, cancelar, pagos, casos).
  accionesUrl: 'https://danielquiroz.app.n8n.cloud/webhook/hn-panel-acciones',
  // Genera reportes en Google Sheets (n8n verifica la sesión y que sea Admin; las credenciales de Google viven solo en n8n).
  reportesUrl: 'https://danielquiroz.app.n8n.cloud/webhook/hn-reportes',
  // Enlace a la hoja espejo de Google Sheets (solo lectura). Se completa cuando exista.
  hojaUrl: 'https://docs.google.com/spreadsheets/d/14wxxYwbXB0_Nf3Ah0mrs9J-nRppDbJoQu-mw_Z77-D4/edit'
};
