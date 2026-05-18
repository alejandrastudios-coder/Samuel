export interface TranslationResponse {
  translatedText: string;
}

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, targetLanguage }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data: TranslationResponse = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
};
