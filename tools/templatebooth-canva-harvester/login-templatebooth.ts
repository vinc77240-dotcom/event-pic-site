import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARVESTER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(HARVESTER_DIR, ".browser-profile");
const LOGIN_URL = "https://templatesbooth.com/my-account/";

async function askEnter(prompt: string) {
  const rl = createInterface({ input, output });
  try {
    await rl.question(`${prompt}\n`);
  } finally {
    rl.close();
  }
}

type SessionCheck = {
  isLoggedIn: boolean;
  currentUrl: string;
  methods: string[];
  missing: string[];
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  hasEmailInput: boolean;
  hasLogOutText: boolean;
  hasYourAccountText: boolean;
  hasSessionCookie: boolean;
};

async function detectTemplateBoothSession(page: any): Promise<SessionCheck> {
  const currentUrl = ((page.url?.() ?? "") as string).toLowerCase();
  const domSignal = await page
    .evaluate(() => {
      const hasPasswordInput = Boolean(document.querySelector("input[type='password']"));
      const hasEmailInput = Boolean(document.querySelector("input[type='email']"));
      const hasLoginForm = Boolean(
        document.querySelector(
          "form[action*='login'], form[action*='signin'], form[action*='connexion'], .tml-login, .woocommerce-form-login"
        )
      );
      const bodyText = ((document.body?.innerText ?? "") + " " + (document.title ?? ""))
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const hasLogOutText = bodyText.includes("log out") || bodyText.includes("logout");
      const hasYourAccountText = bodyText.includes("your account");
      return {
        hasPasswordInput,
        hasEmailInput,
        hasLoginForm,
        hasLogOutText,
        hasYourAccountText
      };
    })
    .catch(() => ({
      hasPasswordInput: false,
      hasEmailInput: false,
      hasLoginForm: false,
      hasLogOutText: false,
      hasYourAccountText: false
    }));

  const cookies = await page
    .context()
    .cookies("https://templatesbooth.com")
    .catch(() => [] as Array<{ name?: string }>);
  const hasSessionCookie = cookies.some((cookie: { name?: string }) => {
    const name = String(cookie?.name ?? "").toLowerCase();
    return name.includes("wordpress_logged_in") || name.includes("wordpress_sec");
  });

  const methods: string[] = [];
  const myAccountUrl = currentUrl.includes("/my-account/");
  const noLoginFormDetected =
    !domSignal.hasLoginForm && !domSignal.hasPasswordInput && !domSignal.hasEmailInput;

  if (domSignal.hasLogOutText) {
    methods.push("texte 'Log Out' detecte");
  }
  if (domSignal.hasYourAccountText) {
    methods.push("texte 'Your Account' detecte");
  }
  if (myAccountUrl && noLoginFormDetected) {
    methods.push("URL '/my-account/' sans formulaire login");
  }
  if (hasSessionCookie) {
    methods.push("cookie session WordPress detecte");
  }
  if (noLoginFormDetected) {
    methods.push("absence de formulaire login");
  }

  const strongSignal = domSignal.hasLogOutText || domSignal.hasYourAccountText;
  const isLoggedIn = strongSignal || (methods.length > 0 && noLoginFormDetected);

  const missing: string[] = [];
  if (!domSignal.hasLogOutText) {
    missing.push("texte 'Log Out' absent");
  }
  if (!domSignal.hasYourAccountText) {
    missing.push("texte 'Your Account' absent");
  }
  if (!myAccountUrl) {
    missing.push("URL courante hors '/my-account/'");
  }
  if (domSignal.hasLoginForm || domSignal.hasPasswordInput || domSignal.hasEmailInput) {
    missing.push("formulaire login encore detecte");
  }
  if (!hasSessionCookie) {
    missing.push("cookie session WordPress non detecte");
  }

  return {
    isLoggedIn,
    currentUrl,
    methods,
    missing,
    hasLoginForm: domSignal.hasLoginForm,
    hasPasswordInput: domSignal.hasPasswordInput,
    hasEmailInput: domSignal.hasEmailInput,
    hasLogOutText: domSignal.hasLogOutText,
    hasYourAccountText: domSignal.hasYourAccountText,
    hasSessionCookie
  };
}

function logSessionDiagnostics(prefix: string, session: SessionCheck) {
  console.log(`[TemplateBooth Login] ${prefix}`);
  console.log(`[TemplateBooth Login] URL detectee: ${session.currentUrl || "-"}`);
  if (session.methods.length > 0) {
    console.log(
      `[TemplateBooth Login] Validation connexion: ${session.methods.join(" | ")}`
    );
  } else {
    console.log("[TemplateBooth Login] Validation connexion: aucun signal positif");
  }
  if (!session.isLoggedIn) {
    console.log(`[TemplateBooth Login] Elements manquants: ${session.missing.join(" | ")}`);
  }
}

async function main() {
  const playwright = await (0, eval)('import("playwright")');
  const context = await playwright.chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1480, height: 920 }
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log("[TemplateBooth Login] Profil persistant:", PROFILE_DIR);
  const initialSession = await detectTemplateBoothSession(page);
  logSessionDiagnostics("Diagnostic initial", initialSession);
  if (initialSession.isLoggedIn) {
    console.log(
      "[TemplateBooth Login] Connexion deja detectee. La session est enregistree dans .browser-profile."
    );
    await context.close();
    return;
  }

  while (true) {
    console.log(
      "Connectez-vous a TemplateBooth dans la fenetre ouverte, puis appuyez sur Entree."
    );
    await askEnter("Appuyez sur Entree apres la connexion.");

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => undefined);
    const session = await detectTemplateBoothSession(page);
    logSessionDiagnostics("Verification apres Entree", session);
    if (session.isLoggedIn) {
      console.log(
        "[TemplateBooth Login] Connexion detectee. La session est enregistree dans .browser-profile."
      );
      break;
    }

    console.log(
      "[TemplateBooth Login] Connexion non detectee. Reprenez la connexion dans le navigateur puis appuyez de nouveau sur Entree."
    );
  }

  await context.close();
}

main().catch((error) => {
  console.error(
    "[TemplateBooth Login] Echec:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
