# BudsNiche v17 — Live AI Judge

This build connects the actual BudsNiche game to the deployed Supabase Edge Function at `bright-action`.

## What changed
- Niche rounds now send the player's submitted answers to the live AI Judge.
- The browser sends only the public Supabase publishable key. The OpenAI secret stays inside Supabase.
- The Judge checks owner training/cache first and uses GPT-5.6 Luna only for unseen answers.
- Canonical duplicate concepts only score once.
- A 15-second timeout and local backup scoring keep a round from breaking if the Judge is temporarily unavailable.
- Existing hardcoded profiles are no longer the normal scoring path; they remain only as backup scoring and the temporary Top 4 display.
- Visible build marker is `BUILD V17`.

## Deploy
Replace the root website files with this matched set and deploy together.

## Test
On the Iowa State University round, try `College`, `Campanile`, `Therkildsen`, and `Cyclones`. The live Judge should produce the trained scores 18, 89, and 33, and the cached Therkildsen score from your successful function test.
