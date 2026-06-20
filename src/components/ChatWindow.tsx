"use client";

import React, { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
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

// ---------- CodeBlock with Syntax Highlighting + Copy + Download ----------
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

  // Custom VS Code / Tokyo Night inspired theme override
  const tokyoNight = {
    ...atomOneDark,
    'hljs': { ...atomOneDark['hljs'], background: '#0d1117', color: '#c9d1d9' },
    'hljs-keyword': { color: '#ff7b72' },
    'hljs-built_in': { color: '#ffa657' },
    'hljs-type': { color: '#79c0ff' },
    'hljs-literal': { color: '#79c0ff' },
    'hljs-number': { color: '#79c0ff' },
    'hljs-string': { color: '#a5d6ff' },
    'hljs-meta': { color: '#a5d6ff' },
    'hljs-regexp': { color: '#a5d6ff' },
    'hljs-symbol': { color: '#a5d6ff' },
    'hljs-title': { color: '#d2a8ff', fontWeight: 'bold' },
    'hljs-function': { color: '#d2a8ff' },
    'hljs-attr': { color: '#79c0ff' },
    'hljs-attribute': { color: '#79c0ff' },
    'hljs-variable': { color: '#c9d1d9' },
    'hljs-params': { color: '#c9d1d9' },
    'hljs-comment': { color: '#6e7681', fontStyle: 'italic' },
    'hljs-doctag': { color: '#ff7b72' },
    'hljs-tag': { color: '#7ee787' },
    'hljs-name': { color: '#7ee787' },
    'hljs-selector-tag': { color: '#7ee787' },
    'hljs-selector-class': { color: '#ffa657' },
    'hljs-selector-id': { color: '#ffa657' },
    'hljs-operator': { color: '#ff7b72' },
    'hljs-punctuation': { color: '#c9d1d9' },
    'hljs-property': { color: '#79c0ff' },
    'hljs-class': { color: '#f0db4f' },
    'hljs-template-variable': { color: '#a5d6ff' },
  };

  return (
    <div className="my-5 rounded-[16px] overflow-hidden border border-[#30363d] shadow-xl" style={{ background: '#0d1117' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d]" style={{ background: '#161b22' }}>
        <div className="flex items-center gap-2">
          {/* Colored dots like macOS/VS Code */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[12px] font-mono font-semibold text-[#8b949e] ml-2 uppercase tracking-widest">{lang}</span>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            title={`Download .${ext}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors font-mono"
          >
            <Download size={13} strokeWidth={2} />
            <span>Download</span>
          </button>
          <button
            onClick={handleCopy}
            title="Copy code"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors font-mono"
          >
            {copied ? (
              <><Check size={13} className="text-green-400" strokeWidth={2.5} /><span className="text-green-400">Copied!</span></>
            ) : (
              <><Copy size={13} strokeWidth={2} /><span>Copy</span></>
            )}
          </button>
        </div>
      </div>
      
      {/* Syntax Highlighted Code */}
      <SyntaxHighlighter
        language={lang}
        style={tokyoNight}
        showLineNumbers
        lineNumberStyle={{ color: '#484f58', fontSize: '12px', minWidth: '2.5em', paddingRight: '1em', userSelect: 'none' }}
        customStyle={{
          margin: 0,
          padding: '16px 20px',
          fontSize: '13.5px',
          lineHeight: '1.7',
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          background: '#0d1117',
          overflowX: 'auto',
        }}
        codeTagProps={{ style: { fontFamily: 'inherit' } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// Global cache to avoid duplicate requests across remounts
const globalImageCache = new Map<string, string>();

// ---------- Generate Image Widget ----------
function GenerateImageWidget({
  prompt,
}: {
  prompt: string;
}) {
  const [retryCount, setRetryCount] = useState(0);

  const [state, setState] = useState<"loading" | "done" | "error">(globalImageCache.has(prompt) ? "done" : "loading");
  const [imageUrl, setImageUrl] = useState<string>(globalImageCache.get(prompt) || "");
  const [errorMsg, setErrorMsg] = useState("");
  const sentRef = useRef(globalImageCache.has(prompt));

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    async function doGenerate() {
      try {
        const res = await fetch(`/api/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setErrorMsg(data.error ?? "Failed to generate image");
          setState("error");
          return;
        }
        globalImageCache.set(prompt, data.url);
        setImageUrl(data.url);
        setState("done");
      } catch (e: any) {
        setErrorMsg(e.message ?? "Network error");
        setState("error");
      }
    }
    doGenerate();
  }, [prompt, retryCount]);

  const handleRetry = () => {
    setState("loading");
    setRetryCount(c => c + 1);
    sentRef.current = false; // allow useEffect to fire again
  };

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3 mt-2 mb-4">
        <div className="rounded-xl p-6 w-full max-w-[480px] bg-zinc-900/60 border border-zinc-800/70 shadow-sm flex flex-col items-center justify-center min-h-[240px]">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
          <div className="text-[13px] font-medium text-zinc-300">
            {retryCount > 0 ? `Retrying... (${retryCount})` : "Generating image..."}
          </div>
          <div className="text-[11px] text-zinc-500 mt-2 text-center max-w-[80%] truncate">"{prompt}"</div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-start gap-3 my-3 px-4 py-3 rounded-2xl bg-red-900/20 border border-red-500/20 max-w-[420px]">
        <div className="text-red-400 mt-0.5">⚠️</div>
        <div className="flex flex-col min-w-0 w-full">
          <div className="text-[13px] font-semibold text-red-400">Failed to generate image</div>
          <div className="text-[12px] text-red-400/80 mt-0.5 mb-2">{errorMsg || "Image service unavailable or overloaded."}</div>
          <button 
            onClick={handleRetry}
            className="self-start text-[11px] font-medium px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <img
        src={imageUrl}
        alt={prompt}
        title={prompt}
        className="rounded-xl max-w-full max-h-[480px] object-contain border border-zinc-800 shadow-xl"
        onError={(e) => {
          setState("error");
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="text-[11px] text-zinc-600 mt-1.5 italic truncate">"{prompt}"</div>
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

const MessageBubble = React.memo(function MessageBubble({
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
    // Parse out file/image attachment metadata from the content
    let displayText = message.content;
    let attachedFileName: string | null = null;
    let attachedFileIsImage = false;

    const fileMatch = message.content.match(/^\[Attached file: (.+?)\]/);
    const imageMatch = message.content.match(/^\[Attached image: (.+?)\]/);

    if (fileMatch) {
      attachedFileName = fileMatch[1];
      // Strip the injected raw file content block (which is wrapped in backticks) and show only the user's actual prompt
      displayText = message.content.replace(/^\[Attached file: .+?\][\s\S]*?```[\s\S]*?```\n*/, "").trim();
    } else if (imageMatch) {
      attachedFileName = imageMatch[1];
      attachedFileIsImage = true;
      displayText = message.content.replace(/^\[Attached image: .+?\]\n?\n?/, "").trim();
    }

    // Get file extension icon color
    const getFileColor = (name: string) => {
      const ext = name.split(".").pop()?.toLowerCase() || "";
      if (["pdf"].includes(ext)) return { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", icon: "📄" };
      if (["docx", "doc"].includes(ext)) return { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400", icon: "📝" };
      if (["xlsx", "xls", "csv", "tsv"].includes(ext)) return { bg: "bg-green-500/15", border: "border-green-500/30", text: "text-green-400", icon: "📊" };
      if (["pptx", "ppt"].includes(ext)) return { bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400", icon: "📎" };
      if (["json", "yaml", "toml", "xml"].includes(ext)) return { bg: "bg-yellow-500/15", border: "border-yellow-500/30", text: "text-yellow-400", icon: "🗂️" };
      if (["js", "ts", "tsx", "jsx", "py", "go", "rs", "java", "cs", "php", "html", "css", "sql"].includes(ext)) return { bg: "bg-purple-500/15", border: "border-purple-500/30", text: "text-purple-400", icon: "💻" };
      if (["md", "txt", "rtf"].includes(ext)) return { bg: "bg-zinc-500/15", border: "border-zinc-500/30", text: "text-zinc-400", icon: "📃" };
      if (["log"].includes(ext)) return { bg: "bg-zinc-500/15", border: "border-zinc-500/30", text: "text-zinc-400", icon: "🗒️" };
      if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-400", icon: "🖼️" };
      return { bg: "bg-zinc-500/15", border: "border-zinc-500/30", text: "text-zinc-400", icon: "📁" };
    };

    const fileStyle = attachedFileName ? getFileColor(attachedFileName) : null;

    return (
      <div className="flex justify-end py-2">
        <div className="flex flex-col items-end gap-2 max-w-[85%] md:max-w-[75%]">
          {attachedFileName && (
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border ${fileStyle!.bg} ${fileStyle!.border} w-full`}>
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${fileStyle!.bg} ${fileStyle!.border} border flex items-center justify-center text-lg`}>
                {attachedFileIsImage ? "🖼️" : fileStyle!.icon}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-[13px] font-semibold ${fileStyle!.text} truncate`}>{attachedFileName}</span>
                <span className="text-[11px] text-zinc-500">{attachedFileIsImage ? "Image" : "File"} attached • parsed by AI</span>
              </div>
              <div className="flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            </div>
          )}
          {displayText && (
            <div className="bg-[#2f2f2f] text-white px-5 py-2.5 rounded-3xl text-[15px] leading-relaxed">
              <p className="whitespace-pre-wrap">{displayText}</p>
            </div>
          )}
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
      const isGenerateImage = Array.isArray(className)
        ? className.includes("language-generate-image") || className.includes("language-generate")
        : typeof className === "string"
          ? className.includes("language-generate-image") || className.includes("language-generate")
          : false;
      if (isWeather || isFetchUrl || isGenerateImage) return <>{children}</>;
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

      // Only explicit fetch-url blocks are rendered as widgets (no implicit JSON matching)
      if (isExplicitFetchUrl) {
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
        return null;
      }
      // ---- Generate-Image block ----
      const isGenerateImage = !inline && match && (match[1] === "generate-image" || match[1] === "generate");
      if (isGenerateImage) {
        let promptStr = "";
        try {
          const parsed = JSON.parse(contentStr);
          promptStr = parsed.prompt ?? "";
        } catch {
          const m = contentStr.match(/"prompt"\s*:\s*"([^"]+)/);
          if (m) promptStr = m[1];
        }
        if (promptStr) {
          return <GenerateImageWidget prompt={promptStr} />;
        }
        return null;
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

      {/* Reasoning / Thought block */}
      {thought && (
        <div className="mb-4 pl-1">
          <div
            onClick={() => setThoughtOpen(!thoughtOpen)}
            className="flex items-center gap-2 text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors w-fit select-none"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-zinc-400 shrink-0">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[13px] text-zinc-400 font-medium">Thinking...</span>
          </div>
          {thoughtOpen && (
            <div className="mt-3 ml-[5px] pl-4 border-l-2 border-zinc-800/80">
              <p className="text-[13px] leading-relaxed text-zinc-500 whitespace-pre-wrap italic">
                {thought}
                {isStreaming && !answer && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-600 ml-1.5 animate-pulse align-middle" />
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
}, (prevProps, nextProps) => {
  // Only re-render if the message content, role, or streaming status changes.
  // This prevents all messages from re-rendering on every keystroke in the input box.
  return (
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.isStreaming === nextProps.isStreaming
  );
});

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
  const [stagedFiles, setStagedFiles] = useState<{ file: File; preview: string }[]>([]);
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

  const processFile = async (file: File) => {
    setError(null);
    const isImage = file.type.startsWith("image/");
    
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = typeof ev.target?.result === "string" ? ev.target.result : "";
        setStagedFiles(p => [...p, { file, preview }]);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // For non-images, parse via backend to support PDFs, DOCX, etc.
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-file", {
        method: "POST",
        body: formData,
      });
      
      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok) throw new Error(data.error || "Failed to parse file");
      
      setStagedFiles(p => [...p, { file, preview: data.text }]);
    } catch (err: any) {
      setError(err.message || "Failed to parse file");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(processFile);
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

  const sendMessage = async (userText: string, attachmentUrls?: string[]) => {
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
            if (m.id === userMsg.id && attachmentUrls && attachmentUrls.length > 0) {
              return {
                role: m.role,
                content: [
                  { type: "text", text: m.content },
                  ...attachmentUrls.map(url => ({ type: "image", image: url }))
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
    if (!input.trim() && stagedFiles.length === 0) return;

    let finalInput = input.trim();
    let attachmentUrls: string[] = [];

    if (stagedFiles.length > 0) {
      let filesText = "";
      for (const sf of stagedFiles) {
        const { file, preview } = sf;
        if (file.type.startsWith("image/")) {
          filesText += `[Attached image: ${file.name}]\n\n`;
          attachmentUrls.push(preview);
        } else {
          const truncated = preview.length > 15000 ? preview.slice(0, 15000) + "\n\n[File truncated — too large to show fully]" : preview;
          filesText += `[Attached file: ${file.name}]\n\nHere is its content:\n\n\`\`\`\n${truncated}\n\`\`\`\n\n`;
        }
      }
      finalInput = finalInput ? `${filesText}${finalInput}` : filesText.trim();
      setStagedFiles([]);
    }
    
    setInput("");
    if (finalInput.trim() || attachmentUrls.length > 0) {
      sendMessage(finalInput, attachmentUrls);
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
        <div className="max-w-[866px] mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
          {showEmpty ? (
            /* Welcome / empty state */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-8 sm:gap-12 pt-8 sm:pt-12">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                  What can I help with?
                </h2>
                <p className="text-zinc-500 font-medium text-sm">
                  Ask a question, write code, or explore ideas.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-4 px-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.prompt}
                    onClick={() => handleSuggestion(s.prompt)}
                    className="flex items-center justify-center p-3 sm:p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 text-center cursor-pointer group"
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

      <div className="flex-shrink-0 px-2 sm:px-4 pb-4 sm:pb-6 pt-2">
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
                multiple
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />

              {/* Staged File Previews */}
              {stagedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {stagedFiles.map((sf, idx) => (
                    <div key={idx} className="relative group w-[72px] h-[72px] rounded-xl border border-zinc-700/50 bg-[#1c1c1e] overflow-hidden shadow-sm">
                      {sf.file.type.startsWith("image/") ? (
                        <img 
                          src={sf.preview} 
                          alt="preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/40 text-blue-400">
                          <Paperclip size={24} />
                          <span className="text-[9px] mt-1 text-zinc-400 truncate w-full px-1 text-center">{sf.file.name.split('.').pop()?.toUpperCase()}</span>
                        </div>
                      )}
                      {/* Remove Button */}
                      <button 
                        type="button"
                        onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-5 h-5 bg-zinc-700/80 text-zinc-200 rounded-full flex items-center justify-center text-[10px] shadow-md border border-zinc-600 hover:bg-zinc-600 transition-colors z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 backdrop-blur-sm"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  ))}
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
                className="w-full bg-transparent resize-none outline-none text-[14px] sm:text-[15px] text-white placeholder-[#777] leading-relaxed min-h-[44px] sm:min-h-[52px] max-h-[200px] px-2 py-2"
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
