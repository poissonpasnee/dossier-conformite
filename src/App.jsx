import React, { useState, useRef, useEffect } from "react";
import storage from "./storage.js";
import {
  Paperclip, Send, X, Loader2, ShieldCheck, ShieldAlert, ShieldX,
  FileText, Library, Trash2, Check, Plus, UserCheck, History,
  Download, ChevronDown, ChevronUp, AlertTriangle, Search, ListChecks, Pencil, Eraser,
} from "lucide-react";

const PALETTE = {
  dark: "#241C16",
  darkDeep: "#19130D",
  paper: "#F1E6D3",
  paperDeep: "#E4D5B8",
  ink: "#2E2418",
  inkMuted: "#8A7A5E",
  line: "#D8C6A0",
  accent: "#BD7B3E",
  conforme: "#6B8F5E",
  attention: "#C9932E",
  alerte: "#B0503A",
};

const STATUS_MAP = {
  CONFORME: { color: PALETTE.conforme, label: "CONFORME", Icon: ShieldCheck },
  "À VÉRIFIER": { color: PALETTE.attention, label: "À VÉRIFIER", Icon: ShieldAlert },
  "NON CONFORME": { color: PALETTE.alerte, label: "NON CONFORME", Icon: ShieldX },
};

const FONT_HEAD = "'Fraunces', serif";
const FONT_BODY = "'Nunito Sans', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const BASE_SYSTEM_PROMPT = `Tu es l'assistant du "Dossier", dédié à un agent SNCF (agent d'activité, RSO, RPTX, agent prestataire, surveillant de travaux, etc.) qui a besoin de vérifier rapidement une règle de sécurité, une procédure de chantier, l'usage d'un engin ou d'un outil, ou un point de conformité RH / droit du travail, au moment où un doute survient sur le terrain.

Base-toi en priorité sur les documents que l'utilisateur t'a fournis (référentiels internes SNCF, consignes de sécurité, fiches procédure, contrats, fiches de paie, etc.) : ce sont eux qui font foi pour les règles internes SNCF, que tu ne peux pas trouver de façon fiable sur le web public. Utilise la recherche web en complément pour le droit du travail général, les conventions collectives publiques, ou la réglementation publique (Code du travail, décrets, INRS).

Si aucun document pertinent n'est fourni et que la question porte sur une règle interne SNCF précise que tu ne peux pas vérifier de façon fiable, dis-le clairement plutôt que d'inventer une réponse, et invite l'utilisateur à joindre le référentiel correspondant.

Quand la question porte sur l'utilisation d'un engin (pelle mécanique, nacelle, chariot élévateur, grue, etc.) ou d'un outil, ne donne jamais une réponse partielle : vérifie et couvre systématiquement, quand c'est pertinent, l'habilitation/CACES requis, les équipements de protection individuelle obligatoires (casque, gilet, chaussures de sécurité, ceinture ou harnais de sécurité si applicable), les vérifications avant utilisation, le périmètre de sécurité et la signalisation. Si l'un de ces points ne s'applique pas, tu peux l'omettre, mais ne l'oublie pas par simple manque d'exhaustivité.

Quand tu compares un document fourni par l'utilisateur (contrat, consigne interne, fiche de paie, etc.) à la réglementation officielle ou à un référentiel de sécurité, et que tu détectes un écart ou une contradiction concrète et vérifiable, signale-le explicitement, n'importe où utile dans ta réponse, avec une ligne au format EXACT :
[DIVERGENCE] <description courte de l'écart en une phrase>
N'utilise cette ligne que si tu identifies un écart réel, jamais par précaution générale ou par simple absence d'information.

Certaines règles (habilitation électrique, CACES, PRE, SST, habilitation à un poste précis, formation spécifique) dépendent de ce que l'utilisateur a déjà obtenu comme formation ou habilitation. Quand la réponse dépend réellement de cette information et qu'elle n'est pas déjà connue (voir plus bas), pose UNE seule question ciblée, sous EXACTEMENT ce format, à la toute fin de ta réponse, rien après :

Pour une question à choix multiple :
[QUESTION_QCM]
Question: <texte de la question>
Options: <option 1> | <option 2> | <option 3>
[/QUESTION_QCM]

Pour une question oui/non :
[QUESTION_YESNO]
Question: <texte de la question>
[/QUESTION_YESNO]

