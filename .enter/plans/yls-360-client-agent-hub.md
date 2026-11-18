# YLS 360° Client & Agent Hub — Build Plan

Only the first section is new and needs your approval. The second section records what is already built, updated for the changes made since the original plan.

## New: Sign-in and private access

**Result:** nobody can see or do anything in the hub without signing in. A client sees only their own records. Only named YLS staff can open the Agent Command Center.

### Decisions you confirmed

- People sign in with an email address and password.
- Staff access goes to the email addresses you give me. Adding or removing someone later means asking me.
- The persona switcher and the three sample clients stay, as a demo mode for staff only.
- A visitor can do nothing before creating an account.

### Signing in

- [ ] Opening the hub shows a sign-in screen instead of the portal. It has "Sign in" and "Create account", and a language selector, so the screen works in all five languages.
- [ ] Creating an account asks for full name, phone number, email, password and preferred language. This replaces the contact form that a New Guest Visitor filled in before.
- [ ] A new account must confirm its email address through a link sent to that inbox before the first sign-in. This is what makes the staff list safe: nobody can register with someone else's address. Signing in before confirming is refused with a message to check the inbox, and an option to send the link again.
- [ ] "Forgot password" sends a link to set a new password.
- [ ] A person stays signed in on their device until they choose Sign out. The top bar shows their name and a Sign out button.
- [ ] Wrong password, an email that already has an account, or a weak password each show a plain message in the selected language.

### What a client sees

- [ ] After signing in, a client lands in the Client Portal in their preferred language, with only their own policies, submissions and reminders. They see no view switcher and no persona list.
- [ ] A new account starts with an empty vault and can start an intake, upload documents and use the concierge straight away. Intakes and handoffs use the name and phone number from the account, so the client is not asked again.
- [ ] A client cannot read or change another client's records. This is enforced where the data is stored, not only hidden on screen.
- [ ] An uploaded document belongs to the account that uploaded it. The document check reads only that account's own files.
- [ ] The "demo with sample data" footer note no longer appears for clients. They still see the notice that AI features can make mistakes.

### What staff see

- [ ] An account whose confirmed email is on the staff list opens on the Agent Command Center, with all intakes, handoffs, KPIs and reminders as today.
- [ ] Staff keep the view switcher and can open the Client Portal as Mei-Ling Chen, Minh Tran or Roberto Santos for demos and training. Anything done in demo mode is saved against that sample client, as it is today.
- [ ] The "New Guest Visitor" option is removed from the persona list. Creating a real account now shows that experience.
- [ ] Only staff can send reminders.
- [ ] A person taken off the staff list loses access to client records straight away.

### AI agents

- [ ] Triage, the handoff summary, the document check and the renewal suggestion answer only signed-in people. A request without an account is refused, so the link alone can no longer use your AI credits.
- [ ] A client gets renewal suggestions only for their own policies.

### Existing data

- [ ] The three sample clients and their sample records stay as they are.
- [ ] The handoffs, the submission, the reminder and the four files created during testing stay, and become visible to staff only. Nothing is deleted.

### What I need from you

- **The staff email addresses.** Until I have them, no account has staff access and nobody can open the Command Center.
- **One real sign-up with your own address.** I cannot receive email, so I cannot confirm that the confirmation and password links arrive. If they prove unreliable, I will come back to you before changing the confirmation rule.

### Limitations and exclusions

- A new client account is not linked to any policies. There is no screen for staff to add policies to a client, so a real client's vault stays empty until that is built. Only the three sample clients have policies.
- Staff still cannot open uploaded files from the Command Center. They see the file name and the AI note.
- Not included: a staff management screen, Google sign-in, two-step verification, and saving chat history between visits.

## Already built

### Decisions in force

- **The three specialist agents run inside the hub on live AI.** Covey offers no outside connection, so triage, the handoff summary, the document check and the renewal suggestion were built in the app from your YLS rules document. The mandatory handoff rules stay hard-coded on top of the AI.
- **Uploaded files are stored privately** so the document check can read them. This replaced the earlier decision to record file names only.
- **Reminders stay inside the app.** No real email or text message is sent.

