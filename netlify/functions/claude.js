exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);

    // Convert Anthropic message format → OpenAI format (used by Groq)
    const messages = [];
    if (body.system) {
      messages.push({ role: "system", content: body.system });
    }
    for (const msg of body.messages || []) {
      const blocks = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
      const parts = blocks
        .map((b) => {
          if (b.type === "text") return { type: "text", text: b.text };
          if (b.type === "image") return { type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } };
          return null; // PDFs non supportés par Groq — ignorés silencieusement
        })
        .filter(Boolean);
      messages.push({ role: msg.role, content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: body.max_tokens || 1000,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", JSON.stringify(data));
      return {
        statusCode: response.status,
        body: JSON.stringify({ type: "error", error: data.error || data }),
      };
    }

    // Convert OpenAI response → Anthropic format (attendu par App.jsx)
    const text = data.choices?.[0]?.message?.content || "";
    return {
      statusCode: 200,
      body: JSON.stringify({ content: [{ type: "text", text }] }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur interne du serveur." }),
    };
  }
};
