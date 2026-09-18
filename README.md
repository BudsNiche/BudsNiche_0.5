# BudsNiche v18 — Private Judge Trainer

V18 keeps the live Niche Judge from V17 and adds a private owner-only trainer page at `/trainer.html`.

## What the trainer does
- Loads the newest rows from `ai_judge_cache`.
- Shows the answer, AI score, confidence, reason, and canonical concept.
- Lets the owner approve the AI score or replace it with a 0–100 score.
- Saves the corrected/approved answer into `ai_judge_training_examples`.
- Marks the cache row `approved_by_admin=true` and `needs_review=false`.
- On future identical answers, the main Judge finds owner training before cache/AI.

## Security design
- The browser never receives the Supabase service-role key.
- The trainer requires a separate `BUDSNICHE_TRAINER_KEY` stored as an Edge Function secret.
- The trainer key is entered manually on `/trainer.html` and is kept only in JavaScript memory for that browser tab; it is not saved to localStorage.
- The private database reads/writes happen inside the `judge-trainer` Edge Function using the server-side service-role key.

## One-time Supabase setup
1. In Edge Functions, create a new function whose slug is `judge-trainer`.
2. Replace the starter code with `setup/judge-trainer-edge-function.ts` and deploy it.
3. In the new function's Settings, turn **Verify JWT with legacy secret** OFF because this endpoint uses its own owner key check.
4. In Edge Function Secrets, add `BUDSNICHE_TRAINER_KEY` with a long private value. Do not put this secret in GitHub or the website files.

## Website deploy
Upload the website files to GitHub as a matched set. `BUILD V18` appears on the main site. Then visit `/trainer.html`, enter the same private trainer key, and press **Load Judgments**.

## First test
Your cached `Therkildsen` judgment should appear. Change 86 if desired (or leave 86), click **Save as Training**, then test the main Judge again. The same answer should now come back from `source: "training"` with confidence 1.