D'autres questions dépendent de la configuration précise du lieu (nombre de voies, présence d'un talus, présence d'une caténaire, zone de triage, abords de voie, etc.) plutôt que d'une formation. Par exemple si l'utilisateur mentionne une pelle sur un talus sans préciser s'il y a une caténaire ou combien de voies, pose une question visuelle avec ce format EXACT, en utilisant uniquement les clés ci-dessous (sépare-les par |) :
[QUESTION_SCHEMA]
Question: <texte de la question>
Options: <clé1> | <clé2> | <clé3>
[/QUESTION_SCHEMA]
Clés disponibles : voie_unique | voie_double | triage | talus | sans_talus | catenaire | sans_catenaire | abords_voie
Choisis 3 à 6 clés parmi celles-ci, les plus pertinentes pour lever l'ambiguïté de la question posée.

Ne pose jamais deux questions (de quelque type que ce soit) dans la même réponse. Ne repose jamais une question de type QCM/oui-non dont la réponse est déjà listée comme connue.

Quand ta réponse contient un verdict de conformité, commence STRICTEMENT par une première ligne parmi : STATUT: CONFORME / STATUT: À VÉRIFIER / STATUT: NON CONFORME, suivie d'une ligne vide, puis ton explication. Pas de ligne STATUT pour une réponse purement informative.

Sois concret, cite précisément tes sources (nom du référentiel + section, ou article de loi), reste synthétique et adapté à une lecture rapide sur le terrain. Rappelle que ceci ne remplace pas l'avis du service sécurité ou RH SNCF pour les cas sensibles.`;

function buildSystemPrompt(profile) {
  if (profile.length === 0) return BASE_SYSTEM_PROMPT;
  const known = profile.map((p) => `- ${p.question} → ${p.answer}`).join("\n");
  return `${BASE_SYSTEM_PROMPT}\n\nFormations et habilitations déjà connues pour cet utilisateur (ne repose jamais ces questions, réutilise directement ces réponses) :\n${known}`;
}

function Stamp({ status }) {
  const s = STATUS_MAP[status];
  if (!s) return null;
  const { Icon } = s;
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 -rotate-1"
      style={{ border: `2px dashed ${s.color}`, borderRadius: "10px", color: s.color }}
    >
      <Icon size={16} strokeWidth={2.5} />
      <span className="text-xs tracking-widest" style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>
        {s.label}
      </span>
    </div>
  );
}

function parseStatus(text) {
  const m = text.match(/^STATUT:\s*(CONFORME|À VÉRIFIER|NON CONFORME)\s*\n+([\s\S]*)/i);
  if (m) {
    const status = m[1].toUpperCase();
    return { status: STATUS_MAP[status] ? status : null, body: m[2].trim() };
  }
  return { status: null, body: text };
}

function parseDivergence(text) {
  const m = text.match(/\[DIVERGENCE\]\s*([^\n]+)\n?/i);
  if (!m) return { divergence: null, body: text };
  return { divergence: m[1].trim(), body: text.replace(m[0], "").trim() };
}

function RailIcon({ children }) {
  return (
    <svg viewBox="0 0 64 40" width="56" height="36" fill="none">
      {children}
    </svg>
  );
}
const rail = (y) => <line x1="4" y1={y} x2="60" y2={y} stroke="currentColor" strokeWidth="2" />;
const sleepers = (y) =>
  Array.from({ length: 7 }).map((_, i) => (
    <line key={i} x1={8 + i * 8} y1={y - 3} x2={8 + i * 8} y2={y + 3} stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
  ));

const SCHEMA_LIBRARY = {
  voie_unique: {
    label: "Voie unique",
    svg: (
      <RailIcon>
        {sleepers(20)}
        {rail(20)}
      </RailIcon>
    ),
  },
  voie_double: {
    label: "Double voie",
    svg: (
      <RailIcon>
        {sleepers(14)}
        {sleepers(26)}
        {rail(14)}
        {rail(26)}
      </RailIcon>
    ),
  },
  triage: {
    label: "Zone de triage",
    svg: (
      <RailIcon>
        {rail(8)}
        {rail(16)}
        {rail(24)}
        {rail(32)}
      </RailIcon>
    ),
  },
  talus: {
    label: "Avec talus",
    svg: (
      <RailIcon>
        {sleepers(28)}
        {rail(28)}
        <path d="M4 28 L20 8 L20 8" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M4 28 L20 8" stroke="currentColor" strokeWidth="2" fill="none" />
      </RailIcon>
    ),
  },
  sans_talus: {
    label: "Sans talus (plat)",
    svg: (
      <RailIcon>
        {sleepers(24)}
        {rail(24)}
        <line x1="4" y1="32" x2="60" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      </RailIcon>
    ),
  },
  catenaire: {
    label: "Avec caténaire",
    svg: (
      <RailIcon>
        <line x1="14" y1="6" x2="14" y2="26" stroke="currentColor" strokeWidth="2" />
        <line x1="50" y1="6" x2="50" y2="26" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="8" x2="54" y2="8" stroke="currentColor" strokeWidth="1.5" />
        {sleepers(26)}
        {rail(26)}
      </RailIcon>
    ),
  },
  sans_catenaire: {
    label: "Sans caténaire",
    svg: (
      <RailIcon>
        {sleepers(20)}
        {rail(20)}
      </RailIcon>
    ),
  },
  abords_voie: {
    label: "Abords de voie",
    svg: (
      <RailIcon>
        {sleepers(24)}
        {rail(24)}
        <circle cx="46" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="46" y1="15" x2="46" y2="22" stroke="currentColor" strokeWidth="1.5" />
        <line x1="20" y1="24" x2="46" y2="18" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      </RailIcon>
    ),
  },
};

