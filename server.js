// =================================================================
// RESUME SORTER AI - SERVER FILE (Final, More Robust Version)
// =================================================================

import 'dotenv/config';
import express from 'express';
import fileUpload from 'express-fileupload';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// --- Middleware ---
app.use(express.json());
app.use(fileUpload());

// --- Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/parse-resume', async (req, res) => {
    console.log('Received a file upload for parsing.');

    try {
        if (!req.files || !req.files.resume) {
            return res.status(400).json({ message: 'Error: No resume file uploaded.' });
        }
        console.log('File received. Extracting text from PDF...');

        const resumeFile = req.files.resume;
        const pdfData = await pdf(resumeFile.data);
        const resumeText = pdfData.text;

        console.log('PDF text extracted. Sending to OpenAI API for structuring...');

        const systemPrompt = `
            You are an expert data extraction assistant. Your task is to parse the text from a resume and structure it into a JSON array of objects.
            Each object must represent an item from "Education", "Employment/Project", or "Award/Achievement" and have four keys: "category", "name", "dates", and "reference".
            For "dates" and "reference", if the information is not found, use a single question mark: "?".
            The final output must be a valid JSON object containing a single key (e.g., "resume_data") whose value is the array of extracted items.
        `;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: resumeText },
            ],
            response_format: { type: "json_object" },
        });

        console.log('Successfully received structured data from OpenAI.');

        const rawResponse = completion.choices[0].message.content;

        // ===================================================================
        // === NEW & IMPROVED LOGIC STARTS HERE ===
        // ===================================================================

        // 1. Add a log to see exactly what the AI sent us. CRITICAL FOR DEBUGGING.
        console.log('Raw AI Response:', rawResponse);

        const jsonData = JSON.parse(rawResponse);
        let parsedData; // This will hold our final array

        // 2. Make our logic more flexible.
        // Case 1: Did the AI return the array directly?
        if (Array.isArray(jsonData)) {
            parsedData = jsonData;
        }
        // Case 2: Did the AI wrap the array in an object, as requested?
        else if (typeof jsonData === 'object' && jsonData !== null) {
            // Find the first value in the object that is an array
            parsedData = Object.values(jsonData).find(value => Array.isArray(value));
        }

        // 3. Now check if we successfully found the array.
        if (!parsedData) {
            // If we still can't find it, we throw the error. The log above will tell us why.
            throw new Error("AI did not return the expected array format. Check the 'Raw AI Response' log above.");
        }
        
        // ===================================================================
        // === END OF NEW LOGIC ===
        // ===================================================================

        res.status(200).json({
            message: 'Resume parsed successfully!',
            data: parsedData,
        });

    } catch (error) {
        console.error('An error occurred during parsing:', error);
        res.status(500).json({
            message: 'An internal server error occurred.',
            error: error.message,
        });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`➡️ Open your browser and go to http://localhost:${PORT}`);
});