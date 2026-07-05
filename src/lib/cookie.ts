async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign', 'verify']
  );
}

export async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  
  // Convert signature to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hexSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${value}.${hexSignature}`;
}

export async function verifyCookieValue(signedValue: string, secret: string): Promise<string | null> {
  if (!signedValue) return null;
  
  const parts = signedValue.split('.');
  if (parts.length !== 2) return null;
  const [value, hexSignature] = parts;
  
  try {
    const key = await getCryptoKey(secret);
    const enc = new TextEncoder();
    
    // Convert hex back to bytes
    const hexMatch = hexSignature.match(/.{1,2}/g);
    if (!hexMatch) return null;
    const signatureBytes = new Uint8Array(hexMatch.map(byte => parseInt(byte, 16)));
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, enc.encode(value));
    return isValid ? value : null;
  } catch (err) {
    console.error('Cookie verification error:', err);
    return null;
  }
}
