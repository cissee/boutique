import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "@/lib/auth/routes";
import { profileSchema, shopSchema, signupSchema } from "@/lib/validation/schemas";

describe("safeNextPath (protection contre les redirections ouvertes)", () => {
  it.each(["/dashboard", "/customers?q=awa", "/onboarding/profile"])("accepte le chemin interne %j", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "evil.com", "", null, undefined, 42])(
    "refuse %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/dashboard");
    },
  );
});

describe("isPublicPath", () => {
  it("laisse passer les pages d'accueil et de connexion", () => {
    for (const p of ["/", "/login", "/signup", "/forgot-password", "/auth/callback"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("protège les pages de l'application", () => {
    for (const p of ["/dashboard", "/customers", "/settings", "/reset-password", "/onboarding/shop"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe("schémas de formulaires", () => {
  it("inscription : refuse des mots de passe différents", () => {
    const result = signupSchema.safeParse({
      fullName: "Awa",
      email: "awa@example.com",
      password: "motdepasse1",
      confirmPassword: "motdepasse2",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("inscription : normalise l'email et refuse un mot de passe court", () => {
    const ok = signupSchema.parse({
      fullName: " Awa Diop ",
      email: " Awa@Example.COM ",
      password: "motdepasse",
      confirmPassword: "motdepasse",
    });
    expect(ok.email).toBe("awa@example.com");
    expect(ok.fullName).toBe("Awa Diop");
    expect(signupSchema.safeParse({ ...ok, password: "court", confirmPassword: "court" }).success).toBe(false);
  });

  it("profil : téléphone facultatif, normalisé en +221", () => {
    expect(profileSchema.parse({ fullName: "Modou", phone: "" }).phone).toBeNull();
    expect(profileSchema.parse({ fullName: "Modou", phone: "77 123 45 67" }).phone).toBe("+221771234567");
    expect(profileSchema.safeParse({ fullName: "Modou", phone: "123" }).success).toBe(false);
  });

  it("boutique : nom obligatoire, adresse vide -> null", () => {
    expect(shopSchema.safeParse({ name: "  ", phone: "", address: "" }).success).toBe(false);
    expect(shopSchema.parse({ name: "Chez Modou", phone: "", address: "" }).address).toBeNull();
  });
});
