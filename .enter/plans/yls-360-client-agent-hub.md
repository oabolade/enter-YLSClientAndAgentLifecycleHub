# YLS 360° Client & Agent Hub — Build Plan

## What you will get

One responsive web application that covers the three client moments for YLS Financial & Insurance Services, with both sides visible in the same demo:

- **Before:** guided multilingual intake with a document checklist.
- **During:** a bilingual concierge chat that hands urgent or complex requests to a licensed agent.
- **After:** a self-service policy vault with renewal countdowns and coverage suggestions.

Everything a client does in the Client Portal is saved to one shared database and shows up in the YLS Agent Command Center.

The look is clean and trustworthy: deep navy (#0F2942), warm crimson accent (#A61C3C), slate gray and crisp white. Amber is used only for "missing" and "renewing soon" warnings. It works on phone, tablet and desktop.

## Decisions you confirmed

- **AI is simulated for now and ready for Covey.** Chat replies, document checks and English summaries follow the rules in your knowledge file. Each of the three specialist agents has one defined hand-over point, so connecting Covey later replaces the simulation without changing any screen.
- **Uploaded files are not kept.** The hub records the file name and which checklist item it satisfies.
- **Reminders stay inside the app.** No real email or text message is sent.

## Top navigation bar

- [ ] A View Switcher at the very top toggles between **Client Portal View** and **YLS Agent Command Center**. It keeps your place in each view when you switch back.
- [ ] In Client View, a Persona Quick-Select offers Mei-Ling Chen (Mandarin), Minh Tran (Vietnamese), Roberto Santos (Filipino) and New Guest Visitor. Choosing a persona loads that client's policies and submissions and switches the language to their preferred one.
- [ ] A Language Selector offers English, 中文 (Mandarin), 廣東話 (Cantonese), Tiếng Việt and Filipino. It translates all labels, checklists, chat replies and reminders in the Client Portal, and can override the persona's default at any time.
- [ ] The Agent Command Center is always in English, following your core rule that internal summaries are in English.

## Client Portal

### Tab 1 — Guided Intake & Document Upload

- [ ] A step-by-step wizard: choose an Insurance Line (Auto, Home, Medicare/Medical, Commercial, Life), choose a Request Type (New Quote, Policy Change, Renewal), complete the checklist, then review and submit.
- [ ] The required checklist changes with the selected line and request type, using the rules in your knowledge file. For example, the current declarations page is only required when switching or renewing, and three years of loss runs only for a commercial renewal.
- [ ] Items that are information rather than files (garaging address, zip code, physician name, roof year, business name and FEIN, revenue estimate) are typed in and count toward completion.
- [ ] Dropping a file into the upload area shows a short "verifying" moment, then checks off the matching item. Matching uses the file name. If the name is not recognisable, the client is asked which checklist item the file is for, instead of the hub guessing.
- [ ] Items still missing are flagged in amber, and a progress bar shows live completion.
- [ ] A client can submit while items are missing. The submission is saved as "Action Required – Missing Docs" and appears in the agent queue with the gaps listed.
- [ ] A New Guest Visitor is asked for name, phone, email and preferred language before submitting.

### Tab 2 — Bilingual AI Concierge

- [ ] A chat assistant answers in the selected language about routine topics: required documents, process steps, how to contact the office, payment portal guidance, submission status, and ID card or COI downloads.
- [ ] Quick-prompt chips are translated with the rest of the page, including "What documents do I need to add a driver?", "Download my COI" and "I need to change my commercial coverage immediately".
- [ ] "Download my COI" replies with a download button for that client's own document. If the client has none on file, the reply says so and offers a handoff.
- [ ] A **Warm Handoff Initiated** banner appears for requests that must go to a person: binding, cancelling or changing coverage effective immediately; complex commercial or claims disputes; Medicare plan comparisons; clear frustration; or asking for a human. It confirms that an English summary and a callback request were sent to a licensed YLS agent.
- [ ] Each handoff creates an entry in the agent queue with the client's original message, the English summary, the reason for escalation and callback details. A guest is asked for a name and phone number first.
- [ ] A "Talk to an agent" button is always visible, so a client can reach a person even if their wording is not recognised.
- [ ] Limitation of simulated mode: questions outside the prepared topics get a polite "I can't answer that reliably" reply with an offer to hand off. The concierge does not improvise insurance advice.

### Tab 3 — My Policy Vault

- [ ] Each active policy is a card showing Policy Number, Carrier, Monthly Premium, Deductible, status and a Renewal Countdown badge. The badge turns amber under 30 days.
- [ ] One-click "Download ID Card / COI" buttons list that policy's documents. Downloads are sample documents clearly marked as samples, because no real carrier files exist yet.
- [ ] A Submission Status Tracker shows each open submission with its completion percentage, the items received and the items missing. It links back to the intake to finish them.
- [ ] Reminders sent by an agent appear here in the client's language.
- [ ] A Coverage Gap Recommendation card gives one rule-based suggestion per client, with a button to start an intake or request a callback. It shows no prices or savings figures.
  - Mei-Ling (Auto only): bundle Home.
  - Minh (Commercial only): review Group coverage for employees.
  - Roberto (Medicare, renewal review needed): book a renewal review before the renewal date.
- [ ] A New Guest Visitor sees an empty vault with an invitation to start an intake.

## YLS Agent Command Center

- [ ] A KPI strip shows Incomplete Submissions Caught, Routine Inquiries Auto-Resolved and Avg. Agent Prep Time Saved. The first two count real activity in the hub on top of a small sample history. Prep time saved is an illustrative estimate and is labelled as one.
- [ ] A Unified Work Queue shows two panels side by side, stacked on phones: incoming client intakes and escalated chat handoffs. Each row shows client, language, line, status and time received. New items from the Client Portal appear without a manual reload.
- [ ] Clicking any row opens an Agent Prep Drawer with:
  - the client's preferred language and contact information;
  - the English summary of the request, with the client's original wording available underneath for handoffs;
  - a Document Completeness Checklist with green checks for items received and red flags for items missing;
  - a Suggested Next Action based on the situation, such as sending a reminder for the missing items or calling back about an urgent coverage change.
- [ ] A one-click "Send Automated Reminder in Client's Language" button shows the translated message with an English reference, records it as sent with a timestamp, and delivers it to the client's Policy Vault. It is unavailable when nothing is missing.

## Shared data

- [ ] The database follows your schema: clients, their policies and their active submissions, extended with chat handoffs and reminders.
- [ ] It starts with your three clients exactly as provided, including Mei-Ling's open submission SUB-501 with its two missing items.
- [ ] Two sample handoffs are added so the queue is populated before the live demo: Minh's urgent commercial coverage change and Roberto's Medicare plan comparison. They are marked as sample data.
- [ ] You will first see a preview of all screens running on this sample data. The shared database is connected right after, so intakes, handoffs and reminders persist and flow between the two views.

## Assumptions to confirm or correct

- **Life insurance checklist.** Your knowledge file has none, so I will use government photo ID, date of birth and beneficiary details, a health questionnaire, and the existing policy statement if replacing coverage. Please have Yvonne confirm.
- **Medical uses the Medicare checklist**, with the prescription list optional, because your file combines the two.
- **Only the five lines you listed appear in the intake.** Annuity, Travel and Group are left out of the wizard.
- **Renewal countdowns are calculated from the renewal date and today's date.** They will be slightly lower than the fixed numbers in your file and will keep counting down. Mei-Ling shows 17 days today.
- **Translations are AI-written.** A native speaker should review them before real clients see them, especially the Cantonese.

## Not included in this build

- Real client login. Access is open through the persona switcher so both sides can be demonstrated, so only sample data should be used until sign-in is added.
- Live connections to the Covey agents, carrier systems or the existing client management system.
- Real email or text delivery, and storage of uploaded files.
- Agent actions beyond sending reminders, such as assigning, closing or editing queue items.
