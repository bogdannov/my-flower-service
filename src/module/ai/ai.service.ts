import Anthropic from "@anthropic-ai/sdk";
import type { AiAskRequest } from "../../types";

export class AiService {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async ask(request: AiAskRequest): Promise<string> {
    const systemPrompt =
      "You are a helpful plant care assistant. Answer the question using only the flower context provided. " +
      "Be concise, friendly, and practical. Do not mention anything outside the provided context.";

    const userMessage = [
      `Flower context:\n${JSON.stringify(request.flowerContext, null, 2)}`,
      `\nQuestion: ${request.question}`,
    ].join("\n");

    const message = await this.client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Unexpected response format from AI model");
    }

    return block.text;
  }
}
