import { test } from "node:test";
import assert from "node:assert/strict";
import { isAutomated, dmarcVerdict, replySubject, rejectReason, parseAddresses } from "../src/policy.js";

const h = (obj) => new Headers(obj);

test("automated mail is never auto-replied", () => {
  assert.equal(isAutomated(h({ "Auto-Submitted": "auto-replied" }), "a@x.com"), true);
  assert.equal(isAutomated(h({ "Auto-Submitted": "no" }), "a@x.com"), false);
  assert.equal(isAutomated(h({ Precedence: "bulk" }), "a@x.com"), true);
  assert.equal(isAutomated(h({ "List-Unsubscribe": "<mailto:x>" }), "a@x.com"), true);
  assert.equal(isAutomated(h({}), "MAILER-DAEMON@x.com"), true);
  assert.equal(isAutomated(h({}), "noreply@x.com"), true);
  assert.equal(isAutomated(h({}), "no-reply@x.com"), true);
  assert.equal(isAutomated(h({}), "alice@gmail.com"), false);
});

test("DMARC verdict only trusts Cloudflare's results", () => {
  assert.equal(dmarcVerdict(h({ "Authentication-Results": "mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass" })), "pass");
  assert.equal(dmarcVerdict(h({ "ARC-Authentication-Results": "i=1; mx.cloudflare.net; dmarc=fail" })), "fail");
  assert.equal(dmarcVerdict(h({ "Authentication-Results": "mx.cloudflare.net; dmarc=none" })), "fail");
  // Forged by the sender: ignored.
  assert.equal(dmarcVerdict(h({ "Authentication-Results": "evil.example; dmarc=pass" })), null);
  assert.equal(dmarcVerdict(h({})), null);
});

test("reply subject", () => {
  assert.equal(replySubject("Help"), "Re: Help");
  assert.equal(replySubject("RE: Help"), "RE: Help");
  assert.equal(replySubject("a\r\nBcc: x@y.com"), "Re: a Bcc: x@y.com");
  assert.equal(replySubject(""), "Re: your message to Starr support");
});

test("reject reason carries the portal link", () => {
  assert.match(rejectReason("https://support.starr.app"), /https:\/\/support\.starr\.app/);
});

test("handled addresses", () => {
  assert.deepEqual(parseAddresses("support@starr.app, Info@Starr.app ,"), ["support@starr.app", "info@starr.app"]);
  assert.deepEqual(parseAddresses(undefined), []);
});
