exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: event.body,
    });

    const data = await response.json();
    return {
      statusCode: response.status,
      body: JSON.stringify(data),
    };
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur interne du serveur." }),
    };
  }
};
