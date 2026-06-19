"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Square,
  Sparkles,
  Paperclip,
  ArrowUp,
  Search,
  Wrench,
  Eye,
  Braces,
  Lock,
  Copy,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Zap,
  RotateCcw,
  Volume2,
  Mic,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  MapPin,
  Moon,
  CloudSun,
  CloudMoon,
  Globe,
  ExternalLink,
  AlertCircle,
  Download,
  Check,
  Brain,
  FlaskConical,
  Plus,
  FileCode,
  Code,
  Play,
  Bot,
} from "lucide-react";
import type { Conversation, StoredMessage } from "@/app/page";
import { generateId } from "@/app/page";

// ---------- Suggestion chips ----------
const SUGGESTIONS = [
  { prompt: "Explain the theory of relativity simply" },
  { prompt: "Help me grade this student's essay" },
  { prompt: "How do I solve a quadratic equation?" },
  { prompt: "What is the weather in San Francisco?" },
];

// ---------- Mode Definitions ----------
const MODES = [
  { id: "text",  label: "GPT-5.5 Pro",   modelId: "openai/gpt-5.5",    description: "Latest text generation" },
  { id: "image", label: "GPT Image 2.0", modelId: "openai/dall-e-2",    description: "AI image creation" },
] as const;
type ModeId = typeof MODES[number]["id"];

// ---------- Mode Icon helpers ----------
function GptTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#10b981" />
      <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="1.5" fill="white" />
    </svg>
  );
}
function GptImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#8b5cf6" />
      <rect x="6" y="8" width="12" height="8" rx="2" stroke="white" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="1" fill="white" />
      <path d="M7 16l3-3 2 2 2-2 3 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
// Backward-compat stub to avoid breaking existing refs (now unused but kept for safety)
function ModelLogo({ name, className }: { name: string; className?: string }) {
  const isFallback = true; void isFallback; void name;
  return <GptTextIcon className={className} />;
}
function ModelLogoColored({ name, className }: { name: string; className?: string }) {
  void name;
  return <GptTextIcon className={className} />;
}
// End placeholder stubs — real UI uses GptTextIcon / GptImageIcon
function _placeholder_to_avoid_unused_warning() {
  return { ModelLogo, ModelLogoColored };
}
void _placeholder_to_avoid_unused_warning;

// ---------- was: ModelLogoColored end (lines removed) ----------
// Keep Weather Widget
function _separatorAfterLogos() {}
void _separatorAfterLogos;
function ModelLogoBrand({ name, className }: { name: string; className?: string }) {
  void name;
  return <GptTextIcon className={className} />;
}
void ModelLogoBrand;
// ---------- Weather Widget ----------
function getWeatherIcon(code: number, isDay: boolean) {
  if (code >= 1 && code <= 3) return isDay ? CloudSun : CloudMoon;
  if (code >= 45 && code <= 48) return Cloud;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return isDay ? Sun : Moon;
}

