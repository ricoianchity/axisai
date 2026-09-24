export function bearerToken(authorization) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization || '');
  return match?.[1] || null;
}

export async function verifiedUser(authorization) {
  const token = bearerToken(authorization);
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY,
      },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return typeof user?.id === 'string' && user.id ? user : null;
  } catch {
    return null;
  }
}
