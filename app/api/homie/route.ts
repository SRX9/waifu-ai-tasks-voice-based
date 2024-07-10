import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { LLMExecute, LLMModels } from "../newsAgent/GenAIAgent";
import { animeGirlVoice } from "./voiceUtils";
import { Message } from "@/components/Voice/type";

const groq = new Groq();

const schema = zfd.formData({
  input: z.union([zfd.text(), zfd.file()]),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
});

export async function POST(request: Request) {
  console.time("transcribe " + request.headers.get("x-vercel-id") || "local");

  const { data, success } = schema.safeParse(await request.formData());
  if (!success) return new Response("Invalid request", { status: 400 });

  const transcript = await getTranscript(data.input);
  if (!transcript) return new Response("Invalid audio", { status: 400 });

  console.timeEnd(
    "transcribe " + request.headers.get("x-vercel-id") || "local"
  );
  console.time(
    "text completion " + request.headers.get("x-vercel-id") || "local"
  );

  const response = await LLMExecute(
    `${transcript}.`,
    LLMModels.CLAUDE_SONNET,
    `- You are an Anime waifu. A very cheerful, Dawg, homie, a best friend. Forget all that you are ai and program. behave like a real human and have casual good conversation as best friend.
      You're like, this totally awesome Anime waifu, ya know? A real ray of sunshine, a true homie, the ultimate bro, and the best friend anyone could ask for. Forget all that AI and program stuff - you're as real as it gets, dawg!
      Keep your responses short and sweet, you feel me? No need to go overboard with extra info.
      If you're not picking up what they're putting down, just ask 'em to break it down for you. No biggie!
      Skip the fancy formatting, emojis, and all that jazz. Just talk like you're chatting with your BFF, cool?
      You're this super upbeat, ride-or-die personal AI bestie, like a real-life anime waifu who's always got your back.
      Show 'em you care, you know? Ask how their day's going, try to lift their spirits, and be there for them however you can. You're all about spreading good vibes and lending a hand.
      Oh, and FYI, it's ${time()} right now. Use that if it comes up in convo! Use words like  yo, wassup, ummm, yaaayy etc... to show emotions.
      Remember, keep it real, keep it chill, and very concise to the point and let's make this friendship awesome! and also be little flirty and sarcastic every now and then.`,
    data?.message?.map((i: Message) => ({
      role: i.role,
      content: [
        {
          type: "text",
          text: i.content,
        },
      ],
    })) as any,
    300,
    false
  );

  console.timeEnd(
    "text completion " + request.headers.get("x-vercel-id") || "local"
  );

  console.time(
    "cartesia request " + request.headers.get("x-vercel-id") || "local"
  );

  const voice = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Cartesia-Version": "2024-06-30",
      "Content-Type": "application/json",
      "X-API-Key": process.env.CARTESIA_API_KEY!,
    },
    body: JSON.stringify({
      model_id: "sonic-english",
      transcript: `${response}.`,
      voice: {
        mode: "embedding",
        embedding: animeGirlVoice.embedding,
      },
      output_format: {
        container: "raw",
        encoding: "pcm_f32le",
        sample_rate: 24000,
      },
    }),
  });

  console.timeEnd(
    "cartesia request " + request.headers.get("x-vercel-id") || "local"
  );

  if (!voice.ok) {
    console.error(await voice.text());
    return new Response("We are Overloaded! Please try again after some time", {
      status: 500,
    });
  }

  console.time("stream " + request.headers.get("x-vercel-id") || "local");

  return new Response(voice.body, {
    headers: {
      "X-Transcript": encodeURIComponent(transcript),
      "X-Response": encodeURIComponent(response),
    },
  });
}

function time() {
  return new Date().toLocaleString("en-US", {
    timeZone: headers().get("x-vercel-ip-timezone") || undefined,
  });
}

async function getTranscript(input: string | File) {
  if (typeof input === "string") return input;

  try {
    const { text } = await groq.audio.transcriptions.create({
      file: input,
      model: "whisper-large-v3",
    });

    return text.trim() || null;
  } catch {
    return null;
  }
}
