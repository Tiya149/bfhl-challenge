/**
 * server.js
 * 
 * Main Express server application for the Chitkara Full Stack Engineering Challenge.
 * Sets up CORS, parses JSON requests, serves the static frontend SPA,
 * and exposes the POST /bfhl endpoint to process hierarchical relationship data.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { processData } = require('./processData');

const app = express();
const PORT = process.env.PORT || 3000;

// Enforce student credentials as specified in the rules
const USER_ID = "tiyakukar_14092005"; // format: fullname_ddmmyyyy dob
const EMAIL_ID = "tiya4819.be23@chitkara.edu.in"; // college email address
const COLLEGE_ROLL_NUMBER = "2310994819"; // college roll number

// Enable CORS for all routes (important for cross-origin testing by the evaluator)
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Serve static frontend assets from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /bfhl
 * Accepts a list of node relationship strings and returns structural insights.
 * 
 * Request Body format:
 * {
 *   "data": ["A->B", "A->C", ...]
 * }
 */
app.post('/bfhl', (req, res) => {
  try {
    const { data } = req.body;

    // Validate that 'data' field is provided and is an array
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: "Invalid request payload. Please provide an array of strings in the 'data' field."
      });
    }

    // Process the hierarchical relationship data
    const processedResult = processData(data);

    // Build the final response JSON merging identity fields and processed insights
    const responsePayload = {
      user_id: USER_ID,
      email_id: EMAIL_ID,
      college_roll_number: COLLEGE_ROLL_NUMBER,
      hierarchies: processedResult.hierarchies,
      invalid_entries: processedResult.invalid_entries,
      duplicate_edges: processedResult.duplicate_edges,
      summary: processedResult.summary
    };

    // Return successful response with the payload
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error processing /bfhl request:", error);
    return res.status(500).json({
      success: false,
      error: "An internal server error occurred while processing the relationship hierarchy."
    });
  }
});

// Fallback to serve the single-page application
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(`Chitkara REST API Server running on http://localhost:${PORT}`);
  console.log(`CORS enabled. Serving frontend assets from '/public'`);
  console.log(`===========================================================`);
});
