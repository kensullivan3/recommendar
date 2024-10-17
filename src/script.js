console.log("Script loaded successfully!");

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    try {
      const accessToken = await getAccessToken(clientId, code);
      const profile = await fetchProfile(accessToken); // Fetch profile data
      populateUI(profile); // Display profile data

      const recentlyPlayed = await fetchRecentlyPlayed(accessToken); // Fetch recently played tracks
      const recommendations = await fetchRecommendations(accessToken, recentlyPlayed); // Get recommendations
      displayRecommendations(recommendations); // Display recommendations
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  } else {
    console.log("No code found. Redirecting to Spotify login.");
    const loginButton = document.getElementById("login-btn");
    if (loginButton) {
      console.log("Login button found!");
      loginButton.addEventListener("click", () => {
        redirectToAuthCodeFlow(clientId);
      });
    } else {
      console.error("Login button not found!");
    }
  }
});

// Spotify Client ID
const clientId = "edcd90da425b48bda2844511c524e312"; // Replace with your actual client ID

// Function to populate UI with profile data
function populateUI(profile) {
  console.log("Profile Data:", profile);

  const displayNameEl = document.getElementById("displayName");
  const avatarEl = document.getElementById("avatar");
  const idEl = document.getElementById("id");
  const emailEl = document.getElementById("email");
  const uriEl = document.getElementById("uri");
  const urlEl = document.getElementById("url");

  if (displayNameEl) displayNameEl.innerText = profile.display_name || "(No Name)";
  if (idEl) idEl.innerText = profile.id || "(No ID)";
  if (emailEl) emailEl.innerText = profile.email || "(No Email)";

  if (uriEl) {
    uriEl.innerText = profile.uri;
    uriEl.setAttribute("href", profile.external_urls.spotify);
  }

  if (urlEl) {
    urlEl.innerText = profile.href;
    urlEl.setAttribute("href", profile.href);
  }

  if (profile.images && profile.images.length > 0) {
    const profileImage = new Image(200, 200);
    profileImage.src = profile.images[0].url;
    avatarEl.appendChild(profileImage);
  } else {
    avatarEl.innerText = "(No Profile Image)";
  }
}

// Fetch user profile data
async function fetchProfile(token) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch profile data");
  }

  return await response.json();
}

// Fetch recently played tracks
async function fetchRecentlyPlayed(token) {
  const response = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=10", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch recently played tracks");
  }

  const data = await response.json();
  console.log("Recently Played:", data);
  return data.items;
}

// Fetch song recommendations
async function fetchRecommendations(token, seedTracks) {
  const seed = seedTracks.slice(0, 5).map((track) => track.track.id).join(",");

  const response = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${seed}&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  const data = await response.json();
  console.log("Recommendations:", data);
  return data.tracks;
}

// Display recommendations in the UI
function displayRecommendations(tracks) {
  const list = document.getElementById("recommendation-list");

  if (!list) {
    console.error("Recommendation list element not found!");
    return;
  }

  list.innerHTML = ""; // Clear existing recommendations

  tracks.forEach((track) => {
    const listItem = document.createElement("li");
    listItem.textContent = `${track.name} by ${track.artists[0].name}`;
    list.appendChild(listItem);
  });
}

// Get access token from Spotify
async function getAccessToken(clientId, code) {
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", "http://localhost:5173");
  params.append("code_verifier", verifier);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const { access_token } = await response.json();
  console.log("Access Token:", access_token);

  window.history.replaceState({}, document.title, "/");
  return access_token;
}

// Redirect user to Spotify authorization
async function redirectToAuthCodeFlow(clientId) {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: "http://localhost:5173",
    scope: "user-read-private user-read-email user-read-recently-played",
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Generate code verifier for PKCE
function generateCodeVerifier(length) {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Generate code challenge for PKCE
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
