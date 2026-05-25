import { query } from "../config/db.js";

function toUser(row) {
  if (!row) {
    return null;
  }

  return {
    createdAt: row.created_at,
    email: row.email,
    googleId: row.google_id,
    id: row.id,
    lastLoginAt: row.last_login_at,
    name: row.name,
    provider: row.provider,
  };
}

export async function findUserByGoogleId(googleId) {
  const result = await query(
    `
      SELECT id, google_id, email, name, provider, created_at, last_login_at
      FROM users
      WHERE google_id = $1
      LIMIT 1
    `,
    [googleId],
  );

  return toUser(result.rows[0]);
}

export async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT id, google_id, email, name, provider, created_at, last_login_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );

  return toUser(result.rows[0]);
}

export async function createGoogleUser({ googleId, email, name }) {
  const result = await query(
    `
      INSERT INTO users (google_id, email, name, provider, last_login_at)
      VALUES ($1, $2, $3, 'google', NOW())
      RETURNING id, google_id, email, name, provider, created_at, last_login_at
    `,
    [googleId, email, name],
  );

  return toUser(result.rows[0]);
}

export async function updateUserLogin(userId) {
  const result = await query(
    `
      UPDATE users
      SET last_login_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, google_id, email, name, provider, created_at, last_login_at
    `,
    [userId],
  );

  return toUser(result.rows[0]);
}

async function attachGoogleIdToUser({ userId, googleId, name }) {
  const result = await query(
    `
      UPDATE users
      SET google_id = $2,
          name = COALESCE($3, name),
          last_login_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, google_id, email, name, provider, created_at, last_login_at
    `,
    [userId, googleId, name],
  );

  return toUser(result.rows[0]);
}

export async function upsertGoogleUser({ googleId, email, name }) {
  const userByGoogleId = await findUserByGoogleId(googleId);

  if (userByGoogleId) {
    return updateUserLogin(userByGoogleId.id);
  }

  const userByEmail = await findUserByEmail(email);

  if (userByEmail) {
    if (userByEmail.googleId !== googleId) {
      return attachGoogleIdToUser({
        googleId,
        name,
        userId: userByEmail.id,
      });
    }

    return updateUserLogin(userByEmail.id);
  }

  return createGoogleUser({ googleId, email, name });
}
