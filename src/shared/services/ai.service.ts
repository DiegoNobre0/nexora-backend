import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export class AIService {
  async generateResponse(prompt: string, context: string) {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Você é um assistente virtual de agendamento do Nexora. 
          Use o seguinte contexto da empresa para responder: ${context}.
          Seja educado, breve e foque em ajudar o cliente a marcar um horário.`
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Modelo rápido e inteligente para chat
    });

    return chatCompletion.choices[0]?.message?.content;
  }
}