// Pure decision logic, kept apart from the Cloudflare runtime so it can be tested with plain Node.

// Mail that must never get an auto-reply (RFC 3834): other robots, bounces and mailing lists.
// Replying to these causes loops or backscatter.
export function isAutomated(headers, from) {
  const autoSubmitted = (headers.get("auto-submitted") || "").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  const precedence = (headers.get("precedence") || "").toLowerCase();
  if (["bulk", "list", "junk", "auto_reply"].includes(precedence)) return true;
  if (headers.get("list-id") || headers.get("list-unsubscribe")) return true;
  if (headers.get("x-auto-response-suppress")) return true;
  const local = (from || "").toLowerCase().split("@")[0];
  return /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce[s]?)/.test(local);
}

// DMARC verdict from Cloudflare's own Authentication-Results, if present.
// Returns "pass", "fail" (any non-pass verdict) or null (no verdict found).
// Only results stamped by Cloudflare's MX are trusted: a sender can forge any header it adds itself.
export function dmarcVerdict(headers) {
  for (const name of ["authentication-results", "arc-authentication-results"]) {
    const value = headers.get(name);
    if (!value || !/mx\.cloudflare\.net/i.test(value)) continue;
    const match = /\bdmarc=([a-z]+)/i.exec(value);
    if (match) return match[1].toLowerCase() === "pass" ? "pass" : "fail";
  }
  return null;
}

// Comma-separated list from the SUPPORT_ADDRESSES variable, lower-cased.
export function parseAddresses(list) {
  return (list || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
}

export function rejectReason(portalUrl) {
  return `This address does not accept email. Open a support ticket at ${portalUrl}`;
}

export function replySubject(subject) {
  const s = (subject || "").replace(/[\r\n]+/g, " ").trim();
  if (!s) return "Re: your message to Starr support";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export function replyText(portalUrl) {
  return [
    "Hi,",
    "",
    "Thanks for contacting Starr. We don't answer support requests by email, so this message hasn't been read or turned into a ticket.",
    "",
    `Please open a support ticket here: ${portalUrl}`,
    "",
    "You can track your ticket there, and our team replies through the portal.",
    "",
    "Never send your recovery phrase to anyone. Starr support will never ask for it.",
    "",
    "Starr",
    "",
    "This is an automatic reply.",
  ].join("\n");
}