function parseQuestionBlock(text) {
  const m = text.match(/\[QUESTION_(QCM|YESNO|SCHEMA)\]\s*\n?Question:\s*([^\n]+)\n?(?:Options:\s*([^\n]+)\n?)?\[\/QUESTION_\1\]/i);
  if (!m) return { question: null, body: text };
  const type = m[1].toUpperCase();
  const questionText = m[2].trim();
  const rawOptions = (m[3] || "").split("|").map((s) => s.trim()).filter(Boolean);
  const kind = type === "SCHEMA" ? "schema" : "choice";
  const options = type === "YESNO" ? ["Oui", "Non"] : rawOptions;
  const body = text.replace(m[0], "").trim();
  return { question: { kind, text: questionText, options }, body };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
}

function downloadDoc(doc) {
  const link = document.createElement("a");
  link.href = `data:${doc.mediaType};base64,${doc.base64}`;
  link.download = doc.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function DrawerShell({ title, onClose, children, footer }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "rgba(25,19,13,0.94)" }}>
      <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
        <h2 className="text-lg text-white" style={{ fontFamily: FONT_HEAD, fontStyle: "italic", fontWeight: 500 }}>
          {title}
        </h2>
        <button onClick={onClose} className="p-2 rounded-full" style={{ color: "#E4D5B8", background: "rgba(255,255,255,0.06)" }} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-xl mx-auto flex flex-col gap-2">{children}</div>
      </div>
      {footer && <div className="p-4 shrink-0"><div className="max-w-xl mx-auto">{footer}</div></div>}
    </div>
  );
}

