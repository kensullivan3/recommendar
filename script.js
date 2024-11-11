// script.js

// -------------------------------------------
// 1. Spotify Configuration
// -------------------------------------------

// Spotify Client ID
const clientId = 'edcd90da425b48bda2844511c524e312'; // Your Spotify Client ID

// Redirect URI 
const redirectUri = 'https://recommendar-album-list.web.app'; // Firebase Hosting URL

// Scopes required by your application
const scopes = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played'
].join(' ');

// Function to generate a random string (for state and code verifier)
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Function to generate code challenge
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Function to redirect user to Spotify authorization page
async function redirectToSpotifyLogin() {
    const state = generateRandomString(16); // Function to generate a random state string
    const codeVerifier = generateRandomString(128); // Function to generate code verifier
    localStorage.setItem('spotifyCodeVerifier', codeVerifier);

    console.log('Generated code verifier:', codeVerifier); // Add this line
  
    // Generate code challenge from the code verifier
    const codeChallenge = await generateCodeChallenge(codeVerifier); // Function to generate code challenge
  
    const authUrl = `https://accounts.spotify.com/authorize` +
  `?client_id=${encodeURIComponent(clientId)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&code_challenge_method=S256` +
  `&code_challenge=${encodeURIComponent(codeChallenge)}` +
  `&state=${encodeURIComponent(state)}` +
  `&scope=${encodeURIComponent(scopes)}`;

  
    window.location.href = authUrl;
  }
  
  // Function to extract the authorization code from the URL
function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

// Function to exchange the authorization code for an access token
async function fetchAccessToken(code) {
  console.log('Fetching access token with code:', code);
  const codeVerifier = localStorage.getItem('spotifyCodeVerifier');

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
      localStorage.setItem('spotifyRefreshToken', data.refresh_token); // Store refresh token
      localStorage.setItem('spotifyTokenExpiration', Date.now() + data.expires_in * 1000);
      console.log('Access token and refresh token stored.');

      // Show/hide buttons based on login state
      document.getElementById('login-btn').style.display = 'none';
      document.getElementById('logout-btn').style.display = 'block';
      document.getElementById('new-album-btn').style.display = 'block'; // Show "Get New Album" button

      fetchRecommendations(data.access_token);
    } else {
      console.error('Error fetching access token:', data);
    }
  } catch (error) {
    console.error('Network error when fetching access token:', error);
  }
}

// Function to check if the access token is still valid
async function isTokenValid() {
  const token = localStorage.getItem('spotifyAccessToken');
  const expirationTime = localStorage.getItem('spotifyTokenExpiration');

  if (token && Date.now() < expirationTime) {
    return true; // Token is still valid
  } else {
    // Call refreshAccessToken if the token is expired
    await refreshAccessToken();
    return localStorage.getItem('spotifyAccessToken') !== null;
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotifyRefreshToken');
  if (!refreshToken) return; // Exit if no refresh token

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

      // Show/hide buttons based on login state
      document.getElementById('login-btn').style.display = 'none';
      document.getElementById('logout-btn').style.display = 'block';
      document.getElementById('new-album-btn').style.display = 'block'; // Show "Get New Album" button
    } else {
      console.error('Error refreshing access token:', data);
    }
  } catch (error) {
    console.error('Network error when refreshing access token:', error);
  }
}


// -------------------------------------------
// 2. Firebase Configuration
// -------------------------------------------

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  child
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js';

// Your Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: 'AIzaSyBXuDqvUjD6D0x4P1exirOkk2oR8Xm6cD4', // Replace with your actual Web API Key
  authDomain: 'recommendar-album-list.firebaseapp.com',
  databaseURL: 'https://recommendar-album-list-default-rtdb.firebaseio.com',
  projectId: 'recommendar-album-list',
  storageBucket: 'recommendar-album-list.appspot.com',
  messagingSenderId: '466275098929',
  appId: '1:466275098929:web:bcdeebcbb27ca853039010',
  measurementId: 'G-VK1MJPP1V9'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth();

// Variable to store the user's unique ID
let userId = null;

// Sign in the user anonymously
signInAnonymously(auth)
  .then(() => {
    console.log('Signed in anonymously');
  })
  .catch((error) => {
    console.error('Error during anonymous sign-in:', error);
  });

// Listen for changes in authentication state
onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    console.log('User ID:', userId);

    // If access token is available and valid, proceed to fetch recommendations
    if (isTokenValid()) {
      const token = localStorage.getItem('spotifyAccessToken');
      fetchRecommendations(token);
    } else {
      // If token is invalid or missing, prompt user to log in
      console.log('Access token is invalid or expired.');
    }
  } else {
    console.log('User is signed out.');
  }
});

// -------------------------------------------
// 3. Spotify API Interaction
// -------------------------------------------

