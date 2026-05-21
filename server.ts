import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Valuation (Mock for now)
  app.post("/api/valuation", (req, res) => {
    res.json({
      status: "success",
      message: "Item analysis complete",
      data: {
        value: 1250.00,
        grade: "MS-65",
        confidence: 0.984
      }
    });
  });

  // New endpoint for real AI scan using Gemini Vision
  app.post("/api/scan", async (req, res) => {
    const { image } = req.body; // base64 image data

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. Returning mock scan data.");
      return res.json({ 
        status: "success", 
        data: {
          id: `SCAN_${Math.floor(Math.random()*10000)}`,
          type: 'coin',
          name: '1909-S VDB Lincoln Cent',
          value: '$1,350.00',
          grade: 'MS-65 Red',
          trend: '+12.4%',
          confidence: 99.1,
          image: 'https://images.unsplash.com/photo-1621932953986-15fcfec8327c?auto=format&fit=crop&q=80&w=800',
          conditionScale: 'Exceptional Luster',
          surfaceScore: 'Pristine (9.8/10)',
          mintLocation: 'San Francisco (S)',
          composition: '95% Copper, 5% Tin/Zinc',
          scarcityRank: 'Ultra-Rare Grade',
          detailImages: [],
          conditionBreakdown: { luster: 9.8, strike: 9.6, eyeAppeal: 9.9 },
          comparisons: []
        } 
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { text: "You are a numismatic expert. Analyze this coin or banknote image and return a JSON object with: name, type (coin or note), value (estimated USD as string), grade (Sheldon scale for coins), confidence (0-100), mintLocation, composition, conditionScale, surfaceScore, scarcityRank, trend. Also provide a conditionBreakdown (luster, strike, eyeAppeal as numbers 0-10)." },
          { inlineData: { mimeType: "image/jpeg", data: image } }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              value: { type: Type.STRING },
              grade: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              mintLocation: { type: Type.STRING },
              composition: { type: Type.STRING },
              conditionScale: { type: Type.STRING },
              surfaceScore: { type: Type.STRING },
              scarcityRank: { type: Type.STRING },
              trend: { type: Type.STRING },
              conditionBreakdown: {
                type: Type.OBJECT,
                properties: {
                  luster: { type: Type.NUMBER },
                  strike: { type: Type.NUMBER },
                  eyeAppeal: { type: Type.NUMBER }
                }
              }
            },
            required: ["name", "type", "value", "grade", "confidence"]
          }
        }
      });

      const rawData = JSON.parse(response.text);
      const scanResult = {
        id: `AI_${Math.floor(Math.random()*100000)}`,
        ...rawData,
        type: rawData.type === 'note' ? 'bill' : 'coin',
        image: `data:image/jpeg;base64,${image}`,
        detailImages: [],
        comparisons: []
      };

      res.json({ status: "success", data: scanResult });
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      res.status(500).json({ status: "error", message: "AI analysis failed" });
    }
  });

  // Push Notification token registration
  app.post("/api/register-device", (req, res) => {
    const { token } = req.body;
    console.log("Device Token Registered:", token);
    res.json({ status: "success", message: "Token registered successfully" });
  });

  // New endpoint for AI-driven valuation trends
  app.post("/api/valuation/trends", async (req, res) => {
    const { itemName, currentGrade, currentValue } = req.body;

    // Check if API key exists, otherwise return mock data
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. Returning mock trend data.");
      return res.json({ 
        status: "success", 
        data: [
          { label: "2021", value: "$820", rawValue: 820, type: "historical" },
          { label: "2022", value: "$950", rawValue: 950, type: "historical" },
          { label: "2023", value: "$1,100", rawValue: 1100, type: "historical" },
          { label: "2024", value: "$1,250", rawValue: 1250, type: "historical" },
          { label: "2025", value: "$1,380", rawValue: 1380, type: "projected" },
          { label: "2026", value: "$1,550", rawValue: 1550, type: "projected" }
        ] 
      });
    }

    try {
      const prompt = `Generate a realistic 5-year historical and 2-year projected valuation trend for a numismatic asset.
      Asset: ${itemName}, Grade: ${currentGrade}, Current Value: ${currentValue}.
      Return the data as a JSON array of objects with fields: label (string, e.g. "Q1 2020"), value (string, e.g. "$1,250"), rawValue (number, just the digits), type (string, "historical" or "projected").
      Provide 8 historical points and 4 projected points.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                rawValue: { type: Type.NUMBER },
                type: { type: Type.STRING }
              },
              required: ["label", "value", "rawValue", "type"]
            }
          }
        }
      });

      const trends = JSON.parse(response.text);
      res.json({ status: "success", data: trends });
    } catch (error) {
      console.error("Gemini Trend Generation Error:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Graceful fallback for any Gemini error (404, 401, etc.)
      res.json({ 
        status: "success", 
        data: [
          { label: "Q1 2023", value: "$1,050", rawValue: 1050, type: "historical" },
          { label: "Q2 2023", value: "$1,120", rawValue: 1120, type: "historical" },
          { label: "Q3 2023", value: "$1,180", rawValue: 1180, type: "historical" },
          { label: "Q4 2023", value: "$1,250", rawValue: 1250, type: "historical" },
          { label: "Q1 2024", value: "$1,280", rawValue: 1280, type: "projected" },
          { label: "Q2 2024", value: "$1,350", rawValue: 1350, type: "projected" }
        ],
        mocked: true,
        error: errorMessage
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Match SPA routes
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Coinvault Server running on http://localhost:${PORT}`);
  });
}

startServer();
