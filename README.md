# Lay Low Cafe website

Website for Lay Low Cafe, 241 Princess St, Kingston, ON. Served at https://laylowcafe.ca.

It's plain HTML, CSS and a little JavaScript. There's no build step and no framework, so any static host can serve the repo as it is.

```
index.html              the cafe page: hero, our story, menu, gift cards + merch, visit, private events, fall banner
late-night/index.html   Late Night @ Lay Low: events and private bookings (dark theme)
merch/index.html        the merch collection: a spinning carousel of the café's clothes and totes
menu/ events/ contact-us/   tiny redirects so the old GoDaddy URLs still work (events/ goes to late-night/)
404.html
assets/css/styles.css   all styles; colours and fonts are at the top in :root
assets/js/main.js       open-now badge, menu tabs, contact form, events from the Google Sheet
assets/js/merch.js      the merch carousel (3D spin, swipe, arrows)
assets/js/intro.js      opening animation: disco ball morphs into the logo
assets/img/             photos, logo, icons
assets/img/merch/       merch photos: NAME-front.webp, NAME-back.webp, NAME-edge.webp and NAME-depth.png for each item
assets/js/vendor/       three.js (MIT), used only by the merch page
tools/merch-3d.py       makes the merch 3D files from cut-out photos
tools/merch-3d-fit-back.py   sharper 3D for items with a real back photo
docs/events-sheet-template.csv   starter for the Google Sheet the events list reads
.nojekyll               tells GitHub Pages to serve files as-is
```

## Preview locally

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Common edits

**Menu.** Edit the `#menu` section of `index.html`. Each category is one tab panel, and each item is one `<li>` with its name and description. The cafe asked for no prices on the site. Copy an existing item and change it. The comment above the tabs explains the VG / V / GF tags.

**Hours.** Hours appear in three places. Update all three:
1. The `HOURS` array in `assets/js/main.js`. This drives the "Open now" badge.
2. The JSON-LD `openingHoursSpecification` near the top of `index.html`. Google reads this.
3. The "When" line in the Visit section, plus the "7–4" sticker in the hero.

**Events.** The cafe adds Late Night events in a Google Sheet, and the page reads it every time someone visits. See "Events sheet" below. Past events hide themselves the day after, and when none are left the page says new events are on the way. The events written into `late-night/index.html` are only a fallback for when the sheet isn't set up or can't be loaded.

**Merch.** The home page's Merch card links to `merch/index.html`, the collection page. Its carousel is driven by `assets/js/merch.js`. The item in the middle is a 3D model made from its real photos: the outline is "inflated" like a pillow using `NAME-depth.png`, with the front photo on the front and the back photo on the back, drawn with three.js (`assets/js/vendor/`, MIT licence). three.js only loads on that page, once the carousel is on screen. On devices without WebGL it falls back to a flat cutout with a bit of thickness. Items turn slowly counter-clockwise by themselves, and visitors can drag them to spin them in any direction. To add an item, copy one `<li class="merch-item">`, then run `tools/merch-3d.py` (see the top of that file) to make its four files in `assets/img/merch/`. If the item has a real back photo, also run `tools/merch-3d-fit-back.py`. It fits the back photo to the front's outline and makes a finer depth map, so the model looks smooth and detailed. `data-puff` sets how full the model is: about 0.12 for a hoodie, 0.08 for a tee, 0.24 for a cap and 0.04 for a tote. `data-edge` is the colour of its sides in the flat fallback.

**Seasonal banner.** The fall drinks strip is the `fall-banner` block at the top of `index.html`. Edit the `<span>` items in **both** `<p>` lines, which must match because the second copy makes the scroll loop seamlessly. Delete the whole block to remove it.

**Opening animation.** `assets/js/intro.js` plays once per browser tab on the cafe page, and never for visitors who have reduced motion turned on. A click, tap or key press skips it. Timings are in the `T` object at the top of that file. To switch it off, delete the small inline `<script>` that adds the `intro` class and the `intro.js` script tag from the `<head>` of `index.html`.

**Gift cards.** The `#gift-cards` card in `index.html` has a disabled "coming soon" button. Once the cafe's payment system is known, swap it for a link to their gift card page.

**Private events.** The `#private-events` section near the bottom of `index.html`. The Late Night page's "Book a private event" button links there.

**Photos.** The page uses one hero photo, `assets/img/brunch-spread.jpg`. The other photos in `assets/img/` are spares for swapping in. Keep photos at roughly 1200px on the long edge and JPEG quality 80.

After changing `styles.css` or `main.js`, bump the `?v=` number on their links in each HTML file (e.g. `?v=4` to `?v=5`). Otherwise visitors' browsers can keep using the old copy for a while.

Every link and asset path is relative. Keep it that way, so the site works on the real domain, on a GitHub Pages subfolder and when opened straight from disk.

## Events sheet (Google Sheets)

The Late Night events list is filled from a Google Sheet, so the cafe can add events without asking anyone to edit the site.

**Setting it up (once):**