// Function to fetch recommendations from Spotify
async function fetchRecommendations(token) {
  try {
    // Fetch user's recently played tracks
    const recentTracksResponse = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=5',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const recentTracksData = await recentTracksResponse.json();

    // Handle potential errors
    if (recentTracksResponse.status !== 200) {
      console.error('Error fetching recent tracks:', recentTracksData);
      return;
    }

    const seedTrackIds = recentTracksData.items
      .map((item) => item.track.id)
      .join(',');

    // Fetch recommendations based on recently played tracks
    const recommendationsResponse = await fetch(
      `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTrackIds}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const recommendationsData = await recommendationsResponse.json();

    // Handle potential errors
    if (recommendationsResponse.status !== 200) {
      console.error('Error fetching recommendations:', recommendationsData);
      return;
    }

    console.log('Recommendations:', recommendationsData);
    getNewAlbum(recommendationsData);
  } catch (error) {
    console.error('Error in fetchRecommendations:', error);
  }
}

// Function to get a new album to play, avoiding duplicates
async function getNewAlbum(recommendations) {
  try {
    const savedAlbumIds = await fetchSavedAlbums();

    const newAlbum = recommendations.tracks
      .map((track) => track.album)
      .find((album) => !savedAlbumIds.includes(album.id));

    if (newAlbum) {
      console.log('Playing album:', newAlbum.name);
      displayAlbumInfo(newAlbum); // Ensure this is present
      saveRecommendedAlbums([newAlbum]);
    } else {
      console.log('No new albums found.');
      alert('No new albums found based on your recent listening.');
    }
  } catch (error) {
    console.error('Error in getNewAlbum:', error);
  }
}


// Function to display album information on the page
function displayAlbumInfo(album) {
    document.getElementById('album-name').textContent = album.name;
    document.getElementById('album-artist').textContent = album.artists
      .map((artist) => artist.name)
      .join(', ');
    document.getElementById('album-cover').src = album.images[0].url;
    document.getElementById('album-link').href = album.external_urls.spotify;
    document.getElementById('album-link').textContent = 'Listen on Spotify';
  
    // Make the album-info div visible
    document.getElementById('album-info').style.display = 'block';
  }
  

// -------------------------------------------
// 4. Firebase Database Interaction
// -------------------------------------------

// Function to save recommended albums to Firebase
function saveRecommendedAlbums(albums) {
  const albumIds = albums.map((album) => album.id);
  const userAlbumsRef = ref(database, `users/${userId}/recommendedAlbums`);

  get(userAlbumsRef)
    .then((snapshot) => {
      const existingAlbums = snapshot.exists() ? snapshot.val() : [];
      const updatedAlbums = [...new Set([...existingAlbums, ...albumIds])];
      return set(userAlbumsRef, updatedAlbums);
    })
    .then(() => console.log('Albums saved to Firebase successfully!'))
    .catch((error) => console.error('Error saving albums:', error));
}

// Function to fetch saved albums from Firebase
async function fetchSavedAlbums() {
  const userAlbumsRef = ref(database, `users/${userId}/recommendedAlbums`);
  const snapshot = await get(userAlbumsRef);
  return snapshot.exists() ? snapshot.val() : [];
}

// -------------------------------------------
// 5. Event Listeners and Initialization
// -------------------------------------------

// Event listener for generating new album
window.addEventListener('load', async () => {
  const code = getCodeFromUrl();

  if (code) {
    // Exchange authorization code for an access token
    await fetchAccessToken(code);
  } else if (await isTokenValid()) {
    // If logged in, fetch the initial album recommendation automatically
    const token = localStorage.getItem('spotifyAccessToken');
    await fetchRecommendations(token);
  } else {
    // Show login button if not logged in
    console.log('No valid access token or authorization code found.');
  }
});


// Extract the authorization code and fetch access token when the page loads
window.addEventListener('load', () => {
  const code = getCodeFromUrl();
  console.log('Authorization code from URL:', code); // Add this line

  if (code) {
    // If there's a code in the URL, exchange it for an access token
    fetchAccessToken(code);
  } else if (isTokenValid() && userId) {
    // If there's a valid access token and user ID, fetch recommendations
    const token = localStorage.getItem('spotifyAccessToken');
    fetchRecommendations(token);
  } else {
    // No code and no valid token, show the login button
    console.log('No valid access token or authorization code found.');
  }
});


// Event listener for logout button
document.getElementById('logout-btn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

// -------------------------------------------
// 6. Additional Utility Functions
// -------------------------------------------

// Function to log out and clear tokens
function logout() {
  localStorage.removeItem('spotifyAccessToken');
  localStorage.removeItem('spotifyTokenExpiration');
  localStorage.removeItem('spotifyCodeVerifier');

  // Reset UI elements
  document.getElementById('album-info').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'none';
  document.getElementById('login-btn').style.display = 'block';
  document.getElementById('new-album-btn').style.display = 'none'; // Hide "Get New Album" button

  alert('You have been logged out.');
}

// -------------------------------------------
// End of script.js
// -------------------------------------------
