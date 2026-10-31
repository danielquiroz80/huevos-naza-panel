// Desbloqueo con huella / Face ID usando el sensor del teléfono (WebAuthn).
// Con la huella activa, la sesión se mantiene en el dispositivo y la huella es la forma de entrar.
const CLAVE = 'naza_bio';
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function bioDisponible() {
  try {
    return !!(window.PublicKeyCredential && window.isSecureContext &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) { return false; }
}

export function bioConfig(email) {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return d && d.email === email ? d : null;
  } catch (e) { return null; }
}

export async function bioActivar(email, nombre) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: azar(32),
      rp: { name: 'Huevos de la Naza', id: location.hostname },
      user: { id: azar(16), name: email, displayName: nombre || email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000
    }
  });
  if (!cred) throw new Error('No se pudo activar.');
  localStorage.setItem(CLAVE, JSON.stringify({ email, id: b64(cred.rawId) }));
}

export async function bioVerificar(conf) {
  const r = await navigator.credentials.get({
    publicKey: {
      challenge: azar(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: unb64(conf.id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000
    }
  });
  if (!r) throw new Error('No se pudo verificar.');
  sessionStorage.setItem('naza_desbloqueado', '1');
}

export const bioDesactivar = () => localStorage.removeItem(CLAVE);
export const desbloqueado = () => sessionStorage.getItem('naza_desbloqueado') === '1';

/** Bloquea la app sin cerrar la sesión: la próxima entrada es solo con huella. */
export function bloquear() {
  sessionStorage.removeItem('naza_desbloqueado');
  window.dispatchEvent(new Event('naza-bloquear'));
}
