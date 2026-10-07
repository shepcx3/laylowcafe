# Lay Low Cafe website

Website for Lay Low Cafe, 241 Princess St, Kingston, ON. Served at https://laylowcafe.ca.

It's plain HTML, CSS and a little JavaScript. There's no build step and no framework, so any static host can serve the repo as it is.

```
index.html              Home
menu/index.html         /menu        (same URLs as the old GoDaddy site)
events/index.html       /events
contact-us/index.html   /contact-us
thanks/index.html       contact-form success page
404.html
assets/css/styles.css   all styles; colours and fonts are at the top in :root
assets/js/main.js       open-now badge, mobile nav, scroll effects
assets/img/             photos, logo, icons
netlify.toml            hosting config
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

## Hosting: moving off GoDaddy Websites + Marketing while keeping laylowcafe.ca

Websites + Marketing is a site builder and can't serve custom code. The domain stays registered at GoDaddy. Only the DNS records change so that they point at the new host.

1. **Netlify.** Create a free site at netlify.com, using "Import from Git" with this repo. Leave the build command empty and set the publish directory to `.`.
2. **Forms.** In Netlify, go to Forms, then Form notifications, and add an email notification so contact-form messages reach the cafe.
3. **Domain.** In Netlify, go to Domain management, add `laylowcafe.ca`, and add `www.laylowcafe.ca` too.
4. **DNS at GoDaddy.** Go to My Products, then the domain, then DNS:
   - Set the `A` record for `@` to `75.2.60.5`, Netlify's load balancer. Check Netlify's DNS screen for the current value.
   - Set the `CNAME` record for `www` to `<your-site>.netlify.app`.
   - **Don't touch MX, TXT (SPF/DKIM) or other email records**, or the cafe's email will break.
   - In GoDaddy, disconnect the domain from the Websites + Marketing site first. If you skip this, GoDaddy may keep rewriting the records.
5. Wait for DNS to update. This is usually under an hour. Netlify then issues the HTTPS certificate automatically.
6. Once the new site is live, cancel the Websites + Marketing plan. Keep the domain registration.

**After launch:**
- In Google Search Console, verify the domain and submit `https://laylowcafe.ca/sitemap.xml`.
- In Google Business Profile, make sure the website, hours and menu link (`/menu`) match the site.
- Put the website link in the Instagram and TikTok bios.

Cloudflare Pages or GitHub Pages would also work. The only Netlify-specific parts are the contact form (`data-netlify`) and `netlify.toml`. On another host, point the form at a service such as Formspree.
