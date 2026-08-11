# Sandbox Shire

**A fake council website with an AI assistant you are invited to break.**

Sandbox Shire Council is not real. Ava, the assistant in the corner of its website, is. She runs on
whatever model you point her at, she has instructions she has been told to keep private, and she can
see things she should not show you.

Your job is to get them out of her. There are three acts, and what you take from each one is the key
to the next.

Runs on your machine with one command. No account, no cloud, no sign-up.

---

## Why

Someone is probably adding an AI assistant to a system you use or own. The question everyone gets
asked is *"is it safe?"* and almost nobody has a way to judge the answer.

This gives you one, by letting you do it yourself. It takes about twenty minutes and needs no
technical background. By the end you will have talked a council assistant into handing over a staff
password, and then used that password to rewrite what she is — and you will understand, from having
done it, why the thing governing an AI system's behaviour being a paragraph of plain English is a
genuinely new kind of risk.

It is not an argument against using AI. It is how you check.

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

This is the single-player extraction of **Everyone's a Hacker**, a workshop built for sixty
local-government staff at ALGIM 2026. That version needs a facilitator, a projector, a room and
sixty phones. This one needs you.

One thing genuinely improves in the extraction: in the workshop, Act Three has to be a demo the
facilitator runs, because letting sixty strangers rewrite the live assistant is the exact
vulnerability being taught. On your own machine, there is nobody to protect it from. It is the best
act in the set and this is the version that can hand it over.

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
