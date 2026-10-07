# Lay Low Cafe website

Website for Lay Low Cafe, 241 Princess St, Kingston, ON. Served at https://laylowcafe.ca.

It's plain HTML, CSS and a little JavaScript. There's no build step and no framework, so any static host can serve the repo as it is.

```
index.html              Home
menu/index.html         /menu        (same URLs as the old GoDaddy site)
events/index.html       /events
contact-us/index.html   /contact-us
404.html
assets/css/styles.css   all styles; colours and fonts are at the top in :root
assets/js/main.js       open-now badge, mobile nav, scroll effects
assets/img/             photos, logo, icons
.nojekyll               tells GitHub Pages to serve files as-is
```

## Preview locally

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Common edits

**Menu.** Edit `menu/index.html`. Each dish is one `<li class="menu-item">` with its name, price and description. Copy an existing item and change it. The comment at the top of the menu explains the VG / V / GF tags and the shorter drink rows.

**Hours.** Hours appear in four places. Update all four:
1. The `HOURS` array in `assets/js/main.js`. This drives the "Open now" badge.
2. The JSON-LD `openingHoursSpecification` in `index.html`. Google reads this.
3. The hours table in `contact-us/index.html`.
4. The footer in every page, plus the "7–5" sticker and the text on the home page.

**Photos.** Add the JPEG to `assets/img/`, at roughly 1200px on the long edge and quality 80. Then update the `src`, `alt`, `width` and `height` attributes.

Every link and asset path is relative, for example `assets/...` on the home page and `../assets/...` in sub-pages. Keep it that way, so the site works on the real domain, on a GitHub Pages subfolder and when opened straight from disk. A path starting with `/` breaks the styling everywhere except the domain root.

The header, footer and mobile action bar are repeated in each page. If you change one, change it in all of them, or search the whole project for the text.

## Contact form (Formspree)

GitHub Pages can't process forms, so the contact form posts to [Formspree](https://formspree.io). Formspree's free plan covers 50 messages a month, and it emails each submission on.

1. Sign up at formspree.io with the inbox that should receive messages. This can be yours until the cafe has one.
2. Create a form and copy its ID, the part after `/f/` in the endpoint.
3. In `contact-us/index.html`, replace `YOUR_FORM_ID` in the form's `action`.

Until that's done, the form tells visitors to call or DM instead of failing silently.

## Hosting: GitHub Pages + laylowcafe.ca

The site is deployed with GitHub Pages: Settings → Pages, deploy from a branch, branch root `/`. GitHub Pages can stay the permanent host. Websites + Marketing is a site builder and can't serve custom code. The domain stays registered at GoDaddy. Only the DNS records change so that they point at GitHub Pages.

**Going live on the real domain**, once the owner approves the staging version:

1. **Disconnect at GoDaddy.** Disconnect the domain from the Websites + Marketing site. If you skip this, GoDaddy may keep rewriting the records.
2. **Edit the DNS records** at GoDaddy: My Products, then the domain, then DNS.
   - Replace the `A` records for `@` with GitHub's four: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
   - Set the `CNAME` record for `www` to `shepcx3.github.io`.
   - **Don't touch MX, TXT (SPF/DKIM) or other email records.**
3. **Set the custom domain** in the repo's Settings → Pages to `laylowcafe.ca`. GitHub commits a `CNAME` file for you. Tick **Enforce HTTPS** once the certificate is issued, which can take up to an hour.
4. **Optional:** verify the domain in your GitHub account settings, under Pages. This stops anyone else from claiming it.
5. **Cancel the old plan.** Once the new site is live, cancel the Websites + Marketing plan. Keep the domain registration.

Don't add the `CNAME` file before DNS points at GitHub. If you do, the staging URL will redirect to laylowcafe.ca, which still shows the old GoDaddy site.

**After launch:**
- In Google Search Console, verify the domain and submit `https://laylowcafe.ca/sitemap.xml`.
- In Google Business Profile, make sure the website, hours and menu link (`/menu/`) match the site.
- Put the website link in the Instagram and TikTok bios.

**Notes:**
- The canonical and social-preview tags already point at `https://laylowcafe.ca`, so search engines won't index the staging URL as the real site.
- The repo must be public for GitHub Pages on a free GitHub plan.
