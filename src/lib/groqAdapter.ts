import type { CopilotKitServiceAdapter } from "@copilotkit/backend";
// import type { Message } from "@copilotkit/shared";

export class GroqAdapter implements CopilotKitServiceAdapter {
  constructor(private apiKey: string) {}

  async getResponse(forwardedProps: any) {
    const messages: any[] = forwardedProps.messages;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        stream: false,
      }),
    });

    const data = await response.json();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(data.choices[0]?.message?.content ?? ""));
        controller.close();
      },
    });
    return { stream };
  }

  process(forwardedProps: any) {
    return this.getResponse(forwardedProps);
  }
} 