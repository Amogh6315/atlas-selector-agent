import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { gemini } from "./gemini.js";
import { SELECTOR_SYSTEM_PROMPT } from "./prompts.js";
import { cleanSelectors } from "./selectorValidator.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(
    express.json({
        limit: "10mb",
    })
);

// Home route
app.get("/", (_req, res) => {
    res.json({
        message: "Atlas Selector Agent API is running",
    });
});

// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
    });
});

// Gemini connection test
app.get("/test-gemini", async (_req, res) => {
    try {
        const response = await gemini.models.generateContent({
            model: "gemini-3.8-flash",
            contents: "Say exactly: Atlas Gemini API is connected.",
        });

        res.json({
            result: response.text,
        });
    } catch (error) {
        console.error("Gemini test error:", error);

        res.status(500).json({
            error: "Gemini API request failed",
        });
    }
});

// Gemini request with retry for temporary 503 errors
async function generateSelectorWithRetry(
    contents: any,
    maxRetries = 3
) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await gemini.models.generateContent({
                model: "gemini-3.8-flash",
                contents,
            });
        } catch (error: any) {
            const status = error?.status;

            console.error(
                `Gemini request failed. Attempt ${attempt + 1}/${maxRetries + 1}`,
                error
            );

            // Only retry temporary service-unavailable errors
            if (status !== 503 || attempt === maxRetries) {
                throw error;
            }

            const delay = 1000 * Math.pow(2, attempt);

            console.log(
                `Gemini temporarily unavailable. Retrying in ${delay}ms...`
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error("Gemini request failed after retries");
}

// Selector generation
app.post("/api/selector", async (req, res) => {
    try {
        const { image, targetDescription, feedback } = req.body;
        console.log("Target description received:", targetDescription);
        if (!image) {
            return res.status(400).json({
                error: "Image is required",
            });
        }

        const response = await generateSelectorWithRetry([
            {
                role: "user",
                parts: [
                    {
                        
text: `${SELECTOR_SYSTEM_PROMPT}

TARGET DESCRIPTION:
${typeof targetDescription === "string" && targetDescription.trim()
    ? targetDescription.trim()
    : "Identify the element most clearly indicated in the screenshot."}

${typeof feedback === "string" && feedback.trim()
    ? `USER FEEDBACK ON THE PREVIOUS RESULT:
${feedback.trim()}

Regenerate the selectors by addressing this feedback.
Do not repeat a previously incorrect selector unless it is still the best valid option.`
    : ""}

IMPORTANT:
- Generate selectors only for the requested target element.
- Do not return selectors for other elements visible in the screenshot.
- Return up to 3 alternatives for the same target element.
- If the target cannot be identified reliably, return NONE.`,

                    },
                    {
                        inlineData: {
                            mimeType: "image/png",
                            data: image,
                        },
                    },
                ],
            },
        ]);

        const rawOutput = response.text?.trim() || "";

        console.log("Gemini raw output:");
        console.log(rawOutput);

        const selectors = cleanSelectors(rawOutput);

        console.log("Validated selectors:");
        console.log(selectors);

        return res.json({
            selectors,
        });
    } catch (error) {
        console.error("Selector generation error:", error);

        return res.status(500).json({
            error: "Failed to generate selector",
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Atlas server running on http://localhost:${PORT}`);
});