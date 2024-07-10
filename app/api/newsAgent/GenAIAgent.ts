import Anthropic from "@anthropic-ai/sdk";
import { AnthropicStream, StreamingTextResponse } from "ai";

// Claude
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export enum LLMModels {
  CLAUDE_HAIKU = "claude-3-haiku-20240307",
  CLAUDE_SONNET = "claude-3-5-sonnet-20240620",
  CLAUDE_OPUS = "claude-3-opus-20240229",
}

export const LLMExecute = async (
  prompt: string,
  model: LLMModels,
  system = "You are a helpful assistant",
  history = [],
  max_tokens = 1000,
  streamFlag = true
): Promise<any> => {
  try {
    if (
      [
        LLMModels.CLAUDE_HAIKU,
        LLMModels.CLAUDE_SONNET,
        LLMModels.CLAUDE_OPUS,
      ].includes(model)
    ) {
      if (streamFlag) {
        const response = await claude_exe(
          model,
          prompt,
          max_tokens,
          system,
          history
        );
        const stream = AnthropicStream(response);
        return new StreamingTextResponse(stream);
      } else {
        const res = await claude_exe_flat(
          model,
          prompt,
          max_tokens,
          system,
          history
        );
        return res?.content?.[0].text;
      }
    } else {
      return "";
    }
  } catch (error: any) {
    console.log("Error in LLM Execution - ", error?.message);
    return null;
  }
};

export async function claude_exe(
  model: any,
  prompt: any,
  max_tokens = 600,
  system = "You are helpful assistant",
  history = []
) {
  return anthropic.messages.create({
    model: model,
    max_tokens: max_tokens,
    temperature: 0.4,
    stream: true,
    system: system,
    messages: [
      ...history,
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });
}

export async function claude_exe_flat(
  model: any,
  prompt: any,
  max_tokens = 600,
  system = "You are helpful assistant",
  history = []
) {
  return anthropic.messages.create({
    model: model,
    max_tokens: max_tokens,
    temperature: 0.4,
    stream: false,
    system: system,
    messages: [
      ...history,
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });
}
