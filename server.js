// A Node.js/Express server using Supabase for persistent user data.

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Supabase Client Initialization ---
// NOTE: For security, these should be environment variables in production.
// Replace these with your actual Supabase project URL and service role key.
// The service role key is for server-side access and bypasses RLS.
const SUPABASE_URL = process.env.SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Mock JWT and Authentication Logic ---
// This is a simple token verification using Supabase auth.
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).send('No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    // Verify the JWT token using Supabase's built-in functionality
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      return res.status(401).send('Invalid token.');
    }
    req.user = { id: user.id }; // Attach the user ID to the request object
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).send('Server error during token verification.');
  }
};

// --- API Endpoints ---
// Endpoint to get all goals for the authenticated user
app.get('/goals', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching goals:', error);
      return res.status(500).send('Server error fetching goals.');
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).send('Server error fetching goals.');
  }
});

// Endpoint to add a new goal for the authenticated user
app.post('/goals', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const newGoal = {
    ...req.body,
    user_id: userId,
    created_at: new Date().toISOString(),
    saved_amount: req.body.saved_amount || 0, // Ensure saved amount has a default
  };

  try {
    const { data, error } = await supabase
      .from('goals')
      .insert([newGoal])
      .select();

    if (error) {
      console.error('Error adding goal:', error);
      return res.status(500).send('Server error adding goal.');
    }
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error adding goal:', error);
    res.status(500).send('Server error adding goal.');
  }
});

// Endpoint to update a goal for the authenticated user
app.put('/goals/:id', verifyToken, async (req, res) => {
  const goalId = req.params.id;
  const userId = req.user.id;
  const { name, target_amount, saved_amount, category, target_date } = req.body;

  try {
    const { data, error } = await supabase
      .from('goals')
      .update({
        name,
        target_amount,
        saved_amount,
        category,
        target_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', goalId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error updating goal:', error);
      return res.status(500).send('Server error updating goal.');
    }

    if (!data || data.length === 0) {
      return res.status(404).send('Goal not found or unauthorized.');
    }
    res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).send('Server error updating goal.');
  }
});

// Endpoint to delete a goal for the authenticated user
app.delete('/goals/:id', verifyToken, async (req, res) => {
  const goalId = req.params.id;
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', userId)
      .select();
    
    if (error) {
      console.error('Error deleting goal:', error);
      return res.status(500).send('Server error deleting goal.');
    }

    if (!data || data.length === 0) {
      return res.status(404).send('Goal not found or unauthorized.');
    }
    res.status(200).send('Goal deleted successfully.');
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).send('Server error deleting goal.');
  }
});

// Endpoint to make a deposit to a goal (uses PATCH)
app.patch('/goals/:id', verifyToken, async (req, res) => {
  const goalId = req.params.id;
  const userId = req.user.id;
  const { saved_amount } = req.body;

  try {
    const { data, error } = await supabase
      .from('goals')
      .update({ saved_amount: saved_amount, updated_at: new Date().toISOString() })
      .eq('id', goalId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error updating goal:', error);
      return res.status(500).send('Server error updating goal.');
    }

    if (!data || data.length === 0) {
      return res.status(404).send('Goal not found or unauthorized.');
    }
    res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).send('Server error updating goal.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