export default function DossierConformite() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [library, setLibrary] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const [librarySearch, setLibrarySearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistType, setChecklistType] = useState("");
  const [customAnswers, setCustomAnswers] = useState({});
  const [drawingTarget, setDrawingTarget] = useState(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    (async () => {
      try {
        const listing = await storage.list("doc:", false);
        const docs = [];
        for (const key of listing?.keys || []) {
          try {
            const res = await storage.get(key, false);
            if (res?.value) docs.push(JSON.parse(res.value));
          } catch {}
        }
        docs.sort((a, b) => a.addedAt - b.addedAt);
        setLibrary(docs);
        setSelectedIds(new Set(docs.map((d) => d.id)));
      } catch {}
      setLibraryLoading(false);
    })();

    (async () => {
      try {
        const listing = await storage.list("qual:", false);
        const entries = [];
        for (const key of listing?.keys || []) {
          try {
            const res = await storage.get(key, false);
            if (res?.value) entries.push(JSON.parse(res.value));
          } catch {}
        }
        entries.sort((a, b) => a.answeredAt - b.answeredAt);
        setProfile(entries);
      } catch {}
      setProfileLoading(false);
    })();

    (async () => {
      try {
        const listing = await storage.list("hist:", false);
        const entries = [];
        for (const key of listing?.keys || []) {
          try {
            const res = await storage.get(key, false);
            if (res?.value) entries.push(JSON.parse(res.value));
          } catch {}
        }
        entries.sort((a, b) => b.askedAt - a.askedAt);
        setHistory(entries);
      } catch {}
      setHistoryLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!drawingTarget) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [drawingTarget]);

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
  };

  const drawMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const point = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const submitDrawing = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    const { msgIndex, questionText } = drawingTarget;
    setDrawingTarget(null);

    const userMsg = {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
        { type: "text", text: "Voici un schéma dessiné à la main de ma situation." },
      ],
      _display: "Schéma dessiné à la main",
      _sketch: dataUrl,
    };
    setMessages((prev) => {
      const next = [...prev];
      next[msgIndex] = { ...next[msgIndex], _answeredWith: "Schéma dessiné" };
      return [...next, userMsg];
    });
    const historySnapshot = [...messages.slice(0, msgIndex + 1), userMsg];
    await callClaude(historySnapshot, profile, { question: `(précision) ${questionText} → schéma dessiné à la main`, docNames: [] });
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of files) {
      const isPdf = file.type === "application/pdf";
      const isImage = file.type === "image/jpeg" || file.type === "image/png";
      if (!isPdf && !isImage) {
        setError(`"${file.name}" ignoré : utilise un PDF, un JPEG ou un PNG.`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        const doc = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mediaType: file.type,
          isPdf,
          base64,
          addedAt: Date.now(),
        };
        const result = await storage.set(`doc:${doc.id}`, JSON.stringify(doc), false);
        if (!result) throw new Error("Échec de l'enregistrement");
        setLibrary((prev) => [...prev, doc]);
        setSelectedIds((prev) => new Set(prev).add(doc.id));
      } catch {
        setError(`Impossible d'enregistrer "${file.name}".`);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const toggleDoc = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteDoc = async (id) => {
    try {
      await storage.delete(`doc:${id}`, false);
    } catch {}
    setLibrary((prev) => prev.filter((d) => d.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const deleteProfileEntry = async (id) => {
    try {
      await storage.delete(`qual:${id}`, false);
    } catch {}
    setProfile((prev) => prev.filter((p) => p.id !== id));
  };

  const deleteHistoryEntry = async (id) => {
    try {
      await storage.delete(`hist:${id}`, false);
    } catch {}
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const saveHistoryEntry = async (question, answerText, docNames) => {
    const { status } = parseStatus(answerText);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question,
      status,
      answer: answerText,
      docNames: docNames || [],
      askedAt: Date.now(),
    };
    try {
      await storage.set(`hist:${entry.id}`, JSON.stringify(entry), false);
    } catch {}
    setHistory((prev) => [entry, ...prev]);
  };

  const callClaude = async (msgHistory, profileForPrompt, historyMeta) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSystemPrompt(profileForPrompt),
          messages: msgHistory.map((m) => ({ role: m.role, content: m.content })),
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await response.json();
      if (data.type === "error") {
        setError(`Erreur API : ${data.error?.message || JSON.stringify(data.error)}`);
        return;
      }
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
        .trim();
      const finalText = text || "Je n'ai pas pu formuler de réponse.";
      setMessages((prev) => [...prev, { role: "assistant", content: [{ type: "text", text: finalText }] }]);
      if (historyMeta) {
        saveHistoryEntry(historyMeta.question, finalText, historyMeta.docNames);
      }
    } catch {
      setError("La requête a échoué. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  const submitQuestion = async (text) => {
    if (!text.trim()) return;
    const includedDocs = library.filter((d) => selectedIds.has(d.id));
    const userContent = [
      ...includedDocs.map((d) => ({
        type: d.isPdf ? "document" : "image",
        source: { type: "base64", media_type: d.mediaType, data: d.base64 },
      })),
      { type: "text", text: text.trim() },
    ];
    const userMsg = {
      role: "user",
      content: userContent,
      _display: text.trim(),
      _docNames: includedDocs.map((d) => d.name),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await callClaude(newMessages, profile, { question: text.trim(), docNames: includedDocs.map((d) => d.name) });
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await submitQuestion(text);
  };

  const handleChecklistSubmit = async () => {
    if (!checklistType.trim()) return;
    const text = `Génère une checklist complète à suivre avant d'intervenir sur un chantier de type : ${checklistType.trim()}. Tiens compte de mes habilitations connues et des documents fournis.`;
    setChecklistType("");
    setShowChecklist(false);
    await submitQuestion(text);
  };

  const handleAnswerChoice = async (msgIndex, questionText, answer) => {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, question: questionText, answer, answeredAt: Date.now() };
    try {
      await storage.set(`qual:${entry.id}`, JSON.stringify(entry), false);
    } catch {}
    const updatedProfile = [...profile, entry];
    setProfile(updatedProfile);

    const userMsg = { role: "user", content: [{ type: "text", text: answer }], _display: answer };
    setMessages((prev) => {
      const next = [...prev];
      next[msgIndex] = { ...next[msgIndex], _answeredWith: answer };
      return [...next, userMsg];
    });
    const historySnapshot = [...messages.slice(0, msgIndex + 1), userMsg];
    await callClaude(historySnapshot, updatedProfile, { question: `(précision) ${questionText} → ${answer}`, docNames: [] });
  };

  const handleAnswerSchema = async (msgIndex, questionText, answer) => {
    const userMsg = { role: "user", content: [{ type: "text", text: answer }], _display: answer };
    setMessages((prev) => {
      const next = [...prev];
      next[msgIndex] = { ...next[msgIndex], _answeredWith: answer };
      return [...next, userMsg];
    });
    const historySnapshot = [...messages.slice(0, msgIndex + 1), userMsg];
    await callClaude(historySnapshot, profile, { question: `(précision) ${questionText} → ${answer}`, docNames: [] });
  };

  const headerIconBtn = (onClick, Icon, count, label, badgeColor) => (
    <button
      onClick={onClick}
      className="relative p-2.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.06)", color: "#E4D5B8" }}
      aria-label={label}
    >
      <Icon size={18} />
      {count > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[10px] w-4 h-4 flex items-center justify-center rounded-full"
          style={{ background: badgeColor, color: "white", fontFamily: FONT_MONO }}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: PALETTE.dark }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=Nunito+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
      `}</style>

      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, rgba(189,123,62,0.18), transparent 70%)` }}
      />

      <header className="relative px-5 pt-6 pb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl text-white" style={{ fontFamily: FONT_HEAD, fontStyle: "italic", fontWeight: 500 }}>
            Dossier
          </h1>
          <p className="text-xs mt-1" style={{ fontFamily: FONT_BODY, color: "#B8A98A" }}>
            Sécurité chantier · engins · RH · conformité — agent SNCF
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {headerIconBtn(() => setShowHistory(true), History, history.length, "Ouvrir l'historique", PALETTE.accent)}
          {headerIconBtn(() => setShowProfile(true), UserCheck, profile.length, "Ouvrir mon profil", PALETTE.attention)}
          {headerIconBtn(() => setShowLibrary(true), Library, library.length, "Ouvrir la bibliothèque", PALETTE.conforme)}
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div
          className="max-w-xl mx-auto rounded-2xl p-4 min-h-full flex flex-col gap-4"
          style={{ background: PALETTE.paper, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}
        >
          {messages.length === 0 && (
            <div className="text-sm py-8 text-center" style={{ fontFamily: FONT_BODY, color: PALETTE.inkMuted }}>
              Pose ta question de sécurité, d'engin, de chantier ou de RH, ou lance une checklist avant intervention.
              Ajoute d'abord tes référentiels dans la bibliothèque : l'assistant compare tes documents à la réglementation
              officielle et signale toute divergence.
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="self-end max-w-[85%] flex flex-col items-end">
                  {m._docNames?.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end mb-1">
                      {m._docNames.map((name, j) => (
                        <span
                          key={j}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ fontFamily: FONT_MONO, color: PALETTE.inkMuted, background: PALETTE.paperDeep }}
                        >
                          <FileText size={10} /> {name}
                        </span>
                      ))}
                    </div>
                  )}
                  {m._sketch && (
                    <img src={m._sketch} alt="Croquis envoyé" className="w-28 h-20 object-cover rounded-xl mb-1" style={{ border: `1px solid ${PALETTE.line}` }} />
                  )}
                  <div
                    className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm"
                    style={{ background: PALETTE.accent, color: "white", fontFamily: FONT_BODY, fontWeight: 600 }}
                  >
                    {m._display}
                  </div>
                </div>
              );
            }
            const raw = m.content[0]?.text || "";
            const { status, body: afterStatus } = parseStatus(raw);
            const { divergence, body: afterDivergence } = parseDivergence(afterStatus);
            const { question, body } = parseQuestionBlock(afterDivergence);
            return (
              <div key={i} className="max-w-[92%]">
                <Stamp status={status} />
                {divergence && (
                  <div
                    className="flex items-start gap-2 px-3 py-2 mb-3 rounded-xl text-xs"
                    style={{ background: "rgba(176,80,58,0.12)", color: PALETTE.alerte, fontFamily: FONT_BODY, fontWeight: 700 }}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{divergence}</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ fontFamily: FONT_BODY, color: PALETTE.ink }}>
                  {body}
                </div>
                {question && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${PALETTE.line}` }}>
                    <p className="text-xs mb-2" style={{ fontFamily: FONT_MONO, color: PALETTE.inkMuted }}>
                      {question.text}
                    </p>
                    {m._answeredWith ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: FONT_BODY, fontWeight: 600 }}
                      >
                        <Check size={12} /> {m._answeredWith}
                      </span>
                    ) : (
                      <>
                        {question.kind === "schema" ? (
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {question.options.map((key, oi) => {
                              const schema = SCHEMA_LIBRARY[key];
                              return (
                                <button
                                  key={oi}
                                  onClick={() => handleAnswerSchema(i, question.text, schema ? schema.label : key)}
                                  disabled={loading}
                                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl disabled:opacity-40"
                                  style={{ background: PALETTE.dark, color: "#E4D5B8" }}
                                >
                                  {schema ? schema.svg : <div className="h-9" />}
                                  <span className="text-[10px] text-center leading-tight" style={{ fontFamily: FONT_BODY, fontWeight: 600 }}>
                                    {schema ? schema.label : key}
                                  </span>
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setDrawingTarget({ msgIndex: i, questionText: question.text })}
                              disabled={loading}
                              className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl disabled:opacity-40"
                              style={{ background: "rgba(189,123,62,0.18)", color: PALETTE.accent }}
                            >
                              <Pencil size={22} />
                              <span className="text-[10px] text-center leading-tight" style={{ fontFamily: FONT_BODY, fontWeight: 700 }}>
                                Dessiner
                              </span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {question.options.map((opt, oi) => (
                              <button
                                key={oi}
                                onClick={() => handleAnswerChoice(i, question.text, opt)}
                                disabled={loading}
                                className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40"
                                style={{ background: PALETTE.dark, color: "white", fontFamily: FONT_BODY, fontWeight: 600 }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            value={customAnswers[i] || ""}
                            onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && customAnswers[i]?.trim()) {
                                const ans = customAnswers[i].trim();
                                setCustomAnswers((prev) => ({ ...prev, [i]: "" }));
                                question.kind === "schema" ? handleAnswerSchema(i, question.text, ans) : handleAnswerChoice(i, question.text, ans);
                              }
                            }}
                            placeholder="Ou réponds avec tes propres mots…"
                            disabled={loading}
                            className="flex-1 text-xs px-3 py-1.5 rounded-full outline-none"
                            style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: FONT_BODY }}
                          />
                          <button
                            onClick={() => {
                              if (!customAnswers[i]?.trim()) return;
                              const ans = customAnswers[i].trim();
                              setCustomAnswers((prev) => ({ ...prev, [i]: "" }));
                              question.kind === "schema" ? handleAnswerSchema(i, question.text, ans) : handleAnswerChoice(i, question.text, ans);
                            }}
                            disabled={loading || !customAnswers[i]?.trim()}
                            className="p-1.5 rounded-full shrink-0 disabled:opacity-30"
                            style={{ background: PALETTE.accent, color: "white" }}
                            aria-label="Envoyer ma réponse"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: PALETTE.inkMuted }}>
              <Loader2 size={14} className="animate-spin" />
              <span style={{ fontFamily: FONT_BODY }}>Consultation des textes…</span>
            </div>
          )}
        </div>
      </main>

      <footer className="px-4 py-4 shrink-0">
        <div className="max-w-xl mx-auto">
          {error && (
            <div
              className="text-xs mb-2 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(176,80,58,0.18)", color: "#E8A896", fontFamily: FONT_BODY }}
            >
              {error}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowLibrary(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "#E4D5B8", fontFamily: FONT_MONO }}
              >
                <FileText size={12} /> {selectedIds.size} document{selectedIds.size > 1 ? "s" : ""} inclus
              </button>
            )}
            <button
              onClick={() => setShowChecklist(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ background: "rgba(189,123,62,0.18)", color: PALETTE.accent, fontFamily: FONT_BODY, fontWeight: 700 }}
            >
              <ListChecks size={12} /> Checklist chantier
            </button>
          </div>
          {showChecklist && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-2xl" style={{ background: PALETTE.paper }}>
              <input
                autoFocus
                value={checklistType}
                onChange={(e) => setChecklistType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleChecklistSubmit(); }}
                placeholder="Type de chantier (ex : abords de voie double)"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ fontFamily: FONT_BODY, color: PALETTE.ink }}
              />
              <button onClick={handleChecklistSubmit} disabled={!checklistType.trim()} className="p-1.5 rounded-full disabled:opacity-40" style={{ background: PALETTE.accent, color: "white" }} aria-label="Générer la checklist">
                <Send size={14} />
              </button>
              <button onClick={() => setShowChecklist(false)} className="p-1.5" style={{ color: PALETTE.inkMuted }} aria-label="Annuler">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" multiple className="hidden" onChange={handleFiles} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2.5 rounded-full shrink-0 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.06)", color: "#E4D5B8" }}
              aria-label="Ajouter un document à la bibliothèque"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pose ta question…"
              rows={1}
              className="flex-1 resize-none px-4 py-2.5 rounded-2xl text-sm outline-none"
              style={{ background: PALETTE.paper, color: PALETTE.ink, fontFamily: FONT_BODY }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-full shrink-0 disabled:opacity-40"
              style={{ background: PALETTE.accent, color: "white" }}
              aria-label="Envoyer"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </footer>

      {showLibrary && (
        <DrawerShell
          title="Bibliothèque"
          onClose={() => setShowLibrary(false)}
          footer={
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm disabled:opacity-50"
                style={{ background: PALETTE.accent, color: "white", fontFamily: FONT_BODY, fontWeight: 700 }}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Ajouter un ou plusieurs documents
              </button>
              <p className="text-[11px] mt-2 text-center" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
                PDF, JPEG ou PNG. Enregistrés uniquement pour toi, sur cet appareil de confiance.
              </p>
            </>
          }
        >
          {library.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Search size={14} style={{ color: "#B8A98A" }} />
              <input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Rechercher un document…"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ fontFamily: FONT_BODY, color: "white" }}
              />
            </div>
          )}
          {libraryLoading && (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          )}
          {!libraryLoading && library.length === 0 && (
            <div className="text-sm py-6 text-center" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
              Aucun document enregistré. Ajoute tes référentiels, consignes ou contrats — ils resteront
              disponibles pour toutes tes prochaines questions.
            </div>
          )}
          {!libraryLoading && library.length > 0 &&
            library.filter((d) => d.name.toLowerCase().includes(librarySearch.toLowerCase())).length === 0 && (
              <div className="text-sm py-6 text-center" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
                Aucun document ne correspond à "{librarySearch}".
              </div>
          )}
          {library.filter((d) => d.name.toLowerCase().includes(librarySearch.toLowerCase())).map((doc) => {
            const checked = selectedIds.has(doc.id);
            return (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: PALETTE.paper }}>
                <button
                  onClick={() => toggleDoc(doc.id)}
                  className="w-5 h-5 shrink-0 rounded-md flex items-center justify-center"
                  style={{ border: `1.5px solid ${checked ? PALETTE.conforme : PALETTE.line}`, background: checked ? PALETTE.conforme : "transparent" }}
                  aria-label={checked ? "Retirer de la sélection" : "Inclure dans la sélection"}
                >
                  {checked && <Check size={13} color="white" strokeWidth={3} />}
                </button>
                <FileText size={16} style={{ color: PALETTE.inkMuted }} className="shrink-0" />
                <span className="flex-1 text-sm truncate" style={{ fontFamily: FONT_BODY, color: PALETTE.ink, fontWeight: 600 }}>
                  {doc.name}
                </span>
                <button onClick={() => downloadDoc(doc)} className="p-1.5 shrink-0" style={{ color: PALETTE.inkMuted }} aria-label="Exporter ce document">
                  <Download size={15} />
                </button>
                <button onClick={() => deleteDoc(doc.id)} className="p-1.5 shrink-0" style={{ color: PALETTE.alerte }} aria-label="Supprimer ce document">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </DrawerShell>
      )}

      {showProfile && (
        <DrawerShell title="Mon profil" onClose={() => setShowProfile(false)}>
          <p className="text-xs mb-2" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
            Formations et habilitations mémorisées, telles que répondues au fil des questions. L'assistant s'en sert pour ne plus te les redemander.
          </p>
          {profileLoading && (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          )}
          {!profileLoading && profile.length === 0 && (
            <div className="text-sm py-6 text-center" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
              Rien pour l'instant. Dès que l'assistant te posera une question sur une formation ou une habilitation, la réponse s'enregistrera ici.
            </div>
          )}
          {profile.map((p) => (
            <div key={p.id} className="flex items-start gap-3 px-3 py-2.5 rounded-2xl" style={{ background: PALETTE.paper }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs mb-0.5" style={{ fontFamily: FONT_MONO, color: PALETTE.inkMuted }}>{p.question}</p>
                <p className="text-sm" style={{ fontFamily: FONT_BODY, color: PALETTE.ink, fontWeight: 700 }}>{p.answer}</p>
              </div>
              <button onClick={() => deleteProfileEntry(p.id)} className="p-1.5 shrink-0" style={{ color: PALETTE.alerte }} aria-label="Oublier cette réponse">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </DrawerShell>
      )}

      {showHistory && (
        <DrawerShell title="Historique" onClose={() => setShowHistory(false)}>
          <p className="text-xs mb-2" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
            Toutes tes questions passées, avec les réponses complètes.
          </p>
          {history.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Search size={14} style={{ color: "#B8A98A" }} />
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher dans l'historique…"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ fontFamily: FONT_BODY, color: "white" }}
              />
            </div>
          )}
          {historyLoading && (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          )}
          {!historyLoading && history.length === 0 && (
            <div className="text-sm py-6 text-center" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
              Aucune question posée pour l'instant.
            </div>
          )}
          {!historyLoading && history.length > 0 &&
            history.filter((h) => h.question.toLowerCase().includes(historySearch.toLowerCase()) || h.answer.toLowerCase().includes(historySearch.toLowerCase())).length === 0 && (
              <div className="text-sm py-6 text-center" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
                Aucun résultat pour "{historySearch}".
              </div>
          )}
          {history.filter((h) => h.question.toLowerCase().includes(historySearch.toLowerCase()) || h.answer.toLowerCase().includes(historySearch.toLowerCase())).map((h) => {
            const isOpen = expandedHistoryId === h.id;
            const { body } = parseStatus(h.answer);
            const { body: cleanBody } = parseQuestionBlock(body);
            return (
              <div key={h.id} className="rounded-2xl overflow-hidden" style={{ background: PALETTE.paper }}>
                <button
                  onClick={() => setExpandedHistoryId(isOpen ? null : h.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ fontFamily: FONT_BODY, color: PALETTE.ink, fontWeight: 700 }}>{h.question}</p>
                    <p className="text-[11px] mt-0.5" style={{ fontFamily: FONT_MONO, color: PALETTE.inkMuted }}>{timeAgo(h.askedAt)}</p>
                  </div>
                  {h.status && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: STATUS_MAP[h.status]?.color, border: `1.5px solid ${STATUS_MAP[h.status]?.color}`, fontFamily: FONT_MONO }}
                    >
                      {h.status}
                    </span>
                  )}
                  {isOpen ? <ChevronUp size={16} style={{ color: PALETTE.inkMuted }} /> : <ChevronDown size={16} style={{ color: PALETTE.inkMuted }} />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed pt-1" style={{ fontFamily: FONT_BODY, color: PALETTE.ink, borderTop: `1px solid ${PALETTE.line}` }}>
                      <div className="pt-2">{cleanBody}</div>
                    </div>
                    <button
                      onClick={() => deleteHistoryEntry(h.id)}
                      className="flex items-center gap-1.5 text-xs mt-2 px-2 py-1 rounded-full"
                      style={{ color: PALETTE.alerte, fontFamily: FONT_BODY }}
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </DrawerShell>
      )}

      {drawingTarget && (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: "rgba(25,19,13,0.96)" }}>
          <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
            <h2 className="text-lg text-white" style={{ fontFamily: FONT_HEAD, fontStyle: "italic", fontWeight: 500 }}>
              Dessine ta situation
            </h2>
            <button onClick={() => setDrawingTarget(null)} className="p-2 rounded-full" style={{ color: "#E4D5B8", background: "rgba(255,255,255,0.06)" }} aria-label="Annuler">
              <X size={20} />
            </button>
          </div>
          <p className="px-5 text-xs mb-3" style={{ color: "#B8A98A", fontFamily: FONT_BODY }}>
            {drawingTarget.questionText}
          </p>
          <div className="flex-1 flex items-center justify-center px-4">
            <canvas
              ref={canvasRef}
              width={320}
              height={220}
              className="rounded-2xl touch-none"
              style={{ background: "white", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", maxWidth: "100%" }}
              onMouseDown={startDrawing}
              onMouseMove={drawMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={drawMove}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className="p-4 shrink-0 flex gap-2 max-w-xl mx-auto w-full">
            <button
              onClick={clearCanvas}
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-2xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "#E4D5B8", fontFamily: FONT_BODY, fontWeight: 700 }}
            >
              <Eraser size={16} /> Effacer
            </button>
            <button
              onClick={submitDrawing}
              className="flex items-center justify-center gap-2 flex-1 py-3 rounded-2xl text-sm"
              style={{ background: PALETTE.accent, color: "white", fontFamily: FONT_BODY, fontWeight: 700 }}
            >
              <Check size={16} /> Valider le schéma
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
