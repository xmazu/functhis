export const AGENT_PROMPT = `Help me create my first Functhis function in this TypeScript project.

First, install the Functhis authoring skill in this project:
\`npx skills add xmazu/functhis@functhis-function-authoring -y\`

Then read and follow the installed \`functhis-function-authoring\` skill.

Start with one small, useful function. If its purpose is not clear from the project, ask me what I want it to do. Then:
1. Add the function in the right place for this project.
2. Give it a typed object input and clear JSDoc so agents know when and how to use it.
3. Run it locally with a realistic example and fix any errors.
4. Show me what you created and the command to publish it.

Do not publish or connect MCP until I ask.`;

export const DOCS_HREF = 'https://github.com/xmazu/functhis';
