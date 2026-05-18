# ParkerTech — Website

A fast, warm, light-themed website built with [Astro](https://astro.build).
Showcases the educational technology you've built for schools, and gives
visitors a way to get in touch about ideas and needs of their own.

- **Framework:** Astro (static site generator — ships zero unnecessary JavaScript)
- **Hosting:** GitHub Pages (free)
- **Domain:** parkertech.co.uk (purchased via Squarespace)
- **Contact form:** Formspree (free tier) with an email fallback

---

## 1. Run it on your computer

You need [Node.js](https://nodejs.org) version 18.20 or newer installed.

```bash
npm install      # install dependencies (only needed once)
npm run dev      # start the local dev server
```

Then open the URL it prints (usually `http://localhost:4321`).
The page reloads automatically as you edit files.

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the local development server            |
| `npm run build`   | Build the final site into the `dist/` folder  |
| `npm run preview` | Preview the built site locally                |

---

## 2. Editing your content

Almost everything you'll want to change lives in two files — **no HTML needed**:

### `src/data/site.ts`

Your name, role, contact email, hero text, bio paragraphs, stats, and the
"What I can help with" list. Every placeholder is marked with a `TODO` comment.

### `src/data/projects.ts`

Your projects. Each project is a block of text — copy a block to add one,
delete a block to remove one. The page updates automatically. A project with
a `liveUrl` gets a "Visit" button; one without is shown as a case study.

> Look for `TODO` comments throughout both files — they mark every value
> you should replace with your real information.

---

## 3. Set up the contact form (Web3Forms)

The contact form submits straight to your inbox **without the visitor leaving
the site** — it just needs a free Web3Forms access key. **Until you add one,
the form falls back to opening the visitor's email app**, so the site still
works in the meantime.

1. Go to [web3forms.com](https://web3forms.com) and enter the email address you
   want enquiries sent to. No account or password needed — they email you an
   **access key**.
2. Open `src/data/site.ts` and set:
   ```ts
   web3formsKey: 'your-access-key-here',
   ```
3. Rebuild / redeploy. That's it — form submissions now arrive in your inbox,
   and the visitor sees a "Message sent" confirmation without ever leaving the
   page. Free plan: 250 submissions/month.

---

## 3a. Google Analytics (optional)

The site supports Google Analytics 4, gated behind a cookie-consent banner —
analytics only load once a visitor clicks **Accept**.

1. Create a free GA4 property at [analytics.google.com](https://analytics.google.com)
   and copy its **Measurement ID** (looks like `G-XXXXXXXXXX`).
2. Open `src/data/site.ts` and set `googleAnalyticsId` to that ID.
3. Rebuild / redeploy. The consent banner now appears for new visitors; until
   then (placeholder ID) no banner shows and nothing is tracked.

---

## 4. Put it on GitHub

1. Create a **free account** at [github.com](https://github.com) if you don't have one.
2. Create a **new repository** (e.g. `parkertech-website`). On a free GitHub
   account it must be **public** for GitHub Pages to work — that's fine for a
   website (it just means the site's code is visible). Private-repo Pages needs
   a paid plan.
3. In this project folder, run these commands (replace the URL with your repo's):

   ```bash
   git init
   git add .
   git commit -m "Initial commit: ParkerTech portfolio"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/parkertech-portfolio.git
   git push -u origin main
   ```

---

## 5. Turn on GitHub Pages

1. On GitHub, open your repository → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

That's it. The included workflow (`.github/workflows/deploy.yml`) builds and
publishes the site automatically every time you push to the `main` branch.
Watch progress under the repo's **Actions** tab. The first run takes a minute
or two; after that your site is live at `https://YOUR-USERNAME.github.io/...`.

---

## 6. Connect your custom domain (parkertech.co.uk)

This has two halves: tell **GitHub** about the domain, and point the
**domain's DNS** at GitHub.

### a) On GitHub

1. Repository → **Settings** → **Pages** → **Custom domain**.
2. Enter `parkertech.co.uk` and click **Save**.

   (A `CNAME` file is already included in `public/CNAME`, so this should
   already be filled in once the first deploy finishes.)

### b) In Squarespace DNS settings

Log in to Squarespace → **Domains** → select **parkertech.co.uk** →
**DNS Settings** (or **Advanced settings**). Add these records:

**Four A records** — host/name `@` (the root domain), pointing to GitHub's
Pages servers:

| Type | Host | Value             |
| ---- | ---- | ----------------- |
| A    | `@`  | `185.199.108.153` |
| A    | `@`  | `185.199.109.153` |
| A    | `@`  | `185.199.110.153` |
| A    | `@`  | `185.199.111.153` |

**One CNAME record** — so `www.parkertech.co.uk` also works:

| Type  | Host  | Value                       |
| ----- | ----- | --------------------------- |
| CNAME | `www` | `YOUR-USERNAME.github.io.`  |

> Replace `YOUR-USERNAME` with your actual GitHub username.
> If Squarespace has any default parking records on `@` that conflict,
> remove them.

### c) Wait, then enable HTTPS

DNS changes can take anywhere from a few minutes to 24 hours to take effect.
Once GitHub verifies the domain (Settings → Pages will stop showing a
warning), tick **Enforce HTTPS**. Your site is then live and secure at
`https://parkertech.co.uk`.

---

## 7. Updating the site later

Edit your content, then:

```bash
git add .
git commit -m "Update content"
git push
```

GitHub rebuilds and redeploys automatically within a minute or two.

---

## Optional polish

- **Social share image:** the site references `/og-image.png` for nice link
  previews when shared on social media. Create a `1200×630` PNG image and
  drop it in the `public/` folder as `og-image.png`. Until then, shared links
  simply won't show a preview image — nothing breaks.
- **Favicon:** the browser-tab icon lives at `public/favicon.svg`. Edit the
  colours or letter there if you want.

---

## Project structure

```
public/            Static files copied as-is (favicon, CNAME, robots.txt)
src/
  data/
    site.ts        ← your details, hero text, bio, capabilities
    projects.ts    ← the projects shown in the Projects grid
  components/      Page sections (Nav, Hero, About, Projects, Contact, Footer)
  layouts/
    Layout.astro   The HTML shell shared by every page
  pages/
    index.astro    The home page (assembles the sections)
    404.astro      The "page not found" page
  styles/
    global.css     Design tokens (colours, fonts) and shared styles
.github/workflows/
    deploy.yml     Builds & deploys to GitHub Pages on every push
```