function WeatherWidget({ location }: { location: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) {
          setError(true); return;
        }
        const { latitude, longitude, name } = geoData.results[0];
        
        // Fetch current, hourly, and daily data with auto timezone
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`);
        const weatherData = await weatherRes.json();
        
        const currentTemp = Math.round(weatherData.current.temperature_2m);
        const currentCode = weatherData.current.weather_code;
        const isDay = weatherData.current.is_day === 1;

        const high = Math.round(weatherData.daily.temperature_2m_max[0]);
        const low = Math.round(weatherData.daily.temperature_2m_min[0]);
        
        // Formatting times
        const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const sunriseStr = formatTime(weatherData.daily.sunrise[0]);
        const sunsetStr = formatTime(weatherData.daily.sunset[0]);

        const dateStr = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

        // Hourly data (next 6 hours starting from current hour)
        const currentHourISO = weatherData.current.time;
        let currentIndex = weatherData.hourly.time.findIndex((t: string) => t >= currentHourISO);
        if (currentIndex === -1) currentIndex = 0;
        
        const hourly = [];
        for (let i = 0; i < 6; i++) {
          const idx = currentIndex + i;
          if (idx >= weatherData.hourly.time.length) break;
          const timeStr = new Date(weatherData.hourly.time[idx]).toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '');
          hourly.push({
            timeLabel: i === 0 ? "Now" : timeStr,
            temp: Math.round(weatherData.hourly.temperature_2m[idx]),
            code: weatherData.hourly.weather_code[idx],
            isDay: true, // simplified for hourly icons
          });
        }

        setData({
          name: location,
          currentTemp,
          currentCode,
          isDay,
          high,
          low,
          sunriseStr,
          sunsetStr,
          dateStr,
          hourly
        });
      } catch (e) {
        setError(true);
      }
    }
    fetchWeather();
  }, [location]);

  if (error) return null;

  if (!data) {
    return (
      <div className="flex flex-col gap-3 mt-2 mb-4">
        <div className="rounded-[24px] p-4 w-full max-w-[420px] bg-zinc-900/80 border border-white/[0.02] shadow-xl animate-pulse h-[220px]"></div>
        <div className="h-4 bg-zinc-800 rounded-xl w-3/4 max-w-[420px] animate-pulse"></div>
      </div>
    );
  }

  const MainIcon = getWeatherIcon(data.currentCode, data.isDay);

  // Generate dynamic conversational description
  let feeling = "pleasant";
  if (data.currentTemp >= 30) feeling = "hot";
  else if (data.currentTemp >= 25) feeling = "warm";
  else if (data.currentTemp < 10) feeling = "cold";
  else if (data.currentTemp < 18) feeling = "cool";

  const tempF = Math.round((data.currentTemp * 9/5) + 32);

  return (
    <div className="flex flex-col gap-3 mt-2 mb-4 font-sans whitespace-normal break-words">
      <div className="rounded-[24px] p-4 w-full max-w-[420px] bg-gradient-to-br from-[#6f3b97] to-[#3a225e] text-white shadow-xl transition-all duration-500">
        
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-semibold tracking-wide text-white/90 truncate max-w-[180px]">{data.name}</div>
            <div className="flex items-center gap-2 mt-2">
              <MainIcon size={36} className="text-white drop-shadow-md" strokeWidth={1.5} />
              <div className="text-[42px] font-light leading-none tracking-tight drop-shadow-md">
                {data.currentTemp}°<span className="text-2xl font-light text-white/80">C</span>
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col justify-between h-full">
            <div className="text-[11px] text-white/70 font-medium mb-4">{data.dateStr}</div>
            <div className="flex flex-col gap-0">
              <div className="text-[13px] font-semibold text-white/90">H: {data.high}°</div>
              <div className="text-[13px] text-white/70 font-medium">L: {data.low}°</div>
            </div>
          </div>
        </div>

        {/* Hourly Forecast */}
        <div className="mt-5 bg-white/[0.08] rounded-[16px] p-3 border border-white/[0.05]">
          <div className="text-[11px] font-semibold mb-2.5 text-white/80 ml-1">Hourly Forecast</div>
          <div className="flex justify-between items-center px-0.5">
            {data.hourly.map((hr: any, i: number) => {
              const HourlyIcon = getWeatherIcon(hr.code, true);
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="text-[10px] font-medium text-white/70 tracking-wide">{hr.timeLabel}</div>
                  <HourlyIcon size={18} className="text-white/90 drop-shadow-sm" strokeWidth={1.5} />
                  <div className="text-xs font-semibold text-white/95">{hr.temp}°</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 px-1 text-[10px] font-medium text-white/60 tracking-wide">
          <div>Sunrise: {data.sunriseStr}</div>
          <div>Sunset: {data.sunsetStr}</div>
        </div>
      </div>

      {/* Dynamic Description mimicking AI text */}
      <div className="text-[14px] leading-relaxed text-zinc-300 max-w-[420px]">
        The current weather in {data.name} is {feeling} with a temperature of {data.currentTemp}°C (about {tempF}°F). Today reached a high of {data.high}°C and will continue to be {feeling} throughout the week.
      </div>
    </div>
  );
}

// ---------- CodeBlock with Copy + Download ----------
function CodeBlock({ lang, ext, code, children }: { lang: string; ext: string; code: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-4 rounded-[20px] overflow-hidden bg-[#18181a] border border-zinc-800/40 p-4 shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 pl-1 pr-1">
        <div className="flex items-center gap-2 text-zinc-300">
          <FileCode size={16} strokeWidth={1.5} />
          <span className="text-[13px] font-bold uppercase tracking-wider">{lang}</span>
        </div>
        
        {/* Actions (pill shaped container) */}
        <div className="flex items-center gap-0.5 bg-[#262628] rounded-full p-1 text-zinc-400">
          <button
            title="View Code"
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#3f3f42] hover:text-zinc-200 transition-colors"
          >
            <Code size={15} strokeWidth={2} />
          </button>
          <button
            onClick={handleDownload}
            title={`Run / Download .${ext}`}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#3f3f42] hover:text-zinc-200 transition-colors"
          >
            <Play size={15} strokeWidth={2} className="ml-0.5" />
          </button>
          <button
            onClick={handleCopy}
            title="Copy code"
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#3f3f42] hover:text-zinc-200 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
          </button>
        </div>
      </div>
      
      {/* Code body */}
      <div className="overflow-x-auto px-1 pb-1">
        <div className="text-[14px] leading-[1.6] text-zinc-300 font-mono">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- FetchUrl Widget ----------
function FetchUrlWidget({
  url,
  reason,
  alreadyFetched,
  onFetchStart,
  onContent,
}: {
  url: string;
  reason?: string;
  alreadyFetched?: boolean;
  onFetchStart?: () => void;
  onContent: (text: string, url: string) => void;
}) {
  const [state, setState] = useState<"loading" | "done" | "error">(alreadyFetched ? "done" : "loading");
  const [siteTitle, setSiteTitle] = useState("");
  const [snippet, setSnippet] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const sentRef = useRef(alreadyFetched);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    if (onFetchStart) onFetchStart();

    async function doFetch() {
      try {
        const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!res.ok || data.error) {
          setErrorMsg(data.error ?? "Failed to fetch page");
          setState("error");
          return;
        }
        setSiteTitle(data.title || new URL(url).hostname);
        setSnippet(data.text.slice(0, 200).trim());
        setState("done");
        // Inject page content back into the AI conversation
        onContent(
          `[Web page content from ${url}]:\n\n${data.text}${data.truncated ? "\n\n[Content was truncated at 12,000 characters]" : ""}`,
          url
        );
      } catch (e: any) {
        setErrorMsg(e.message ?? "Network error");
        setState("error");
      }
    }
    doFetch();
  }, [url]);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 my-3 px-4 py-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 max-w-[420px] animate-pulse">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Globe size={14} className="text-blue-400 animate-spin" style={{ animationDuration: "2s" }} />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="text-[12px] font-medium text-zinc-400">Fetching page...</div>
          <div className="text-[11px] text-zinc-600 truncate">{url}</div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-3 my-3 px-4 py-3 rounded-2xl bg-red-950/20 border border-red-900/40 max-w-[420px]">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle size={14} className="text-red-400" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-[12px] font-medium text-red-400">Couldn't fetch page</div>
          <div className="text-[11px] text-zinc-500 truncate">{errorMsg}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 my-3 px-4 py-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/70 max-w-[420px]">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-0.5">
        <Globe size={14} className="text-blue-400" />
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-zinc-200 truncate">{siteTitle}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-zinc-600 hover:text-blue-400 transition-colors"
          >
            <ExternalLink size={11} />
          </a>
        </div>
        <div className="text-[11px] text-zinc-500 truncate">{url}</div>
        {snippet && (
          <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">{snippet}...</div>
        )}
        <div className="flex items-center gap-1 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-emerald-500 font-medium">Content loaded</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  fetchedUrlsRef,
  onWebContent,
}: {
  message: { role: string; content: string; id?: string };
  isStreaming?: boolean;
  fetchedUrlsRef: React.MutableRefObject<Set<string>>;
  onWebContent?: (text: string, url: string) => void;
}) {
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const isUser = message.role === "user";

  useEffect(() => {
    const d = new Date();
    const formatted = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }).format(d);
    // Transform "Jun 19, 2026, 5:47 PM" -> "Jun 19, 2026 • 5:47 PM"
    setTimestamp(formatted.replace(/,\s*(\d{1,2}:\d{2}\s*[AP]M)/, ' • $1'));
  }, []);

  if (isUser) {
    return (
      <div className="flex justify-end py-2">
        <div className="bg-[#2f2f2f] text-white px-5 py-2.5 rounded-3xl max-w-[75%] text-[15px] leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Parse <think>...</think> from the message
  let thought = "";
  let answer = message.content;
  const thinkStart = message.content.indexOf("<think>");
  if (thinkStart !== -1) {
    const thinkEnd = message.content.indexOf("</think>");
    if (thinkEnd !== -1) {
      thought = message.content.substring(thinkStart + 7, thinkEnd).trim();
      answer = message.content.substring(0, thinkStart) + message.content.substring(thinkEnd + 8);
    } else {
      thought = message.content.substring(thinkStart + 7).trim();
      answer = message.content.substring(0, thinkStart);
    }
  }

  // Auto-open thought while it's the only thing streaming
  useEffect(() => {
    if (isStreaming && thought && !answer) {
      setThoughtOpen(true);
    }
  }, [isStreaming, thought, answer]);

  answer = answer.trim();

  const markdownComponents = {
    h1({ children, ...props }: any) {
      return <h1 className="text-2xl font-bold mt-8 mb-4 text-zinc-100" {...props}>{children}</h1>;
    },
    h2({ children, ...props }: any) {
      return <h2 className="text-xl font-semibold mt-8 mb-3 text-zinc-100" {...props}>{children}</h2>;
    },
    h3({ children, ...props }: any) {
      return <h3 className="text-lg font-semibold mt-6 mb-3 text-zinc-200" {...props}>{children}</h3>;
    },
    h4({ children, ...props }: any) {
      return <h4 className="text-base font-semibold mt-4 mb-2 text-zinc-200" {...props}>{children}</h4>;
    },
    p({ children, ...props }: any) {
      return <p className="mb-4 whitespace-pre-line leading-relaxed" {...props}>{children}</p>;
    },
    ul({ children, ...props }: any) {
      return <ul className="list-disc pl-5 mb-4 space-y-1 marker:text-zinc-500" {...props}>{children}</ul>;
    },
    ol({ children, ...props }: any) {
      return <ol className="list-decimal pl-5 mb-4 space-y-1 marker:text-zinc-500" {...props}>{children}</ol>;
    },
    table({ children, ...props }: any) {
      return (
        <div className="overflow-x-auto my-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
          <table className="w-full text-sm text-left border-collapse" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }: any) {
      return <thead className="text-xs uppercase bg-zinc-800/50 text-zinc-400 border-b border-zinc-800/60" {...props}>{children}</thead>;
    },
    tbody({ children, ...props }: any) {
      return <tbody className="divide-y divide-zinc-800/50" {...props}>{children}</tbody>;
    },
    tr({ children, ...props }: any) {
      return <tr className="hover:bg-zinc-800/20 transition-colors" {...props}>{children}</tr>;
    },
    th({ children, ...props }: any) {
      return <th className="px-4 py-3 font-medium tracking-wider" {...props}>{children}</th>;
    },
    td({ children, ...props }: any) {
      return <td className="px-4 py-3 text-zinc-300 align-top" {...props}>{children}</td>;
    },
    a({ node, children, href, ...props }: any) {
      const text = String(children);
      if (text.startsWith("badge:")) {
        const label = text.replace("badge:", "").trim();
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 transition-colors no-underline align-middle shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>
            <span>{label}</span>
          </a>
        );
      }
      return (
        <a href={href} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 inline-flex items-center gap-0.5" target="_blank" rel="noopener noreferrer" {...props}>
          {children}
          {href?.startsWith("http") && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>}
        </a>
      );
    },
    hr({ node, ...props }: any) {
      return <hr className="my-6 border-t border-zinc-800" {...props} />;
    },
    pre({ node, children, ...props }: any) {
      const codeChild = node?.children?.[0];
      const className = codeChild?.properties?.className || [];
      const isWeather = Array.isArray(className)
        ? className.includes("language-weather")
        : typeof className === "string"
          ? className.includes("language-weather")
          : false;
      const isFetchUrl = Array.isArray(className)
        ? className.includes("language-fetch-url")
        : typeof className === "string"
          ? className.includes("language-fetch-url")
          : false;
      let isImplicitFetchUrl = false;
      if (!isFetchUrl && !isWeather && codeChild?.children?.[0]?.value) {
        const text = String(codeChild.children[0].value).trim();
        if (text.startsWith("{") && text.includes('"url"') && text.includes('"reason"')) {
           isImplicitFetchUrl = true;
        }
      }
      if (isWeather || isFetchUrl || isImplicitFetchUrl) return <>{children}</>;
      return <pre {...props}>{children}</pre>;
    },
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      // ---- Weather block ----
      if (!inline && match && match[1] === "weather") {
        const content = String(children).replace(/\n$/, "");
        let location = "";
        try { location = JSON.parse(content).location; } catch {
          const m = content.match(/"location"\s*:\s*"([^"]+)/);
          if (m) location = m[1];
        }
        if (location) return <WeatherWidget location={location} />;
        return (
          <div className="flex flex-col gap-3 mt-2 mb-4">
            <div className="rounded-[24px] p-4 w-full max-w-[420px] bg-zinc-800/40 border border-white/[0.05] shadow-sm animate-pulse h-[220px]"></div>
          </div>
        );
      }
      // ---- Fetch-URL block ----
      const contentStr = String(children).replace(/\n$/, "");
      const isExplicitFetchUrl = !inline && match && match[1] === "fetch-url";
      const isImplicitFetchUrl = !inline && contentStr.trim().startsWith("{") && contentStr.includes('"url"') && contentStr.includes('"reason"');

      if (isExplicitFetchUrl || isImplicitFetchUrl) {
        let url = ""; let reason = "";
        try {
          const parsed = JSON.parse(contentStr);
          url = parsed.url ?? ""; reason = parsed.reason ?? "";
        } catch {
          const m = contentStr.match(/"url"\s*:\s*"([^"]+)/);
          if (m) url = m[1];
        }
        if (url) {
          const alreadyFetched = fetchedUrlsRef.current.has(url);
          return (
            <FetchUrlWidget
              url={url}
              reason={reason}
              alreadyFetched={alreadyFetched}
              onFetchStart={() => fetchedUrlsRef.current.add(url)}
              onContent={onWebContent ?? (() => {})}
            />
          );
        }
        if (isExplicitFetchUrl) return null;
      }
      // ---- Regular code block with copy + download ----
      if (!inline && match) {
        const lang = match[1];
        const code = String(children).replace(/\n$/, "");
        const extMap: Record<string, string> = {
          javascript: "js", typescript: "ts", python: "py", html: "html",
          css: "css", json: "json", bash: "sh", shell: "sh", sh: "sh",
          jsx: "jsx", tsx: "tsx", java: "java", c: "c", cpp: "cpp",
          rust: "rs", go: "go", ruby: "rb", php: "php", swift: "swift",
          kotlin: "kt", sql: "sql", yaml: "yaml", markdown: "md", xml: "xml",
        };
        const ext = extMap[lang] ?? lang;
        return (
          <CodeBlock lang={lang} ext={ext} code={code}>
            <code className={className} {...props}>{children}</code>
          </CodeBlock>
        );
      }
      return <code className={className} {...props}>{children}</code>;
    }
  };

  return (
    <div className="group py-5 px-1">
      {/* Agent name header */}
      <div className="flex items-center justify-between mb-4 w-full pl-1">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-[22px] h-[22px] bg-zinc-200 text-zinc-900 flex items-center justify-center shadow-sm"
            style={{ clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" }}
          >
            <Bot size={13} fill="currentColor" strokeWidth={2} />
          </div>
          <span className="text-[14.5px] font-semibold text-zinc-200 tracking-wide">Gnim AI Assistant</span>
          <span className="text-[13px] text-zinc-500 ml-1 tracking-wide">{timestamp}</span>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => navigator.clipboard.writeText(answer)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 hover:bg-zinc-800/60 rounded-md" 
            title="Copy Message"
          >
            <Copy size={15} />
          </button>
        </div>
      </div>

      {/* Reasoning / Thought block */}
      {thought && (
        <div className="mb-4 pl-1">
          <div
            onClick={() => setThoughtOpen(!thoughtOpen)}
            className="flex items-center gap-2.5 text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors w-fit select-none group/toggle"
          >
            <div className="w-[11px] h-[11px] rounded-full bg-[#E91E63]" />
            <span className="text-[14.5px] font-medium tracking-wide">Thinking...</span>
          </div>
          {thoughtOpen && (
            <div className="mt-3 ml-[5px] pl-4 border-l-2 border-zinc-800/80">
              <p className="text-[14px] leading-relaxed text-zinc-400 whitespace-pre-wrap font-medium italic">
                {thought}
                {isStreaming && !answer && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500 ml-1.5 animate-pulse align-middle" />
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main answer */}
      {(answer || !isStreaming) && (
        <div className="text-[15px] leading-relaxed text-zinc-200">
          {answer && answer.startsWith("[GENERATED_IMAGE]:") ? (
            <div>
              <img
                src={answer.split("\n")[0].replace("[GENERATED_IMAGE]:", "").trim()}
                alt="AI generated image"
                className="rounded-xl max-w-full max-h-[480px] object-contain border border-zinc-800 shadow-xl"
                onError={(e) => { (e.target as HTMLImageElement).alt = "Image failed to load"; }}
              />
              {answer.includes("\n\n") && (
                <p className="mt-2 text-sm text-zinc-400 italic">
                  {answer.split("\n\n").slice(1).join("\n\n").replace(/\*/g, "")}
                </p>
              )}
            </div>
          ) : (
            <div>
              {answer ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {answer}
                </ReactMarkdown>
              ) : (
                !isStreaming && thought && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {thought}
                  </ReactMarkdown>
                )
              )}
              {isStreaming && answer && (
                <span className="inline-block w-2 h-2 rounded-full bg-zinc-400 ml-1 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Still streaming indicator when neither thought nor answer exist yet */}
      {isStreaming && !thought && !answer && (
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-zinc-400 animate-pulse mt-2" />
      )}

      {/* Actions */}
      {!isStreaming && (
        <div className="flex items-center gap-2 mt-4 text-zinc-500 border-t border-zinc-800/50 pt-3">
          <button className="p-1.5 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors rounded-md" title="Copy">
            <Copy size={14} />
          </button>
          <button className="p-1.5 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors rounded-md" title="Good response">
            <ThumbsUp size={14} />
          </button>
          <button className="p-1.5 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors rounded-md" title="Bad response">
            <ThumbsDown size={14} />
          </button>
          {/* Token Usage Badge */}
          <div className="ml-auto flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-zinc-600 select-none">
            <Zap size={11} className="text-zinc-600" />
            <span>~{Math.ceil(message.content.length / 4)} tokens</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Thinking / Searching Indicator ----------
function ThinkingIndicator({ text = "Thinking" }: { text?: string }) {
  return (
    <div className="flex justify-center items-center py-6 w-full">
      <div className="text-[14px] text-[#a3a3a3] font-medium tracking-wide animate-pulse">
        {text}
      </div>
    </div>
  );
}

// ---------- Rate Limit ----------
const RATE_LIMIT_MAX = 100;

function useRateLimit() {
  const [state, setState] = useState({
    count: 0,
    windowStart: Date.now(),
    remaining: RATE_LIMIT_MAX,
    isLimited: false,
    resetLabel: "3h"
  });

  // Sync state from server
  const sync = async () => {
    try {
      const res = await fetch("/api/rate-limit");
      if (res.ok) {
        const data = await res.json();
        setState({
          count: data.count,
          windowStart: data.windowStart,
          remaining: data.remaining,
          isLimited: data.isLimited,
          resetLabel: data.resetLabel
        });
      }
    } catch {
      // Ignore network errors to avoid breaking the chat UI
    }
  };

  useEffect(() => {
    sync();
  }, []);

  const increment = () => {
    // Optimistic local update, server actually enforces it
    setState((prev) => {
      const nextCount = prev.count + 1;
      const nextRemaining = Math.max(0, prev.remaining - 1);
      return {
        ...prev,
        count: nextCount,
        remaining: nextRemaining,
        isLimited: nextRemaining === 0
      };
    });
    // Kick off a sync to get the true server state
    sync();
  };

  return { 
    remaining: state.remaining, 
    isLimited: state.isLimited, 
    increment, 
    resetLabel: state.resetLabel, 
    count: state.count 
  };
}

// ---------- Props ----------
type Props = {
  conversation: Conversation | null;
  onUpdate: (convo: Conversation) => void;
};

// ---------- ChatWindow ----------
export default function ChatWindow({ conversation, onUpdate }: Props) {
  const fetchedUrlsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const capDropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMode, setSelectedMode] = useState<ModeId>("text");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [capabilitiesDropdownOpen, setCapabilitiesDropdownOpen] = useState(false);
  // legacy compat
  const selectedModel = selectedMode === "text" ? "GPT-5.5 Pro" : "GPT Image 2.0";
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  

  const [isRecording, setIsRecording] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<StoredMessage[]>(
    (conversation?.messages ?? []) as StoredMessage[]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<{ file: File; preview: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { remaining, isLimited, increment, resetLabel } = useRateLimit();

  const convoId = conversation?.id ?? generateId();

  // Sync messages when conversation changes
  useEffect(() => {
    setMessages((conversation?.messages ?? []) as StoredMessage[]);
    setError(null);
  }, [conversation?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
  }, [messages, isLoading]);

  // Click outside model and capabilities dropdowns to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (capDropdownRef.current && !capDropdownRef.current.contains(event.target as Node)) {
        setCapabilitiesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set dragging to false if we are leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = typeof ev.target?.result === "string" ? ev.target.result : "";
        setStagedFile({ file, preview });
      };
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
  };

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = typeof ev.target?.result === "string" ? ev.target.result : "";
        setStagedFile({ file, preview });
      };
      // Read as text for text-based files, as dataURL for images
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  // Record click handler
  const handleRecordClick = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? prev + " " + transcript : transcript));
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      
      recognition.start();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  const sendMessage = async (userText: string, attachmentUrl?: string) => {
    if (!userText.trim() || isLoading || isLimited) return;
    increment();

    setError(null);

    const userMsg: StoredMessage = {
      id: generateId(),
      role: "user",
      content: userText.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const selectedModelId = selectedMode === "image" ? "openai/dall-e-2" : "openai/gpt-5.5";

    // Optimistic title save
    const title =
      conversation?.title && conversation.title !== "New Chat"
        ? conversation.title
        : userMsg.content.slice(0, 50).trim();
    onUpdate({ id: convoId, title, createdAt: conversation?.createdAt ?? Date.now(), messages: newMessages });

    // Create a placeholder assistant message for streaming
    const assistantId = generateId();
    const assistantPlaceholder: StoredMessage = { id: assistantId, role: "assistant", content: "" };
    setMessages([...newMessages, assistantPlaceholder]);

    // ---- IMAGE GENERATION MODE ----
    if (selectedMode === "image") {
      setImageGenerating(true);
      setIsLoading(true);
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userText.trim() }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Image generation failed");
        const imageMsg = `[GENERATED_IMAGE]:${data.url}\n\n*Generated image for: "${userText.trim()}"*`;
        const finalMessages: StoredMessage[] = [
          ...newMessages,
          { id: assistantId, role: "assistant", content: imageMsg },
        ];
        setMessages(finalMessages);
        onUpdate({ id: convoId, title, createdAt: conversation?.createdAt ?? Date.now(), messages: finalMessages });
      } catch (err: any) {
        setError(err.message || "Image generation failed");
        setMessages(newMessages);
      } finally {
        setImageGenerating(false);
        setIsLoading(false);
      }
      return;
    }
    // ---- END IMAGE GENERATION MODE ----
    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          modelName: selectedModel,
          messages: newMessages.map((m) => {
            if (m.id === userMsg.id && attachmentUrl) {
              return {
                role: m.role,
                content: [
                  { type: "text", text: m.content },
                  { type: "image", image: attachmentUrl }
                ]
              };
            }
            return { role: m.role, content: m.content };
          }),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Request failed with status ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Update the assistant message in-place as text streams in
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
      }

      // Final save with completed message
      const finalMessages: StoredMessage[] = [
        ...newMessages,
        { id: assistantId, role: "assistant", content: accumulated },
      ];
      onUpdate({ id: convoId, title, createdAt: conversation?.createdAt ?? Date.now(), messages: finalMessages });
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User stopped — keep whatever was streamed
      } else {
        setError(err.message || "An unexpected error occurred.");
        // Remove placeholder on hard error
        setMessages(newMessages);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e as any);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !stagedFile) return;

    let finalInput = input.trim();
    let attachmentUrl: string | undefined = undefined;

    if (stagedFile) {
      const { file, preview } = stagedFile;
      if (file.type.startsWith("image/")) {
        finalInput = finalInput ? `[Attached image: ${file.name}]\n\n${finalInput}` : `[Attached image: ${file.name}]`;
        attachmentUrl = preview;
      } else {
        const truncated = preview.length > 15000 ? preview.slice(0, 15000) + "\n\n[File truncated — too large to show fully]" : preview;
        finalInput = finalInput ? `[Attached file: ${file.name}]\n\nHere is its content:\n\n\`\`\`\n${truncated}\n\`\`\`\n\n${finalInput}` : `[Attached file: ${file.name}]\n\nHere is its content:\n\n\`\`\`\n${truncated}\n\`\`\``;
      }
      setStagedFile(null);
    }
    
    setInput("");
    if (finalInput.trim() || attachmentUrl) {
      sendMessage(finalInput, attachmentUrl);
    }
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // no-op: filteredModels removed (mode-based selector now)
  void selectedModel; // used in legacy badge

  const showEmpty = messages.length === 0;
  const lastMessage = messages[messages.length - 1];
  const showThinking = isLoading && lastMessage?.role === "user";

  // Injects content silently into the conversation as a "tool" message,
  // then re-sends to the AI without creating a visible user message bubble.
  const handleWebContent = async (text: string, url: string) => {
    const selectedModelId = selectedMode === "image" ? "openai/dall-e-2" : "openai/gpt-5.5";

    // Build the current messages + the injected web content as a user message
    // (invisible to the UI — never added to `messages` state directly)
    const currentMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    const injected = [
      ...currentMessages,
      {
        role: "system" as const,
        content: `[SYSTEM LOG - TOOL EXECUTION COMPLETE]\nThe web page content for ${url} has been successfully fetched. Here is the raw content:\n\n${text}${text.length >= 19000 ? "\n\n[Content was truncated]" : ""}\n\nCRITICAL INSTRUCTION: DO NOT output another \`fetch-url\` block for this URL. You already have the data. Proceed directly to analyzing this content and answering the user's request.`,
      },
    ];

    // Create a placeholder assistant message
    const assistantId = generateId();
    const assistantPlaceholder: StoredMessage = { id: assistantId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantPlaceholder]);
    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          modelName: selectedModel,
          messages: injected,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Request failed with status ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        );
      }

      // Save final state to conversation history (no new user bubble)
      const title =
        conversation?.title && conversation.title !== "New Chat"
          ? conversation.title
          : messages[0]?.content?.slice(0, 50).trim() ?? "New Chat";
      const finalMessages: StoredMessage[] = [
        ...messages,
        { id: assistantId, role: "assistant", content: accumulated },
      ];
      onUpdate({ id: convoId, title, createdAt: conversation?.createdAt ?? Date.now(), messages: finalMessages });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(err.message || "Failed to process web content.");
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  // Helper: format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div 
      className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-blue-500/50 m-4 rounded-3xl transition-all pointer-events-none">
          <div className="flex flex-col items-center gap-4 bg-zinc-900/90 px-8 py-6 rounded-2xl shadow-2xl border border-zinc-800">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-bounce">
              <Paperclip size={32} className="text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-1">Drop file here</h3>
              <p className="text-sm text-zinc-400">Attach a file or image to your message</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[866px] mx-auto w-full px-4 py-6">
          {showEmpty ? (
            /* Welcome / empty state */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-12 pt-12">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  What can I help with?
                </h2>
                <p className="text-zinc-500 font-medium text-sm">
                  Ask a question, write code, or explore ideas.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-2xl mt-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.prompt}
                    onClick={() => handleSuggestion(s.prompt)}
                    className="flex items-center justify-center p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 text-center cursor-pointer group"
                  >
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                      {s.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <MessageBubble 
                  key={m.id} 
                  message={m} 
                  fetchedUrlsRef={fetchedUrlsRef}
                  isStreaming={isLoading && i === messages.length - 1 && m.role === "assistant"}
                  onWebContent={handleWebContent}
                />
              ))}
              {showThinking && <ThinkingIndicator text={deepResearchEnabled ? "Deep researching" : webSearchEnabled ? "Searching the web" : "Thinking"} />}

              {/* Error Message Display */}
              {error && (
                <div className="flex gap-3 items-start py-1">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-950 border border-red-900 flex items-center justify-center text-red-500">
                    !
                  </div>
                  <div className="relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-red-950/30 border border-red-900/50 text-red-400 rounded-tl-sm">
                    <p className="font-semibold mb-1">Error</p>
                    <p className="whitespace-pre-wrap text-xs">{error}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pb-6 pt-2">
        <div className="max-w-[866px] mx-auto">

          {/* ===== LIMIT REACHED BANNER ===== */}
          {isLimited && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-zinc-700/60 bg-[#1c1c1c] shadow-2xl">
              <div className="flex items-start gap-4 px-5 py-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white mb-1">You've reached your free limit</p>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">
                    You can send <span className="text-white font-medium">500 messages</span> every 3 hours to keep things fair for everyone.
                    Your limit resets in <span className="text-orange-400 font-semibold">{resetLabel}</span>.
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-[3px] bg-zinc-800">
                <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 w-full" />
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit}>
            <div className={`relative flex flex-col bg-[#212121] border border-[#333333] rounded-[26px] p-3 transition-all duration-200 shadow-md ${
              isLimited
                ? "opacity-60 pointer-events-none"
                : "focus-within:bg-[#2a2a2a] focus-within:border-[#444]"
            }`}>

              {/* Hidden file input */}
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />

              {/* Staged File Preview */}
              {stagedFile && (
                <div className="mb-3 relative group w-[72px] h-[72px] rounded-xl border border-zinc-700/50 bg-[#1c1c1e] overflow-hidden shadow-sm">
                  {stagedFile.file.type.startsWith("image/") ? (
                    <img 
                      src={stagedFile.preview} 
                      alt="preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/40 text-blue-400">
                      <Paperclip size={24} />
                      <span className="text-[9px] mt-1 text-zinc-400 truncate w-full px-1 text-center">{stagedFile.file.name.split('.').pop()?.toUpperCase()}</span>
                    </div>
                  )}
                  {/* Remove Button */}
                  <button 
                    type="button"
                    onClick={() => setStagedFile(null)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-700 text-zinc-200 rounded-full flex items-center justify-center text-[10px] shadow-md border border-zinc-600 hover:bg-zinc-600 transition-colors z-10"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              )}

              {/* Textarea for input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={isLimited ? "Message limit reached — check back later..." : "Ask anything..."}
                disabled={isLimited}
                rows={1}
                className="w-full bg-transparent resize-none outline-none text-[15px] text-white placeholder-[#777] leading-relaxed min-h-[52px] max-h-[200px] px-2 py-2"
              />

              {/* Action bar on the bottom */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <Paperclip size={16} />
                  </button>
                </div>

                {/* Send/Stop Button + remaining counter */}
                <div className="flex-shrink-0 flex items-center gap-2">

                  {/* Remaining messages pill — show when <= 5 left and not limited */}
                  {!isLimited && remaining <= 5 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[11px] font-medium mr-2">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {remaining} left
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleRecordClick}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isRecording 
                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse" 
                        : "bg-transparent text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
                    }`}
                  >
                    <Mic size={16} />
                  </button>

                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Square size={10} className="text-white fill-white" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() || isLimited}
                      className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 cursor-pointer"
                    >
                      <ArrowUp size={14} className={input.trim() && !isLimited ? "text-white" : "text-zinc-600"} />
                    </button>
                  )}
                </div>
              </div>

            </div>
          </form>
          <p className="text-center text-xs text-zinc-700 mt-3">
            Responses generated by AI. Double-check important information.
          </p>
        </div>
      </div>
    </div>
  );
}
