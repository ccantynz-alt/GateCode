export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Failed to get access token"
    );
  }

  return data.access_token;
}

export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "GateCode",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as GitHubUser;
  return {
    id: data.id,
    login: data.login,
    email: data.email,
    avatar_url: data.avatar_url,
  };
}

/**
 * Create an installation-scoped token for a repo.
 * MVP: returns the user's own OAuth token. Proper scoped tokens
 * require registering a GitHub App with fine-grained installation tokens.
 */
export async function createInstallationToken(
  token: string,
  _repo: string,
  _scope: string
): Promise<{ token: string; expires_at: string }> {
  // In production, this would create a scoped GitHub App installation token.
  // For MVP, we pass through the user's OAuth token with a 1-hour expiry.
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { token, expires_at: expiresAt };
}
