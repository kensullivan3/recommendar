// Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js';

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyBXuDqvUjD6D0x4P1exirOkk2oR8Xm6cD4",
  authDomain: "recommendar-album-list.firebaseapp.com",
  databaseURL: "https://recommendar-album-list-default-rtdb.firebaseio.com",
  projectId: "recommendar-album-list",
  storageBucket: "recommendar-album-list.firebasestorage.app",
  messagingSenderId: "466275098929",
  appId: "1:466275098929:web:bcdeebcbb27ca853039010",
  measurementId: "G-VK1MJPP1V9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Configuration
const clientId = 'edcd90da425b48bda2844511c524e312';
const redirectUri = 'https://recommendar-album-list.web.app';
const scopes = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-modify-playback-state'  // Added scope for controlling playback
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
      await fetchRandomTrackAndRecommendAlbum(data.access_token);
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
async function fetchRandomTrackAndRecommendAlbum(token) {
  try {
    // Fetch a random track by searching for a random keyword
    const randomKeyword = generateRandomString(3); // Generate a random string to use as a keyword
    const trackResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(randomKeyword)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!trackResponse.ok) {
      console.error('Failed to fetch a random track:', trackResponse.status);
      return;
    }

    const trackData = await trackResponse.json();
    console.log('Random Track Data:', trackData);

    if (trackData.tracks.items.length === 0) {
      console.error('No tracks found for the random keyword.');
      return;
    }

    // Get the album from the track
    const randomTrack = trackData.tracks.items[0];
    const albumId = randomTrack.album.id;

    // Fetch album details to check track count
    const albumResponse = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!albumResponse.ok) {
      console.error('Failed to fetch album by ID:', albumResponse.status);
      return;
    }

    const albumData = await albumResponse.json();
    console.log('Album Data:', albumData);

    // Ensure the album has more than 4 tracks
    if (albumData.tracks.items.length <= 4) {
      console.log('Album has fewer than 5 tracks. Fetching a new one...');
      await fetchRandomTrackAndRecommendAlbum(token); // Retry with a new random track
      return;
    }

    // Save album to Firestore and recommend
    await fetchAlbumById(token, albumId);
  } catch (error) {
    console.error('Error in fetchRandomTrackAndRecommendAlbum:', error);
  }
}



// Save album to Firestore and avoid duplicates
async function saveAlbumToFirestore(album) {
  try {
    // Check if the album is already in Firestore
    const docRef = doc(db, "albums", album.id); // Use Spotify's album ID as the document ID
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("Album already exists in Firestore:", album.name);
      return false; // Indicate that the album is a duplicate
    }

    // Save the album to Firestore
    await setDoc(docRef, album);
    console.log("Album saved to Firestore:", album.name);
    return true; // Indicate that the album was saved successfully
  } catch (error) {
    console.error("Error saving album to Firestore:", error);
    return false;
  }
}

async function fetchAlbumById(token, albumId) {
  try {
    const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error('Failed to fetch album by ID:', response.status);
      return;
    }

    const albumData = await response.json();
    console.log('Album Data:', albumData);

    // Save album to Firestore and check for duplicates
    const isNewAlbum = await saveAlbumToFirestore({
      id: albumData.id, 
      name: albumData.name,
      artist: albumData.artists.map((artist) => artist.name).join(", "),
      spotify_url: albumData.external_urls.spotify,
      timestamp: new Date().toISOString(),
    });

    if (!isNewAlbum) {
      console.log("Duplicate album detected. Fetching a new one...");
      return; // Skip duplicate albums
    }

    // Display the album information
    displayAlbumInfo(albumData);

    // Automatically start playback
    await startPlayback(token, albumData.uri);
  } catch (error) {
    console.error('Error in fetchAlbumById:', error);
  }
}



async function ensureActivePlayback(token) {
  try {
    // Get the current player's state
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 204 || response.status === 404) {
      console.log('No active player found. Attempting to transfer playback...');
      // Fetch available devices
      const devicesResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const devicesData = await devicesResponse.json();
      const iphoneDevice = devicesData.devices.find(device => device.name === 'iPhone');

      if (iphoneDevice) {
        // Transfer playback to the iPhone
        const transferResponse = await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [iphoneDevice.id], play: true })
        });

        if (!transferResponse.ok) {
          console.error('Failed to transfer playback:', transferResponse.status);
          return false;
        }

        console.log('Playback transferred to iPhone successfully');
        return true;
      } else {
        console.error('iPhone device not found');
        return false;
      }
    }

    console.log('Player is active');
    return true;
  } catch (error) {
    console.error('Error ensuring active playback:', error);
    return false;
  }
}

async function startPlayback(token, contextUri) {
  try {
    // Ensure an active playback session
    const playbackReady = await ensureActivePlayback(token);

    if (!playbackReady) {
      console.error('Playback could not be started or transferred');
      return;
    }

    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ context_uri: contextUri }) // Pass the album's URI
    });

    if (!response.ok) {
      console.error('Failed to start playback:', response.status);
      return;
    }
    console.log('Playback started successfully');
  } catch (error) {
    console.error('Error in startPlayback:', error);
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
    await fetchRandomTrackAndRecommendAlbum(token);
  } else if (code) {
    await fetchAccessToken(code);
  } else {
    redirectToSpotifyLogin();
  }
});

document.getElementById('new-album-btn').addEventListener('click', async () => {
  const token = localStorage.getItem('spotifyAccessToken');
  if (token && await isTokenValid()) {
    await fetchRandomTrackAndRecommendAlbum(token);
  } else {
    redirectToSpotifyLogin();
  }
});
