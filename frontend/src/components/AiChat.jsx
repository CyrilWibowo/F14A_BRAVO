import { useEffect, useRef, useState } from 'react';
import './AiChat.css';

// ── Canned responses ──────────────────────────────────────────────────────────

const RULES = [
  {
    keys: ['hot', 'warm', 'tropical', 'heat', 'humid', 'sun', 'sunny'],
    reply: "For a warm, sunny climate I'd point you towards **Thailand** 🇹🇭, **Mexico** 🇲🇽, or **Greece** 🇬🇷. All three score well on liveability and have great year-round temperatures. Try the Tropical or Mediterranean preset on the left to see how they stack up in the ranking.",
  },
  {
    keys: ['cold', 'cool', 'nordic', 'snow', 'winter', 'northern', 'iceland', 'scandinavia'],
    reply: "Cooler climates tend to pair with high quality of life. **Iceland** 🇮🇸, **Norway** 🇳🇴, and **Finland** 🇫🇮 are hard to beat — low crime, clean air, and excellent infrastructure. Switch the sidebar to the Cool preset to see them rise in the rankings.",
  },
  {
    keys: ['safe', 'safety', 'crime', 'secure', 'peaceful', 'low crime'],
    reply: "Safety is captured in the QoL score here. The safest countries in the dataset are consistently **Iceland** 🇮🇸, **Japan** 🇯🇵, and **Singapore** 🇸🇬 — all with exceptionally low homicide rates. Crank the QoL weight up on the sidebar to make safety matter more in the scores.",
  },
  {
    keys: ['cheap', 'affordable', 'budget', 'cost', 'inexpensive', 'money', 'value'],
    reply: "Affordability-wise, **Vietnam** 🇻🇳, **Indonesia** 🇮🇩, and **Colombia** 🇨🇴 offer great value while still scoring decently on climate. There's an Affordability toggle at the bottom of the sidebar — flip it on and those countries jump up the ranking noticeably.",
  },
  {
    keys: ['beach', 'ocean', 'sea', 'coast', 'island', 'coastal', 'diving'],
    reply: "For coastal living I really like **Portugal** 🇵🇹, **New Zealand** 🇳🇿, and the **Philippines** 🇵🇭. Portugal is probably the sweet spot — mild climate, Atlantic coast, relatively affordable, and a high safety score. Try matching Portugal's climate using the search at the top of the sidebar.",
  },
  {
    keys: ['mediterranean', 'europe', 'european', 'spain', 'italy', 'france', 'portugal'],
    reply: "Southern Europe is popular for good reason. **Spain** 🇪🇸, **Italy** 🇮🇹, and **Portugal** 🇵🇹 all score well. Portugal tends to edge ahead on affordability. Apply the Mediterranean preset and filter the ranking — those three should be near the top.",
  },
  {
    keys: ['asia', 'asian', 'southeast', 'japan', 'korea', 'singapore'],
    reply: "Asia is incredibly diverse climatically. **Japan** 🇯🇵 and **South Korea** 🇰🇷 lead on QoL and safety, while **Singapore** 🇸🇬 is a standout for infrastructure and liveability. For lower cost of living, **Vietnam** 🇻🇳 or **Thailand** 🇹🇭 are worth exploring.",
  },
  {
    keys: ['family', 'kids', 'children', 'school', 'education'],
    reply: "Families tend to prioritise safety, sanitation, and internet access — all part of the QoL score here. Top picks would be **Denmark** 🇩🇰, **Netherlands** 🇳🇱, and **Japan** 🇯🇵. I'd suggest increasing the QoL weight on the sidebar so those factors drive the ranking more.",
  },
  {
    keys: ['retire', 'retirement', 'pension', 'expat'],
    reply: "Classic retirement destinations for expats include **Portugal** 🇵🇹 (NHR tax regime), **Mexico** 🇲🇽 (affordable, warm), and **Malaysia** 🇲🇾 (MM2H programme). For a scoring perspective, try enabling the Affordability toggle and boosting QoL weight — that combination tends to surface these countries.",
  },
  {
    keys: ['rain', 'wet', 'rainforest', 'humidity', 'monsoon', 'precipitation'],
    reply: "If you don't mind rain, **Colombia** 🇨🇴, **Costa Rica** 🇨🇷, and **New Zealand** 🇳🇿 are lush and green year-round. Set Precipitation to Wet in the sidebar and those countries will be scored more favourably. Costa Rica in particular is a surprising performer.",
  },
  {
    keys: ['dry', 'desert', 'arid', 'low rain', 'no rain'],
    reply: "Dry climate fans should look at **Morocco** 🇲🇦, **Australia** 🇦🇺 (inland areas), or the **UAE** 🇦🇪. The Desert preset is a good starting point — it weights low precipitation and high wind tolerance which suits these regions.",
  },
  {
    keys: ['best', 'top', 'rank', 'number one', '#1', 'highest', 'recommend'],
    reply: "With default settings, the top-ranked countries tend to be **New Zealand** 🇳🇿, **Iceland** 🇮🇸, and **Switzerland** 🇨🇭 — strong on climate comfort, safety, and HDI. That said, \"best\" is very personal. Tell me more about what matters to you and I can narrow it down.",
  },
  {
    keys: ['work', 'remote', 'digital nomad', 'internet', 'wifi', 'tech'],
    reply: "For remote workers, internet reliability is key — that feeds directly into the QoL score here. **Estonia** 🇪🇪, **South Korea** 🇰🇷, and **Singapore** 🇸🇬 have the fastest and most reliable connectivity in the dataset. Time zone also matters of course, which isn't captured here.",
  },
  {
    keys: ['health', 'healthcare', 'hospital', 'medical'],
    reply: "Healthcare quality correlates strongly with HDI in this dataset. **Japan** 🇯🇵, **Switzerland** 🇨🇭, and **Netherlands** 🇳🇱 consistently top healthcare rankings globally and score well here on QoL. Boost the QoL weight and they'll reflect that in the liveability score.",
  },
  {
    keys: ['australia', 'new zealand', 'oceania', 'pacific'],
    reply: "**Australia** 🇦🇺 and **New Zealand** 🇳🇿 are two of the strongest all-rounders in the entire dataset — high safety, good climate diversity, and strong HDI scores. New Zealand edges out on peacefulness; Australia wins on sunshine hours and affordability relative to Western Europe.",
  },
];

