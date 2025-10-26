
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PhotoStyle } from '../types';
import { STYLE_CONFIG, MENU_PARSING_MODEL, IMAGE_GENERATION_MODEL, IMAGE_EDITING_MODEL } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function parseMenu(menuText: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: MENU_PARSING_MODEL,
      contents: `Parse the following restaurant menu text and return a JSON array of strings, where each string is a dish name. Only include the dish names, no prices or descriptions. Menu:\n\n${menuText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "The name of a dish from the menu."
          }
        }
      }
    });

    const jsonString = response.text.trim();
    const dishNames = JSON.parse(jsonString);
    return dishNames;
  } catch (error) {
    console.error("Error parsing menu:", error);
    throw new Error("Failed to understand the menu. Please provide a clearer list of dishes.");
  }
}

async function createDetailedImagePrompt(dishName: string, style: PhotoStyle): Promise<string> {
  const styleDetails = STYLE_CONFIG[style];
  const prompt = `Create a detailed, high-end food photography prompt for an image generation model. The dish is "${dishName}". The desired aesthetic is "${style}". The prompt must describe lighting, composition, plating, background, and any garnishes to create a hyper-realistic, appetizing image. Incorporate these style hints: ${styleDetails.promptHint}. The final output should ONLY be the prompt text itself, nothing else.`;
  
  const response = await ai.models.generateContent({
    model: MENU_PARSING_MODEL, // Using a fast model for prompt generation
    contents: prompt,
  });

  return response.text.trim();
}

export async function generateImage(dishName: string, style: PhotoStyle): Promise<{ base64Image: string; mimeType: string, prompt: string }> {
  try {
    const detailedPrompt = await createDetailedImagePrompt(dishName, style);
    const styleConfig = STYLE_CONFIG[style];

    const response = await ai.models.generateImages({
      model: IMAGE_GENERATION_MODEL,
      prompt: detailedPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: styleConfig.aspectRatio,
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("Image generation failed, no images returned.");
    }
    
    const image = response.generatedImages[0];
    return {
        base64Image: image.image.imageBytes,
        mimeType: image.image.mimeType,
        prompt: detailedPrompt
    };
  } catch (error) {
    console.error(`Error generating image for ${dishName}:`, error);
    // Re-throw original error to preserve details like status codes.
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`An unknown error occurred while generating an image for ${dishName}`);
  }
}

export async function editImage(base64ImageData: string, mimeType: string, prompt: string): Promise<{ base64Image: string, mimeType: string }> {
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_EDITING_MODEL,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            return {
                base64Image: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
            };
        } else {
            throw new Error("No edited image data found in the response.");
        }
    } catch (error) {
        console.error("Error editing image:", error);
        throw new Error("Failed to apply edits to the image.");
    }
}
