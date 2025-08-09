const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors());

// --- Firebase Admin SDK Initialization ---
// IMPORTANT: Make sure to set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable on Render
// with the JSON content of your service account file.
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK. Please check your FIREBASE_SERVICE_ACCOUNT_KEY environment variable:", error);
}

// --- Authentication Middleware ---
const authenticate = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

// --- Protected API Routes ---
// Apply the 'authenticate' middleware to any route that requires a logged-in user.
app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const userProfile = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (!userProfile.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.status(200).json(userProfile.data());
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Example route for a front-end registration form
app.post('/api/user/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      const userRecord = await admin.auth().createUser({ email, password });
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        email: userRecord.email,
        createdAt: new Date()
      });
      res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
      console.error("Error registering new user:", error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});