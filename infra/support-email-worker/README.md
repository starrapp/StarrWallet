# support@starr.app email Worker

Mail to support@starr.app never becomes a ticket. Instead:

| Incoming mail | What happens |
|---|---|
| Real sender, passes DMARC, first email in 24 h | Gets one automatic reply with the portal link |
| Same sender again within 24 h | Rejected at delivery. Their own mail provider sends them a bounce with the portal link |
| Fails DMARC (forged or spoofed sender, most spam) | Rejected. You send nothing, so no backscatter |
| Newsletters, auto-replies, bounces, no-reply senders | Rejected, never auto-replied (prevents mail loops) |

Rejection text: "This address does not accept email. Open a support ticket at https://support.starr.app"

Cloudflare itself refuses to send a reply to mail without valid DMARC, so even if the header check misses something, a spoofed sender can't get a reply.

## Deploy (about 10 minutes)

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler kv namespace create REPLIED` and paste the printed `id` into `wrangler.jsonc`.
4. Check `PORTAL_URL` in `wrangler.jsonc`, then run `npx wrangler deploy`.
5. In the Cloudflare dashboard, go to **starr.app → Email → Email Routing → Routing rules**:
   - Edit the custom address **support@starr.app** and set its action to **Send to a Worker → starr-support-email**. This replaces the current forward, which is what has been creating tickets from email.
   - Check the **catch-all** rule. If it forwards everything, spam to random addresses still gets through. Set it to **Drop**, or send it to this Worker too: anything not addressed to support@ is rejected with the portal message.
6. Test it:
   - From a Gmail account, email support@starr.app. You should get the auto-reply.
   - Email again within 24 hours. You should get a bounce containing the portal link.
   - Watch the logs with `npx wrangler tail starr-support-email`. Each email logs one line: `replied` or `reject` with a reason.

## Files

- `src/index.js`: the email handler
- `src/policy.js`: the decision rules (automated-mail detection, DMARC verdict, reply text)
- `test/policy.test.js`: `npm test`
