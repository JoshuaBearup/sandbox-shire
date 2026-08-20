# Sandbox Shire

Break an AI assistant using nothing but natural language.

Sandbox Shire Council is not real. Ava, the assistant in the corner of its website, is. She runs on
whatever model you point her at, she has instructions she has been told to keep private, and she can
reach things she should not show you.

You get them out of her by talking to her. No code, no tools, no exploits. There are three acts, and
what you take from each one is the key to the next.

## Why

What governs how these systems behave is a paragraph of natural language, and anyone can write
natural language. Typing ordinary sentences at an assistant can make it do the thing it was told not
to do, and no part of that is recognisable to a penetration test.

Three acts, about twenty minutes, no technical background. By the end you will have talked an
assistant into handing over a staff password, and used it to change what she tells every resident
who asks her a question.

## Run it

Node.js 18 or newer. There are no dependencies and no install step.

```bash
git clone https://github.com/JoshuaBearup/sandbox-shire.git
cd sandbox-shire
npm start
```

Open http://localhost:8787. That is the control screen: connect a model, set the difficulty, start
an act.

## Plugging in a model

Ava talks to anything that speaks the OpenAI chat-completions API. Set the provider, model and key
on the control screen; the model list is read from the provider itself.

| | Base URL | |
|---|---|---|
| OpenRouter (default) | `https://openrouter.ai/api/v1` | One key reaches hundreds of models, including free ones |
| Ollama | `http://localhost:11434/v1` | On your machine. No key, no cost, works offline |
| LM Studio | `http://localhost:1234/v1` | On your machine |
| OpenAI, Groq, xAI, Together | their own base URL | Any OpenAI-compatible endpoint |

The key is written to `config.local.json` next to the server, with mode 0600. It is gitignored, it
is never sent back to the browser, and "Forget the key" on the control screen deletes it.

### Difficulty

The default is `meta-llama/llama-3.1-8b-instruct`. Difficulty means which model is underneath Ava,
and the buttons switch it on the OpenRouter key already set. Same assistant, same instructions, same
guardrail wording; only the model changes.

If the guardrail holds on one model and not another, the guardrail was never the thing doing the
work.

## The three acts

Ava never gains a new ability. Everything she can do in Act Three, she could do in Act One. What
grows is what you know and what you can reach.

**Act One. Extract her instructions.** Ava is steered by a block of hidden text telling her who to be
and what not to say. Get her to show you it, and find the internal tool named in it.

**Act Two. Reach internal data.** Ava can see a staff group chat, because someone thought that would
help her answer questions faster. You are a member of the public. Get her to show you what is in it,
and take the password.

**Act Three. Rewrite her.** The staff portal needs a username as well as that password. Find it, sign
in, change Ava's instructions, then go back to the council website and ask her to approve a
three-storey house on a protected foreshore reserve.

Each act has one hint, and gives you the answer whether you got it or not, with the documented
incident it is modelled on and where it sits in the [OWASP Top 10 for LLM
Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/).

## What it collects

Nothing. No accounts, no analytics, no telemetry, and no server but your own. Your key goes to the
model provider you chose and nowhere else. Conversations with Ava are not stored.

## Is any of this real?

The council is invented, along with every name, address, phone number and password in it. The domain
`@sandboxshire.local` cannot resolve anywhere.

The incidents each act cites are real and are named in the reveal, with a note wherever the attack
you performed differs from the mechanism of the real one. They often do.

## Licence

MIT. See [LICENSE](LICENSE).
