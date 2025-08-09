// A Node.js/Express server using Firestore for persistent user data.

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin'); // Import the Firebase Admin SDK
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Firebase and Firestore Initialization ---
// The __firebase_config and __app_id are provided by the Canvas environment.
const firebaseConfig = JSON.parse(process.env.__firebase_config);
const appId = process.env.__app_id;

// Initialize Firebase Admin SDK
// You would typically use a service account key file here, but for this environment,
// we assume the configuration is passed via environment variables.
// The code below is a simplified setup. In a production app on Render, you'd
// set up a Service Account and use the FIREBASE_SERVICE_ACCOUNT_KEY env var.
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
  });
}

const db = admin.firestore();

// --- Mock JWT and Authentication Logic ---
const createToken = (user) => {
  return Buffer.from(JSON.stringify({ id: user.id, username: user.username, role: user.role })).toString('base64');
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).send('No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('ascii'));
    
    // Fetch the user from Firestore to ensure the token is still valid
    const userRef = db.collection('users').doc(decoded.id);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return res.status(401).send('Invalid token: User does not exist');
    }
    
    req.user = decoded; // Attach the user info to the request object
    next();
  } catch (err) {
    return res.status(401).send('Invalid token');
  }
};

const checkAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).send('Forbidden: Insufficient permissions');
  }
};

// --- API Endpoints ---

// User registration
app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).send('Username and password are required.');
  }

  try {
    // Check if username already exists in Firestore
    const usersSnapshot = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!usersSnapshot.empty) {
      return res.status(409).send('Username already exists.');
    }

    // For a real app, you would use a password hashing library like bcrypt here.
    const newUser = { username, password, role: role || 'user' };

    // Add the new user to the 'users' collection in Firestore
    const docRef = await db.collection('users').add(newUser);
    
    console.log(`Registered new user with ID: ${docRef.id}`);
    res.status(201).send('User registered successfully.');
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('Server error during registration.');
  }
});

// User login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user by username and password in Firestore
    const usersSnapshot = await db.collection('users').where('username', '==', username).where('password', '==', password).limit(1).get();
    
    if (usersSnapshot.empty) {
      return res.status(401).send('Invalid credentials');
    }
    
    const userDoc = usersSnapshot.docs[0];
    const user = {
      id: userDoc.id,
      username: userDoc.data().username,
      role: userDoc.data().role
    };

    const token = createToken(user);
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send('Server error during login.');
  }
});

// Endpoint to verify a user's token (useful for checking if they're logged in)
app.get('/verify', verifyToken, (req, res) => {
  res.json({ message: 'Token is valid', user: req.user });
});

// Admin-only route to get all users
app.get('/users', verifyToken, checkAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const userList = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username,
      role: doc.data().role,
    }));
    res.json(userList);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Server error fetching users.');
  }
});

// New endpoint to get goals for the authenticated user
app.get('/goals', verifyToken, async (req, res) => {
  try {
    const goalsSnapshot = await db.collection('goals').get();
    const goalsList = goalsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(goalsList);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).send('Server error fetching goals.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
