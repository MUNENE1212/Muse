import { ChatGroq } from "npm:@langchain/groq";
import { PromptTemplate } from "npm:@langchain/core/prompts";
import { StructuredOutputParser } from "npm:@langchain/core/output_parsers";
import { z } from "npm:zod";

function getGroqAPIKey(): string {
  const key = Deno.env.get("GROQ_API_KEY") || "";
  if (!key || key === "placeholder-not-set") {
    throw new Error("GROQ_API_KEY is not configured in the environment.");
  }
  return key;
}

// Lazy initialization function
function getModel() {
  return new ChatGroq({
    apiKey: getGroqAPIKey(),
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
  });
}

// Define the blueprint structure we expect from the AI
const blueprintSchema = z.object({
  theme: z.string().describe("The overarching theme connecting the artifacts"),
  summary: z.string().describe("A concise summary of the synthesized insights"),
  socratic_questions: z
    .array(z.string())
    .describe("2-3 deep, provocative questions generated from the synthesis"),
});

const parser = StructuredOutputParser.fromZodSchema(blueprintSchema);

const synthesisPrompt = new PromptTemplate({
  template:
    `You are the Muse AI Synthesis Engine. Your purpose is to analyze a collection of unstructured artifacts (notes, web clips, concepts) and extract a cohesive "Thread Blueprint."

Find the hidden connections, underlying themes, and profound questions hidden within this chaos.

Artifacts:
{artifacts_text}

{format_instructions}
`,
  inputVariables: ["artifacts_text"],
  partialVariables: { format_instructions: parser.getFormatInstructions() },
});

export async function synthesizeArtifacts(
  artifacts: Record<string, unknown>[],
) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured in the environment.");
  }

  // Combine artifacts into a readable text chunk
  const artifactsText = artifacts
    .map((art, index) => {
      const data = art.unstructured_data as Record<string, unknown> | undefined;
      const content = data
        ? (data.raw_text as string | undefined) ?? JSON.stringify(data)
        : "";
      return `Artifact ${index + 1} (${art.type}):\n${content}`;
    })
    .join("\n\n");

  const promptValue = await synthesisPrompt.format({
    artifacts_text: artifactsText,
  });

  // Call Groq via LangChain
  const response = await getModel().invoke(promptValue);

  // Parse the structured JSON output
  try {
    const parsedBlueprint = await parser.parse(response.content.toString());
    return parsedBlueprint;
  } catch (error) {
    console.error("Failed to parse AI output:", error);
    throw new Error("The AI failed to generate a valid blueprint structure.");
  }
}

const socraticPrompt = new PromptTemplate({
  template: `You are the Muse AI Synthesis Engine, acting as a Socratic guide. 
Your goal is to prompt deep introspection and unearth hidden themes.
The user ({user_name}) has just written a thought in their journal.
Here is what they wrote:
"{recent_text}"

Here is some related context from their digital vault:
{context_text}

Generate ONE powerful, thought-provoking Socratic question that:
1. Directly addresses the user's thought.
2. Challenges their assumptions or asks them to explore the underlying "why".
3. Keeps it concise (1-2 sentences maximum).
4. Do NOT include any intro text like "Here is a question:" or quotation marks. Just output the question itself.
`,
  inputVariables: ["user_name", "recent_text", "context_text"],
});

export async function generateDynamicSocraticQuestion(
  userName: string,
  recentText: string,
  contextItems: { title: string; note?: string }[],
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured in the environment.");
  }

  const contextText = contextItems.length > 0
    ? contextItems.map((item) => `- ${item.title}: ${item.note || ""}`).join(
      "\n",
    )
    : "No relevant context found.";

  const promptValue = await socraticPrompt.format({
    user_name: userName || "Traveler",
    recent_text: recentText,
    context_text: contextText,
  });

  const response = await getModel().invoke(promptValue);
  let question = response.content.toString().trim();

  // Clean up any stray quotes if the AI included them
  if (question.startsWith('"') && question.endsWith('"')) {
    question = question.slice(1, -1);
  }

  return question;
}
