# Sandbox Shire

**Break an AI assistant using nothing but plain English.**

Sandbox Shire Council is not real. Ava, the assistant in the corner of its website, is. She runs on
whatever model you point her at, she has instructions she has been told to keep private, and she can
see things she should not show you.

You get them out of her by talking to her. No code, no tools, no exploits — just sentences. There
are three acts, and what you take from each one is the key to the next.

Runs on your machine with one command. No account, no cloud, no sign-up.

---

## Why

**AI systems can be attacked with ordinary language.**

Not code. Not tooling. Not anything a penetration test would recognise. You type English at an
assistant and it does something it was explicitly told not to do.

That is genuinely new. What governs how these systems behave is a paragraph of plain English, and
plain English is something anyone can write. The skill barrier that used to stand between a curious
person and a system's behaviour is largely gone.

The fastest way to understand that is to do it. Here you get twenty minutes, three acts and no
technical background required. By the end you will have talked an assistant into handing over a
staff password, and used that password to rewrite what she tells everyone who asks her a question.

---

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. Nothing else — there is no install step and no
dependencies.

```bash
git clone https://github.com/JoshuaBearup/sandbox-shire.git
cd sandbox-shire
npm start
```

Then open **http://localhost:8787**.

That opens the **control screen**, which is where you drive everything: connect a model, change the
difficulty, and start each act. You never need to edit a file or touch the terminal again.

---

## Plugging in a model

Ava talks to anything that speaks the OpenAI chat-completions API, which in practice is nearly
everything. Set it in the app — there is no config file to edit.

**[OpenRouter](https://openrouter.ai) is the default** and the easiest start: one key reaches
hundreds of models, including free ones.

| You want | Base URL | Notes |
|---|---|---|
| OpenRouter *(default)* | `https://openrouter.ai/api/v1` | One key, hundreds of models, free tiers available |
| A model on your own machine | `http://localhost:11434/v1` | [Ollama](https://ollama.com). No key, no cost, works offline |
| LM Studio | `http://localhost:1234/v1` | Same idea, different app |
| OpenAI, Groq, xAI, Together, … | their own base URL | Any OpenAI-compatible endpoint |

### Changing the difficulty

The default is `meta-llama/llama-3.1-8b-instruct`, which is what the workshop ran on. Start there.

If you want it harder, **change the model underneath Ava** — there are buttons for it on the control
screen, and they work on the same OpenRouter key you have already set up. Nothing else changes: same
assistant, same instructions, same guardrail wording. Only the model moves, and the game gets harder.

That is worth sitting with for a second, because it is the part that applies to whatever your
organisation is being sold. If the guardrail holds on one model and not another, the guardrail was
never the thing doing the work.

---

## The three acts

Ava never gains a new ability. Everything she can do in Act Three, she could do in Act One. What
grows is what *you* know and what *you* can reach — which is what a real attack on one of these
systems actually looks like.

**Act One — Extract her instructions.** Every assistant like Ava is steered by a block of hidden text
telling it who to be and what not to say. Get her to show you hers, and find the internal tool named
in it.

**Act Two — Reach internal data.** Ava can see a staff group chat, because someone thought that would
help her answer questions faster. You are a member of the public. Get her to show you what is in it.

**Act Three — Rewrite her.** Take what Act Two gave you, log into the staff portal, and change Ava's
instructions. Then go back to the council website and watch a compromised assistant approve a
three-storey house on a protected foreshore reserve.

Each act ends by telling you the answer whether you got it or not, along with the real, documented
incident it is modelled on and where it sits in the [OWASP Top 10 for LLM
Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/). You never
leave an act without knowing how it was done.

---

## What it collects

Nothing. There are no accounts, no analytics, no telemetry and no server but your own. Your API key
is stored in a gitignored file on your own machine and is sent to your chosen model provider and
nowhere else. Your conversations with Ava are not stored anywhere at all.

---

## Where it came from

This started life as a room-sized workshop called **Everyone's a Hacker**, which needed a
facilitator and everyone present at once. This is the single-player version, which needs neither.

It gains something in the move. In a room, Act Three has to be a demo run from the front, because
letting a crowd of strangers rewrite the live assistant is the exact vulnerability being taught. On
your own machine there is nobody to protect it from, so you get to do it yourself. It is the best
act of the three.

---

## Is any of this real?

The council is invented. So is every name, address, phone number and password in it. The domain
`@sandboxshire.local` cannot resolve anywhere.

The incidents each act cites are real and are named in the reveal, with a note wherever the attack
you performed differs from the mechanism of the real one — because they often do, and a game that
blurs that teaches you something false.

---

## Licence

MIT. See [LICENSE](LICENSE).
