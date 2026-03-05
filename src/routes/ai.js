const express = require('express');
const router = express.Router();
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const supabase = require('../config/supabase');

async function getAccessToken() {
    const auth = new GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

router.post('/generate-image', authMiddleware, async (req, res) => {
    const { image, backgroundImage, prompt } = req.body;

    try {
        // 1. Check credits
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', req.user.id)
            .single();

        if (profileError || !profile || profile.credits <= 0) {
            return res.status(403).json({ error: 'Créditos insuficientes' });
        }

        // 2. Get Google Token
        const accessToken = await getAccessToken();

        // 3. Project ID from keyFile or Env
        const serviceAccount = require(process.env.GOOGLE_SERVICE_ACCOUNT_PATH);
        const PROJECT_ID = serviceAccount.project_id;
        const ENDPOINT = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;
        // Note: The specific model ID might need adjustment based on the original code's requirement.
        // Original used: gemini-2.5-flash:generateContent but the prompt had responseModalities: ["IMAGE"]
        // Actually, for Imagen 3:
        // https://aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict

        const parts = [{ text: prompt }];
        if (image) parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });
        if (backgroundImage) parts.push({ inline_data: { mime_type: "image/jpeg", data: backgroundImage } });

        // Porting the exact payload logic if possible, but standard Vertex AI Image Gen uses 'instances'
        const aiPayload = {
            instances: [
                {
                    prompt: prompt,
                    // If using Image-to-Image or Background, the structure differs.
                    // For simplicity, I'll follow the original logic's intent.
                }
            ],
            parameters: {
                sampleCount: 1,
            }
        };

        // Wait, the original code used 'gemini-2.5-flash:generateContent' which is a Gemini model that can generate images?
        // Let me check the original code again.
        // Line 80: gemini-2.5-flash:generateContent

        const GEMINI_ENDPOINT = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;

        const geminiPayload = {
            contents: [
                {
                    role: "user",
                    parts: parts
                }
            ],
            generationConfig: {
                temperature: 0.3,
                responseModalities: ["IMAGE"]
            }
        };

        const response = await axios.post(GEMINI_ENDPOINT, geminiPayload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // 4. Deduct credit
        await supabase
            .from('profiles')
            .update({ credits: profile.credits - 1 })
            .eq('id', req.user.id);

        res.json(response.data);

    } catch (err) {
        console.error('AI Error:', err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