### Top navigation bar

- [x] A View Switcher toggles between Client Portal View and YLS Agent Command Center, keeping your place in each view.
- [x] A Persona Quick-Select offers Mei-Ling Chen (Mandarin), Minh Tran (Vietnamese), Roberto Santos (Filipino) and New Guest Visitor, loading that client's records and preferred language.
- [x] A Language Selector offers English, 中文 (Mandarin), 廣東話 (Cantonese), Tiếng Việt and Filipino for the whole Client Portal.
- [x] The Agent Command Center is always in English.

### Client Portal

**Tab 1 — Guided Intake & Document Upload**

- [x] A step-by-step wizard: Insurance Line (Auto, Home, Medicare/Medical, Commercial, Life), Request Type (New Quote, Policy Change, Renewal), checklist, then review and submit.
- [x] The checklist changes with the line and request type, using the rules in your knowledge file.
- [x] Information items (garaging address, zip code, physician name and similar) are typed in and count toward completion.
- [x] An uploaded PDF or image is stored privately and read by the document agent, which ticks the matching item and leaves a short English note for the agent. If it cannot match or read the file, the client chooses the item, and the agent sees that it was not confirmed by AI.
- [x] Missing items are flagged in amber, with a live progress bar.
- [x] A client can submit with items missing; it is saved as "Action Required – Missing Docs" and appears in the agent queue.

**Tab 2 — Bilingual AI Concierge**

- [x] The concierge answers routine topics in the selected language: required documents, contact details, payment guidance, submission status, and ID card or COI downloads. Typed messages are classified by the live triage agent in all five languages.
- [x] Quick-prompt chips are translated with the page.
- [x] A Warm Handoff banner appears for requests that must go to a person: binding, cancelling or changing coverage; complex commercial or claims disputes; Medicare plan comparisons; clear frustration; or asking for a human.
- [x] Each handoff creates an agent queue entry with the original message, the reason, callback details, and an English summary that includes an AI rendering of the client's own words.
- [x] A "Talk to an agent" button is always visible.
- [x] Questions outside the prepared topics get a polite "I can't answer that reliably" reply with an offer to hand off. If the AI is unavailable, the client is offered an agent.

**Tab 3 — My Policy Vault**

- [x] Policy cards show Policy Number, Carrier, Monthly Premium, Deductible, status and a Renewal Countdown badge that turns amber under 30 days.
- [x] "Download ID Card / COI" buttons give sample documents clearly marked as samples.
- [x] A Submission Status Tracker shows each open submission with received and missing items, linking back to the intake.
- [x] Reminders sent by an agent appear in the client's language.
- [x] A Coverage Gap Recommendation card shows one suggestion the client is eligible for, written by AI in their language and labelled as such, with no prices or savings figures.

### YLS Agent Command Center

- [x] A KPI strip shows Incomplete Submissions Caught, Routine Inquiries Auto-Resolved and Avg. Agent Prep Time Saved. The first two count real activity on top of placeholder baseline figures; prep time saved is an illustrative estimate.
- [x] A Unified Work Queue shows incoming intakes and escalated handoffs, updating without a manual reload.
- [x] An Agent Prep Drawer shows contact details, the English summary with the original wording, the document checklist with AI notes, and a suggested next action.
- [x] "Send Automated Reminder in Client's Language" records the reminder and delivers it to the client's Policy Vault.

### Shared data

- [x] One shared database holds clients, policies, submissions, handoffs, reminders and concierge activity, starting with your three clients, SUB-501 and two sample handoffs.

### Assumptions still to confirm

- **Life insurance checklist** is my assumption; please have Yvonne confirm it.
- **Medical uses the Medicare checklist**, with the prescription list optional.
- **Translations and AI replies are AI-written.** A native speaker should review them before real clients see them.

### Still not included

- Connections to carrier systems or the existing client management system.
- Real email or text delivery of reminders.
- Agent actions beyond sending reminders, such as assigning, closing or editing queue items.
