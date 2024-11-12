import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js';

// Initial load listener to handle token check and login button display
window.addEventListener('load', async () => {
  const token = localStorage.getItem('spotifyAccessToken');
  const tokenExpiration = localStorage.getItem('spotifyTokenExpiration');

  if (!token || !tokenExpiration || Date.now() > tokenExpiration) {
    // No valid token or token has expired; redirect to Spotify login
    redirectToSpotifyLogin();
  } else {
    // Token is valid, continue to fetch recommendations
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('new-album-btn').style.display = 'block';
    fetchRecommendations(token);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('spotifyAccessToken');
  const tokenExpiration = localStorage.getItem('spotifyTokenExpiration');
  const code = getCodeFromUrl();

  if (!token || !tokenExpiration || Date.now() > tokenExpiration) {
    if (!code) {
      // If there's no valid token and no code in the URL, redirect to login
      redirectToSpotifyLogin();
      return; // Stop further execution
    }
  }

  if (code) {
    fetchAccessToken(code);
  }
});



document.addEventListener('DOMContentLoaded', () => {
  const clientId = 'edcd90da425b48bda2844511c524e312';
  const redirectUri = 'https://recommendar-album-list.web.app';
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-read-recently-played'
  ].join(' ');

  function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function redirectToSpotifyLogin() {
    const state = generateRandomString(16);
    const codeVerifier = generateRandomString(128);
    localStorage.setItem('spotifyCodeVerifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(codeChallenge)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  }

  function getCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('code');
  }

  async function fetchAccessToken(code) {
    console.log('Fetching access token with code:', code);
    const codeVerifier = localStorage.getItem('spotifyCodeVerifier');
    console.log("Access Token:", localStorage.getItem("spotifyAccessToken"));
  
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
      if (data.error === 'invalid_grant' || data.error_description === 'Authorization code expired') {
        console.log('Authorization code expired. Redirecting to login.');
        redirectToSpotifyLogin();
        return; // Exit the function early if the authorization code has expired
      }
  
      if (response.ok) {
        localStorage.setItem('spotifyAccessToken', data.access_token);
        localStorage.setItem('spotifyRefreshToken', data.refresh_token); // Store refresh token
        localStorage.setItem('spotifyTokenExpiration', Date.now() + data.expires_in * 1000);
        console.log('Access token and refresh token stored.');
  
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('new-album-btn').style.display = 'block';
        fetchRecommendations(data.access_token);
      } else {
        console.error('Error fetching access token:', data);
        redirectToSpotifyLogin();
      }
    } catch (error) {
      console.error('Network error when fetching access token:', error);
      redirectToSpotifyLogin();
    }
  }
  
  async function fetchRecommendations(token) {
    try {
      const recentTracksResponse = await fetch(
        'https://api.spotify.com/v1/me/player/recently-played?limit=5',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const recentTracksData = await recentTracksResponse.json();
      const seedTrackIds = recentTracksData.items
        .map((item) => item.track.id)
        .join(',');

      const recommendationsResponse = await fetch(
        `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTrackIds}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const recommendationsData = await recommendationsResponse.json();
      getNewAlbum(recommendationsData);
    } catch (error) {
      console.error('Error in fetchRecommendations:', error);
    }
  }

  function getNewAlbum(recommendations) {
    const newAlbum = recommendations.tracks.map((track) => track.album)[0];
    displayAlbumInfo(newAlbum);
  }

  function displayAlbumInfo(album) {
    document.getElementById('album-name').textContent = album.name;
    document.getElementById('album-artist').textContent = album.artists.map((artist) => artist.name).join(', ');
    document.getElementById('album-cover').src = album.images[0].url;
    document.getElementById('album-link').href = album.external_urls.spotify;
    document.getElementById('album-info').style.display = 'block';
  }

  document.getElementById('new-album-btn').addEventListener('click', () => {
    const token = localStorage.getItem('spotifyAccessToken');
    if (token) fetchRecommendations(token);
  });

  const code = getCodeFromUrl();
  if (code) fetchAccessToken(code);
});