1. In Google Sheets, create a new sheet and use File → Import → Upload to bring in `docs/events-sheet-template.csv`. Choose "Replace current sheet". This gives you the right column headings.
2. Select the Date column and set Format → Number → Date, so the cafe can double-click a cell and pick a date.
3. Share the sheet (Share button, top right) with the cafe's Google account as an **Editor**.
4. Go to File → Share → **Publish to web**. Choose the events tab and **Comma-separated values (.csv)**, then click Publish and copy the link. It ends in `output=csv`.
5. In `late-night/index.html`, paste that link into `data-events-sheet=""` on the `<ul class="events">` line, commit and push.
6. Open the Late Night page and check the example event shows. Then delete the example row.

**Columns.** Only *Date* and *Event name* are required. *Start time* and *End time* are shown as typed (for example `6:00 PM`), *Price* appears as the yellow tag, and *Hosted by* as the grey tag ("Hosted by" is added in front unless the cell already starts with "Hosted", "With" or "By"). Keep the heading row as it is. Columns can be moved around, and extra columns are ignored, so the cafe can keep its own notes in a column on the right.

**Good to know:**
- Changes show on the site within about 5 minutes, because that's how often Google refreshes a published sheet.
- Rows can be in any order. The site sorts them by date.
- Old rows can stay in the sheet. They stop showing once the date has passed.
- Anyone with the published link can read the sheet, so keep private notes out of it.
- If the sheet can't be loaded, the page falls back to the events written in the HTML.

## Contact form (Formspree)

GitHub Pages can't process forms, so the "Send us a message" form in the Visit section posts to [Formspree](https://formspree.io). The free plan covers 50 messages a month, and Formspree emails each one on.

1. Sign up at formspree.io with the inbox that should receive messages: the same address the old GoDaddy form sent to.
2. Create a form and copy its ID, the part after `/f/` in the endpoint.
3. In `index.html`, replace `YOUR_FORM_ID` in the form's `action`.
4. Send yourself a test message from the live site. The first submission asks you to confirm the form in Formspree.

Until that's done, the form tells visitors to call or DM instead of failing silently.

## Hosting: GitHub Pages + laylowcafe.ca

The site is deployed with GitHub Pages: Settings → Pages, deploy from a branch, branch root `/`. GitHub Pages can stay the permanent host. Websites + Marketing is a site builder and can't serve custom code. The domain stays registered at GoDaddy. Only the DNS records change so that they point at GitHub Pages.

**Going live on the real domain** (best done after the cafe closes at 4pm):

1. **Back up the current DNS.** In GoDaddy, go to My Products, then laylowcafe.ca, then DNS, and screenshot every record. That screenshot is the rollback plan.
2. **Verify the domain with GitHub.** In your GitHub account, go to Settings, then Pages, then Add a domain, and enter `laylowcafe.ca`. GitHub gives you a `TXT` record. Add it in GoDaddy DNS and click Verify. This stops anyone else from pointing the domain at their own site.
3. **Set the custom domain.** In the repo, go to Settings, then Pages, then Custom domain. Enter `laylowcafe.ca` and save. GitHub commits a `CNAME` file. The github.io link starts redirecting to laylowcafe.ca, which shows the old site until step 5 finishes.
4. **Disconnect Websites + Marketing.** In GoDaddy, open the Websites + Marketing site settings and disconnect or remove the domain, so GoDaddy stops managing its records. Also check that domain Forwarding is off.
5. **Edit the DNS records in GoDaddy:**
   - `A` records for `@`: delete the existing ones and add four, pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
   - `AAAA` records for `@`: delete any. Optionally, add GitHub's IPv6 addresses `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153` and `2606:50c0:8003::153`.
   - `CNAME` for `www`: set it to `shepcx3.github.io`.
   - **Leave MX, TXT (SPF/DKIM/verification) and any email-related `CNAME` records exactly as they are.**
6. **Turn on HTTPS.** Once Settings → Pages shows "DNS check successful", tick **Enforce HTTPS**. The certificate can take up to an hour. Until then the box may be greyed out.
7. **Check the live site.** Open `https://laylowcafe.ca`, `https://www.laylowcafe.ca`, `https://laylowcafe.ca/menu` and `https://laylowcafe.ca/late-night/` on a phone using mobile data, plus a computer.
8. **Cancel the old plan.** After a few days of the new site running fine, cancel the Websites + Marketing plan. **Keep the domain registration** and any email plan.

**Rollback:** if something goes wrong, put back the records from the step 1 screenshot and remove the custom domain in Settings → Pages.

**After launch:**
- In Google Search Console, verify the domain and submit `https://laylowcafe.ca/sitemap.xml`.
- In Google Business Profile, make sure the website, hours and menu link (`https://laylowcafe.ca/#menu`) match the site.
- Put the website link in the Instagram and TikTok bios.

**Notes:**
- The canonical and social-preview tags already point at `https://laylowcafe.ca`, so search engines won't index the staging URL as the real site.
- The repo must be public for GitHub Pages on a free GitHub plan.
