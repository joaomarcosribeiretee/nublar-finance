import type { ReactNode } from "react";
import type { Locale } from "@nublar/validation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { PageHeader, Panel } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { ThemePicker } from "./ThemePicker";
import { useSaveSetting } from "./useSaveSetting";

const REPOSITORY_URL = "https://github.com/joaomarcosribeiretee/nublar-finance";

/** Each language is named in itself, so anyone can find their own. */
const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
];

/**
 * One column of short sections. A section only appears once what it controls
 * exists in the app: nothing here says "em breve".
 */
export function SettingsScreen({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  // Sections that change preferences pass `save` to their controls.
  const { preferences, save, status, saved, failed } = useSaveSetting();
  const { t } = useTranslation();

  return (
    <section className="animate-enter">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        actions={
          <p
            role="status"
            className={`flex min-h-5 items-center gap-1.5 text-xs transition-opacity ${status ? "opacity-100" : "opacity-0"} ${failed ? "text-negative" : "text-muted"}`}
          >
            {saved ? <Icon name="check" size={14} className="text-positive" /> : null}
            {status}
          </p>
        }
      >
        {t("settings.intro")}
      </PageHeader>

      <div className="mt-6 flex max-w-2xl flex-col gap-4">
        <Panel title={t("settings.profile.title")}>
          <SettingRow label={t("settings.profile.email")} hint={t("settings.profile.emailHint")}>
            <span className="min-w-0 truncate text-sm" title={email}>
              {email}
            </span>
          </SettingRow>
          <SettingRow label={t("settings.profile.session")}>
            <Button variant="ghost" className="-mr-4" onClick={onSignOut}>
              <Icon name="logout" size={16} /> {t("settings.profile.signOut")}
            </Button>
          </SettingRow>
        </Panel>

        <Panel title={t("settings.appearance.title")} subtitle={t("settings.appearance.subtitle")}>
          <ThemePicker value={preferences.theme} onChange={(theme) => save({ theme })} />
        </Panel>

        <Panel title={t("settings.language.title")} subtitle={t("settings.language.subtitle")}>
          <Segmented
            label={t("settings.language.label")}
            value={preferences.locale}
            options={LANGUAGES}
            onChange={(locale) => save({ locale })}
          />
        </Panel>

        <Panel title={t("settings.about.title")}>
          <SettingRow label={t("settings.about.version")}>
            <span className="text-sm tabular text-muted">{__APP_VERSION__}</span>
          </SettingRow>
          <SettingRow label={t("settings.about.source")}>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg text-sm text-accent hover:underline"
            >
              {t("settings.about.viewOnGitHub")} <Icon name="arrowRight" size={14} />
            </a>
          </SettingRow>
        </Panel>
      </div>
    </section>
  );
}

/** Label on the left, its control on the right; hairlines between rows. */
function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}
