"use client";

import { Message } from "@/components/Voice/type";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { usePlayer } from "@/hooks/usePlayer";
import { useMicVAD, utils } from "@ricky0123/vad-react";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<Message>>([]);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const player = usePlayer();

  const vad = useMicVAD({
    startOnLoad: true,
    onSpeechStart: () => setIsSpeaking(true),
    onSpeechEnd: (audio: Float32Array) => {
      setIsSpeaking(false);
      player.stop();
      const wav = utils.encodeWAV(audio);
      const blob = new Blob([wav], { type: "audio/wav" });
      handleSubmit(blob);
      const isFirefox = navigator.userAgent.includes("Firefox");
      if (isFirefox) vad.pause();
    },
    workletURL: "/vad.worklet.bundle.min.js",
    modelURL: "/silero_vad.onnx",
    positiveSpeechThreshold: 0.6,
    minSpeechFrames: 4,
    ortConfig(ort: {
      env: {
        wasm: {
          wasmPaths: {
            "ort-wasm-simd-threaded.wasm": string;
            "ort-wasm-simd.wasm": string;
            "ort-wasm.wasm": string;
            "ort-wasm-threaded.wasm": string;
          };
          numThreads: number;
        };
      };
    }) {
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );

      ort.env.wasm = {
        wasmPaths: {
          "ort-wasm-simd-threaded.wasm": "/ort-wasm-simd-threaded.wasm",
          "ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
          "ort-wasm.wasm": "/ort-wasm.wasm",
          "ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
        },
        numThreads: isSafari ? 1 : 4,
      };
    },
  });

  const handleSubmit = async (data: string | Blob) => {
    const formData = new FormData();

    if (typeof data === "string") {
      formData.append("input", data);
    } else {
      formData.append("input", data, "audio.wav");
    }

    for (const message of messages) {
      formData.append("message", JSON.stringify(message));
    }

    const submittedAt = Date.now();
    setLoading(true);
    const response = await fetch("/api/homie", {
      method: "POST",
      body: formData,
    });

    const transcript = decodeURIComponent(
      response.headers.get("X-Transcript") || ""
    );
    const text = decodeURIComponent(response.headers.get("X-Response") || "");

    if (!response.ok || !transcript || !text || !response.body) {
      if (response.status === 429) {
        toast.error("Too many requests. Please try again later.");
      } else {
        toast.error((await response.text()) || "An error occurred.");
      }

      setLoading(false);
      return;
    }

    const latency = Date.now() - submittedAt;
    player.play(response.body, () => {
      const isFirefox = navigator.userAgent.includes("Firefox");
      if (isFirefox) vad.start();
    });
    setInput(transcript);
    setLoading(false);

    setMessages((prevMessages) => [
      ...prevMessages.slice(-99),
      {
        role: "user",
        content: transcript,
      },
      {
        role: "assistant",
        content: text,
        latency,
      },
    ]);
  };

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit(input);
  }

  return (
    <main className="h-screen w-screen flex justify-center items-end  scrollbar-thin  overflow-auto ">
      <div
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-300 ease-in-out",
          {
            "opacity-0": !isSpeaking,
            "opacity-70": isSpeaking,
          }
        )}
      >
        <div className="absolute inset-0 border-[13px] border-gray-700  [box-shadow: inset 0px 0px 20px 20px #000] animate-pulse"></div>
      </div>
      <div className="flex justify-center items-center flex-col gap-4 sm:pb-20 ">
        <form
          className="rounded-full  w-[fit-content] bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center  border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
          onSubmit={handleFormSubmit}
        >
          <div className="p-4 w-[fit-content] text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white">
            {loading ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="56"
                height="56"
                fill="none"
                className="animate-spin "
              >
                <path
                  d="M18.001 20C16.3295 21.2558 14.2516 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 12.8634 21.8906 13.7011 21.6849 14.5003C21.4617 15.3673 20.5145 15.77 19.6699 15.4728C18.9519 15.2201 18.6221 14.3997 18.802 13.66C18.9314 13.1279 19 12.572 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19C13.3197 19 14.554 18.6348 15.6076 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="56"
                height="56"
                fill="none"
              >
                <path
                  d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M12 8V16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 10V14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 11V13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 10V14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 11V13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </form>
        <div className="text-neutral-400 m-4 dark:text-neutral-600 p-8 bg-white shadow-full rounded-3xl text-center max-w-xl text-balance  space-y-4">
          {messages.length > 0 && (
            <p>{messages[messages.length - 1].content}</p>
          )}

          {messages.length === 0 && (
            <>
              {vad.loading ? (
                <p>Loading speech detection...</p>
              ) : vad.errored ? (
                <p>Failed to load speech detection.</p>
              ) : (
                <p>Start talking to chat.</p>
              )}
            </>
          )}
        </div>
      </div>
      <div
        className={cn(
          "absolute size-36 blur-3xl rounded-full bg-gradient-to-b from-gray-200 to-slate-400 dark:from-gray-600 dark:to-slate-800 transition ease-in-out",
          {
            "opacity-0": vad.loading || vad.errored,
            "opacity-30":
              !vad.loading && !vad.errored && !isSpeaking && !loading,
            "opacity-100 scale-110": isSpeaking || loading,
          }
        )}
      />
    </main>
  );
}
