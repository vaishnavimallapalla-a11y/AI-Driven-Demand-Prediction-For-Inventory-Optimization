import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateDemandPrediction = async (productName: string, currentStock: number, category: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Predict the demand for a product named "${productName}" in the category "${category}" with a current stock of ${currentStock}. Return a JSON object with predictedDemand (number) and confidence (number between 0 and 100).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedDemand: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER }
          },
          required: ["predictedDemand", "confidence"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { predictedDemand: currentStock + 10, confidence: 75 }; // Fallback
  }
};
