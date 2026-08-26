export type EnvAxisConfig = {
  /** Allowed axis values, e.g. ["light", "dark"]. */
  values: string[];
  /** Defaults to the first value when omitted. */
  default?: string;
};

export type SunabaUserConfig = {
  /** Story file globs, relative to the project root. */
  stories?: string[];
  /** Path to the preview entry (global decorators, CSS, applyEnv). */
  preview?: string;
  /**
   * Environment axes, declared as serializable data so the server can list
   * them without a browser. Application happens in the preview entry.
   */
  env?: Record<string, EnvAxisConfig>;
  vite?: {
    /** Set to false to start from a bare Vite config. */
    configFile?: string | false;
  };
};

export type SunabaConfig = {
  stories: string[];
  preview: string;
  env: Record<string, EnvAxisConfig>;
  vite: { configFile?: string | false };
};

export const DEFAULT_STORY_GLOBS = ["src/**/*.stories.{ts,tsx}"];
export const DEFAULT_PREVIEW_PATH = ".sunaba/preview.tsx";

export const defineConfig = (config: SunabaUserConfig): SunabaUserConfig => config;

export const resolveConfig = (user: SunabaUserConfig): SunabaConfig => ({
  stories: user.stories ?? DEFAULT_STORY_GLOBS,
  preview: user.preview ?? DEFAULT_PREVIEW_PATH,
  env: user.env ?? {},
  vite: user.vite ?? {},
});
