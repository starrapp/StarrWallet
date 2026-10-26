import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { isAutomated, dmarcVerdict, rejectReason, replySubject, replyText } from "./policy.js";

const DAY_SECONDS = 24 * 60 * 60;

export default {
  async email(message, env, ctx) {
    const reject = (why) => {
      console.log(JSON.stringify({ action: "reject", why, from: message.from }));
      message.setReject(rejectReason(env.PORTAL_URL));
    };

    // Anything not addressed to the support address (if this Worker is bound to more routes).
    if (message.to.toLowerCase() !== env.SUPPORT_ADDRESS.toLowerCase()) return reject("other-recipient");
    if (isAutomated(message.headers, message.from)) return reject("automated");

    // Cloudflare's own verdict when present; reply() enforces DMARC again below.
    if (dmarcVerdict(message.headers) === "fail") return reject("dmarc-fail");

    // One auto-reply per sender per day; later mail from them is rejected with the portal link.
    const sender = message.from.toLowerCase();
    if (await env.REPLIED.get(sender)) return reject("already-replied");

    const messageId = message.headers.get("message-id");
    const mime = createMimeMessage();
    mime.setSender({ name: "Starr Support", addr: env.SUPPORT_ADDRESS });
    mime.setRecipient(message.from);
    mime.setSubject(replySubject(message.headers.get("subject")));
    if (messageId) {
      mime.setHeader("In-Reply-To", messageId);
      mime.setHeader("References", messageId);
    }
    mime.setHeader("Auto-Submitted", "auto-replied");
    mime.setHeader("X-Auto-Response-Suppress", "All");
    mime.addMessage({ contentType: "text/plain", data: replyText(env.PORTAL_URL) });

    try {
      await message.reply(new EmailMessage(env.SUPPORT_ADDRESS, message.from, mime.asRaw()));
    } catch (err) {
      // Cloudflare refuses replies to mail without valid DMARC (and other limits): treat as spam.
      console.log(JSON.stringify({ action: "reply-refused", error: String(err), from: message.from }));
      return reject("reply-refused");
    }

    ctx.waitUntil(env.REPLIED.put(sender, "1", { expirationTtl: DAY_SECONDS }));
    console.log(JSON.stringify({ action: "replied", from: message.from }));
  },
};
