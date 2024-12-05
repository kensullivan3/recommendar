// Configuration
const clientId = 'edcd90da425b48bda2844511c524e312';
const redirectUri = 'https://recommendar-album-list.web.app';
const scopes = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' ');

// Utility Functions
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomString = Array.from({ length }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
  console.log("Generated Random String:", randomString); // Add this log
  return randomString;
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

// Spotify Authentication
async function redirectToSpotifyLogin() {
  console.log("Redirecting to Spotify login...");

  // Generate a new code verifier
  const codeVerifier = generateRandomString(128);
  console.log("Generated Code Verifier:", codeVerifier);

  // Store the code verifier in localStorage
  localStorage.setItem('spotifyCodeVerifier', codeVerifier);
  console.log("Stored Code Verifier in localStorage:", localStorage.getItem('spotifyCodeVerifier'));

  const codeChallenge = await generateCodeChallenge(codeVerifier);
  console.log("Generated Code Challenge:", codeChallenge);

  const state = generateRandomString(16);
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(codeChallenge)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}`;
  console.log("Spotify Auth URL:", authUrl);

  window.location.href = authUrl;
}

async function fetchAccessToken(code) {
  console.log('Fetching access token with code:', code);
  const codeVerifier = localStorage.getItem('spotifyCodeVerifier');

  if (!codeVerifier) {
    console.error('Code verifier is missing. Redirecting to Spotify login.');
    redirectToSpotifyLogin();
    return;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('spotifyAccessToken', data.access_token);
      localStorage.setItem('spotifyRefreshToken', data.refresh_token);
      localStorage.setItem('spotifyTokenExpiration', Date.now() + data.expires_in * 1000);
      console.log('Access token and refresh token stored.');
      await fetchUserProfile(data.access_token); // Test by fetching user profile first
      await fetchSpecificPlaylist(data.access_token);
    } else {
      console.error('Error fetching access token:', data);
      redirectToSpotifyLogin();
    }
  } catch (error) {
    console.error('Network error when fetching access token:', error);
    redirectToSpotifyLogin();
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotifyRefreshToken');
  if (!refreshToken) {
    redirectToSpotifyLogin();
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('spotifyAccessToken', data.access_token);
      localStorage.setItem('spotifyTokenExpiration', Date.now() + data.expires_in * 1000);
      console.log('Access token refreshed successfully.');
      return data.access_token;
    } else {
      console.error('Error refreshing access token:', data);
      redirectToSpotifyLogin();
    }
  } catch (error) {
    console.error('Network error when refreshing access token:', error);
    redirectToSpotifyLogin();
  }
}

async function isTokenValid() {
  const tokenExpiration = localStorage.getItem('spotifyTokenExpiration');
  if (Date.now() < tokenExpiration) {
    return true;
  } else {
    const newAccessToken = await refreshAccessToken();
    return !!newAccessToken;
  }
}

// Spotify API Interaction
async function fetchSpecificPlaylist(token) {
  try {
    const specificPlaylistId = '7pISMZ3hpVPn1mhPQXnB0F'; // Fixed playlist ID for testing

    // Fetch tracks from the specific playlist directly by ID
    await fetchTracksFromPlaylist(token, specificPlaylistId);
  } catch (error) {
    console.error('Error in fetchSpecificPlaylist:', error);
  }
}

async function fetchTracksFromPlaylist(token, playlistId) {
  try {
    const tracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!tracksResponse.ok) {
      console.error('Failed to fetch tracks from playlist:', tracksResponse.status);
      return;
    }

    const tracksData = await tracksResponse.json();
    console.log('Tracks from Specific Playlist:', tracksData);

    if (tracksData.items.length === 0) {
      console.error('No tracks found in the specified playlist.');
      return;
    }

    // Get the first track's album
    const firstTrack = tracksData.items[0].track;
    if (firstTrack && firstTrack.album) {
      displayAlbumInfo(firstTrack.album);
    } else {
      console.error('No valid album found in the track.');
    }
  } catch (error) {
    console.error('Error in fetchTracksFromPlaylist:', error);
  }
}

async function fetchUserProfile(token) {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error('Failed to fetch user profile:', response.status);
      const errorDetails = await response.text();
      console.error('Error details:', errorDetails);
      return;
    }

    const userData = await response.json();
    console.log('User Profile Data:', userData);
  } catch (error) {
    console.error('Error in fetchUserProfile:', error);
  }
}

function displayAlbumInfo(album) {
  document.getElementById('album-name').textContent = album.name;
  document.getElementById('album-artist').textContent = album.artists.map((artist) => artist.name).join(', ');
  document.getElementById('album-cover').src = album.images[0].url;
  document.getElementById('album-link').href = album.external_urls.spotify;
  document.getElementById('album-info').style.display = 'block';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('spotifyAccessToken');
  const tokenExpiration = localStorage.getItem('spotifyTokenExpiration');
  const code = getCodeFromUrl();
  console.log("Authorization Code:", code);

  if (token && tokenExpiration && Date.now() < tokenExpiration) {
    await fetchSpecificPlaylist(token);
  } else if (code) {
    await fetchAccessToken(code);
  } else {
    redirectToSpotifyLogin();
  }
});

document.getElementById('new-album-btn').addEventListener('click', async () => {
  const token = localStorage.getItem('spotifyAccessToken');
  if (token && await isTokenValid()) {
    await fetchSpecificPlaylist(token);
  } else {
    redirectToSpotifyLogin();
  }
});