const FALLBACKS = [
  "That's an interesting question! Can you tell me more about what kind of climate or lifestyle you're after? I can compare countries across temperature, humidity, rainfall, safety, and cost of living.",
  "I'd love to help narrow that down. Are you thinking more about climate comfort, quality of life indicators, or something else? The more you tell me, the better I can point you in the right direction.",
  "Good question. The countries in this dataset vary a lot on that front. Could you give me a bit more context — warm or cool climate, coastal or inland, safety-focused or affordability-focused?",
  "Hmm, let me think about that. It really depends on how you weight the different factors. What matters most to you — temperature, safety, cost of living, or something else?",
];

let fallbackIdx = 0;

const getReply = (text) => {
  const lower = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keys.some((k) => lower.includes(k))) return rule.reply;
  }
  return FALLBACKS[fallbackIdx++ % FALLBACKS.length];
};

// ── Markdown-lite renderer ────────────────────────────────────────────────────

const renderText = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p,
  );
};

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="chat-msg bot">
      <div className="chat-avatar-sm" />
      <div className="chat-bubble chat-bubble-bot typing-bubble">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

// ── Initial greeting ──────────────────────────────────────────────────────────

const GREETING = "Hi! I'm **Atlas**, your AI country advisor 🌍\n\nTell me what you're looking for — warm weather, low cost of living, great safety, coastal vibes — and I'll point you to the best matches in the ranking.";

// ── Main component ────────────────────────────────────────────────────────────

function AiChat() {
  const [messages, setMessages] = useState([
    { role: 'bot', text: GREETING, id: 0 },
  ]);
  const [input, setInput]     = useState('');
  const [typing, setTyping]   = useState(false);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);
  const nextId                = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg = { role: 'user', text, id: nextId.current++ };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setTyping(true);

    const delay = 900 + Math.random() * 800;
    setTimeout(() => {
      const reply = getReply(text);
      setMessages((m) => [...m, { role: 'bot', text: reply, id: nextId.current++ }]);
      setTyping(false);
    }, delay);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-avatar">
          <svg viewBox="0 0 24 24" fill="none" className="chat-header-icon">
            <circle cx="12" cy="12" r="10" fill="#2d6a2d" />
            <path d="M8 12h8M12 8l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">Atlas AI</span>
          <span className="chat-header-status">
            <span className="chat-status-dot" />
            online
          </span>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.role}`}>
            {msg.role === 'bot' && <div className="chat-avatar-sm" />}
            <div className={`chat-bubble chat-bubble-${msg.role}`}>
              {msg.text.split('\n\n').map((para, i) => (
                <p key={i}>{renderText(para)}</p>
              ))}
            </div>
          </div>
        ))}
        {typing && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          placeholder="Ask about a country…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={typing}
        />
        <button className="chat-send-btn" onClick={send} disabled={!input.trim() || typing}>
          <svg viewBox="0 0 20 20" fill="none" className="chat-send-icon">
            <path d="M17 10L3 3l3 7-3 7 14-7z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default AiChat;
